# Copyright (c) Facebook, Inc. and its affiliates.
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.

import json
import os
import sys
import uuid

from utils.data_utils import LiftDatabaseHandler, LiftS3Handler
from utils.lift_utils import (
    calculate_cost_per_incremental_conversion,
    filter_conversions,
    get_study_stats,
)

sys.path.append(os.path.dirname(__file__))

# get environment variables
db_secret_arn = os.environ.get("DB_SECRET_ARN", None)
db_user = os.environ.get("DB_USER", None)
db_host = os.environ.get("DB_HOST", None)
db_name = os.environ.get("DB_NAME", None)
bucket_name = os.environ.get("BUCKET_NAME", None)

# initialize database handler
db = LiftDatabaseHandler()


def lambda_handler(event, context):
    """
    Lambda handler function.

    Args:
        event (dict): Event data passed to the lambda function.
        context (Context): Runtime information of the lambda function.

    Returns:
        response (dict): Response to be returned by the lambda function.
    """
    # get request parameters
    http_method = event.get("httpMethod", None)
    request_body = event.get("body", None)
    request_data = json.loads(request_body) if request_body else {}

    study_id = None
    if event["pathParameters"]:
        study_id = event["pathParameters"].get("id", None)

    conversion_event_name = None
    if event["queryStringParameters"]:
        conversion_event_name = event["queryStringParameters"].get(
            "conversion_event", None
        )

    # handle requests
    if http_method == "POST":
        print("Creating Lift Study")
        try:
            required_fields = [
                "name",
                "start_date",
                "end_date",
                "sample_size",
                "template_names",
            ]
            assert all(field in request_data for field in required_fields), (
                "Missing required fields in request body."
            )
            assert all(
                validate_template_name(tn)
                for tn in request_data["template_names"].split(",")
            ), (
                "Template name must be composed by lowercase letters, numbers, and underscores."
            )

            study_id = create_lift_study(request_data)

            return {
                "statusCode": 200,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"study_id": study_id}),
            }
        except Exception as e:
            return abort(400, message=f"Error while creating lift study: {e}")

    elif http_method == "GET":
        if study_id:
            print("Getting Lift Study Results")
            try:
                assert conversion_event_name, (
                    "Conversion event name must be specified in the format conversion_event=<your event>"
                )

                results = get_lift_study_results(study_id, conversion_event_name)

                return {
                    "statusCode": 200,
                    "headers": {"Content-Type": "application/json"},
                    "body": json.dumps(results),
                }
            except Exception as e:
                return abort(
                    400,
                    message=f"Error while getting lift study results for study {study_id}: {e}",
                )
        else:
            print("Getting all Lift Studies")
            try:
                # connect to the database
                db.connect(db_secret_arn, db_user, db_host, db_name)

                # read all studies from the database
                studies = db.read_table("lift_studies")
                # format dates
                studies["start_date"] = studies["start_date"].apply(
                    lambda x: x.strftime("%Y-%m-%d")
                )
                studies["end_date"] = studies["end_date"].apply(
                    lambda x: x.strftime("%Y-%m-%d")
                )
                # convert to json
                studies_json = studies.to_json(orient="records")

                # close the database connection
                db.close()

                return {
                    "statusCode": 200,
                    "headers": {"Content-Type": "application/json"},
                    "body": studies_json,
                }
            except Exception as e:
                return abort(400, message=f"Error while getting all lift studies: {e}")

    elif http_method == "PATCH":
        print("Updating Lift Study Status")
        try:
            updated_fields = []
            updated_fields = update_lift_study_data(study_id, request_data)

            return {
                "statusCode": 200,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"updated_fields": updated_fields}),
            }
        except Exception as e:
            return abort(400, message=f"Error while updating lift study status: {e}")

    return abort(405, message="Invalid HTTP method.")


def create_lift_study(study_data):
    """
    Create a new lift study.

    Args:
        study_data (dict): Dictionary containing the study information.

    Returns:
        study_id (str): ID of the created study.
    """
    # connect to the database
    db.connect(db_secret_arn, db_user, db_host, db_name)

    # check if there is another active study
    assert db.get_active_study_id() is None, "There is an active study running."

    # generate a random study id
    study_id = uuid.uuid4().hex

    # insert the study info into the database
    study_info = {
        "id": study_id,
        **study_data,
        "control_group_size": 0,
        "test_group_size": 0,
        "messages_count": 0,
        "avg_message_cost": 0,
        "status": "active",
    }
    db.upload_new_study(study_info)
    db.close()

    return study_id


def get_lift_study_results(study_id: str, conversion_event_name: str):
    """
    Get results for a given lift study.

    Args:
        study_id (str): ID of the study to get results for.
        conversion_event_name (str): Name of the conversion event to get results for.

    Returns:
        results (dict): Results for the study.
    """
    print("Connecting to database")
    db.connect(db_secret_arn, db_user, db_host, db_name)

    print("Checking if study exists")
    assert db.exists_study_with_id(study_id), f"Study {study_id} does not exist."

    # create s3 handler object
    s3 = LiftS3Handler()

    print("Fetching study data")
    try:
        study_df = db.read_table("lift_studies", filters=f"id = '{study_id}'")

        study_name = study_df["name"].values[0]
        start_date = study_df["start_date"].values[0]
        end_date = study_df["end_date"].values[0]
        sample_size = study_df["sample_size"].values[0]
        control_group_size = study_df["control_group_size"].values[0]
        test_group_size = study_df["test_group_size"].values[0]
        num_msgs = study_df["messages_count"].values[0]
        avg_msg_cost = study_df["avg_message_cost"].values[0]

        assert control_group_size > 0 and test_group_size > 0, (
            "Group sizes must be greater than 0."
        )
    except Exception as e:
        raise Exception(f"Error while fetching data for study {study_id}.", e)

    try:
        print("Reading conversions from events.csv file in S3")
        conversions = s3.get_conversions_from_s3(bucket_name, "events.csv")

        print("Reading study groups table")
        study_groups = db.read_table(
            "lift_studies_groups", filters=f"study_id = '{study_id}'"
        )
        study_groups = study_groups[["phone_number", "group_name"]]
        # normalize phone numbers to include digits only
        study_groups.loc[:, "phone_number"] = study_groups["phone_number"].str.replace(
            r"[^0-9]", "", regex=True
        )

        print("Filtering valid conversions")
        valid_conversions = filter_conversions(
            conversions, start_date, end_date, conversion_event_name, study_groups
        )

        assert not valid_conversions.empty, "No valid conversions found."
    except Exception as e:
        raise Exception(
            f"Error while fetching valid conversion events ({conversion_event_name}) for study {study_id}.",
            e,
        )

    try:
        print("Calculating metrics")
        (control_results, test_results, lift_perc, p_value) = get_study_stats(
            valid_conversions, control_group_size, test_group_size
        )

        # calculate cost per incremental conversion
        incremental_conversions = (
            test_results["conversions"] - control_results["conversions"]
        )
        cost_per_incremental_conv = calculate_cost_per_incremental_conversion(
            avg_msg_cost, num_msgs, incremental_conversions
        )
    except Exception as e:
        raise Exception(f"Error while calculating metrics for study {study_id}.", e)

    results = {
        "name": study_name,
        "start_date": start_date.strftime("%Y-%m-%d"),
        "end_date": end_date.strftime("%Y-%m-%d"),
        "sample_size": str(sample_size),
        "test_num_conversions": str(test_results["conversions"]),
        "test_group_size": str(test_group_size),
        "test_conversion_rate": str(round(test_results["conversion_rate"], 4)),
        "test_conversion_rate_confidence_interval": str(
            test_results["confidence_interval"]
        ),
        "control_num_conversions": str(control_results["conversions"]),
        "control_group_size": str(control_group_size),
        "control_conversion_rate": str(round(control_results["conversion_rate"], 4)),
        "control_conversion_rate_confidence_interval": str(
            control_results["confidence_interval"]
        ),
        "lift": str(round(lift_perc, 4)),
        "cost_per_incremental_conversion": str(round(cost_per_incremental_conv, 2)),
        "p_value": str(round(p_value, 4)),
    }

    db.close()

    return results


def update_lift_study_data(study_id: str, request_data: dict):
    """
    Update lift study data.

    Args:
        study_id (str): ID of the study to update.
        request_data (dict): Data to update.

    Returns:
        updated_fields (dict): Dictionary containing the updated fields.
    """
    # connect to the database
    db.connect(db_secret_arn, db_user, db_host, db_name)

    # check if the study exists
    assert db.exists_study_with_id(study_id), f"Study {study_id} does not exist."

    updated_fields = {}

    if "status" in request_data:
        new_status = request_data["status"]
        active_study_id = db.get_active_study_id()

        assert new_status in (
            "active",
            "paused",
        ), "Status must be either 'active' or 'paused'."
        # run the code if its not trying to activate an active study or pause a paused study
        if not (
            (new_status == "active" and active_study_id == study_id)
            or (new_status == "paused" and active_study_id != study_id)
        ):
            if new_status == "active":
                assert active_study_id is None, (
                    "There is already an active study running."
                )

            db.update_lift_study_data(study_id, "status", new_status)
            updated_fields["status"] = new_status

    if "avg_message_cost" in request_data:
        new_avg_msg_cost = request_data["avg_message_cost"]
        db.update_lift_study_data(study_id, "avg_message_cost", float(new_avg_msg_cost))
        updated_fields["avg_message_cost"] = new_avg_msg_cost

    if "template_names" in request_data:
        new_templates = request_data["template_names"]
        assert all(validate_template_name(tn) for tn in new_templates.split(",")), (
            "Template name must be composed by lowercase letters, numbers, and underscores."
        )
        db.update_lift_study_data(study_id, "template_names", new_templates)
        updated_fields["template_names"] = new_templates

    db.close()

    return updated_fields


def validate_template_name(template_name):
    return (
        template_name.replace("_", "").isalnum() and template_name.islower()
    ) or template_name.isnumeric()


def abort(code, message):
    """
    Format error code and message.

    Args:
        code (int): Error code.
        message (str): Error message.

    Returns:
        response (dict): Response to be returned by the lambda function.
    """
    return {
        "statusCode": code,
        "headers": {
            "Content-Type": "application/text",
        },
        "body": message,
    }
