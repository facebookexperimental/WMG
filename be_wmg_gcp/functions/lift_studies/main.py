import json
import os
import sys
import uuid

sys.path.append(os.path.dirname(__file__))

from utils.data_utils import LiftCloudStorageHandler, LiftDatabaseHandler
from utils.lift_utils import (
    calculate_cost_per_incremental_conversion,
    filter_conversions,
    get_study_stats,
)


# get environment variables
db_host = os.environ.get("DB_HOST", None)
db_name = os.environ.get("DB_NAME", None)
db_user = os.environ.get("DB_USER", None)
db_secret_name = os.environ.get("DB_SECRET_NAME", None)
bucket_name = os.environ.get("BUCKET_NAME", None)

# initialize database handler
db = LiftDatabaseHandler()


def lift_studies_handler(event):
    """
    Lift studies handler function.

    Args:
        event (flask.Request): Event data passed to the lambda function.

    Returns:
        response (dict): Response to be returned by the lambda function.
    """
    # get request parameters
    http_method = event.method

    request_body = event.get_data(as_text=True)
    request_data = json.loads(request_body) if request_body else {}

    query = event.query_string.decode("utf-8")
    if query:
        dict_query = dict([param.split("=", 1) for param in query.split("&")])
    else:
        dict_query = {}

    study_id = dict_query.get("id", None)
    conversion_event_name = dict_query.get("conversion_event", None)

    # handle requests
    if http_method == "POST":
        print("Creating Lift Study")
        try:
            required_fields = ["name", "start_date", "end_date", "sample_size"]
            assert all(
                field in request_data for field in required_fields
            ), "Missing required fields in request body."

            study_id = create_lift_study(request_data)

            return {"study_id": study_id}, 200
        except Exception as e:
            return {"message": f"Error while creating lift study: {e}"}, 400

    elif http_method == "GET":
        print("Getting Lift Study Results")
        try:
            assert study_id, "Study ID must be specified in the format /study/{id}"
            assert (
                conversion_event_name
            ), "Conversion event name must be specified in the format conversion_event=<your event>"

            results = get_lift_study_results(study_id, conversion_event_name)

            return results, 200

        except Exception as e:
            return {
                "message": f"Error while getting lift study results for study {study_id}: {e}"
            }, 400

    elif http_method == "PATCH":
        print("Updating Lift Study Status")
        try:
            updated_fields = []
            updated_fields = update_lift_study_data(study_id, request_data)

            return {"updated_fields": updated_fields}, 200

        except Exception as e:
            return {"message": f"Error while updating lift study status: {e}"}, 400

    return {"message": "Invalid HTTP method."}, 405


def create_lift_study(study_data):
    """
    Create a new lift study.

    Args:
        study_data (dict): Dictionary containing the study information.

    Returns:
        study_id (str): ID of the created study.
    """
    # connect to the database
    db.connect(db_host, db_name, db_user, db_secret_name)

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
    # connect to the database
    db.connect(db_host, db_name, db_user, db_secret_name)

    # check if the study exists
    assert db.exists_study_with_id(study_id), f"Study {study_id} does not exist."

    # create cloud storage handler object
    storage = LiftCloudStorageHandler()

    # get the study information
    try:
        study_df = db.read_table("lift_studies", filters=f"id = '{study_id}'")
        (
            _,
            study_name,
            start_date,
            end_date,
            sample_size,
            control_group_size,
            test_group_size,
            num_msgs,
            avg_msg_cost,
            status,
        ) = study_df.values[0]

        assert (
            control_group_size > 0 and test_group_size > 0
        ), "Group sizes must be greater than 0."
    except Exception as e:
        raise Exception(f"Error while fetching data for study {study_id}.", e)

    try:
        conversions = storage.get_conversions(bucket_name, "events.csv")

        # get the study groups
        study_groups = db.read_table(
            "lift_studies_groups", filters=f"study_id = '{study_id}'"
        )
        study_groups = study_groups[["phone_number", "group_name"]]

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
        "sample_size": sample_size,
        "test_num_conversions": test_results["conversions"],
        "test_group_size": test_group_size,
        "test_conversion_rate": round(test_results["conversion_rate"], 4),
        "test_conversion_rate_confidence_interval": test_results["confidence_interval"],
        "control_num_conversions": control_results["conversions"],
        "control_group_size": control_group_size,
        "control_conversion_rate": round(control_results["conversion_rate"], 4),
        "control_conversion_rate_confidence_interval": control_results[
            "confidence_interval"
        ],
        "lift": round(lift_perc, 4),
        "cost_per_incremental_conversion": round(cost_per_incremental_conv, 2),
        "p_value": round(p_value, 4),
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
    db.connect(db_host, db_name, db_user, db_secret_name)

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
                assert (
                    active_study_id is None
                ), "There is already an active study running."

            db.update_lift_study_data(study_id, "status", new_status)
            updated_fields["status"] = new_status

    if "avg_message_cost" in request_data:
        new_avg_msg_cost = request_data["avg_message_cost"]
        db.update_lift_study_data(study_id, "avg_message_cost", float(new_avg_msg_cost))
        updated_fields["avg_message_cost"] = new_avg_msg_cost

    db.close()

    return updated_fields
