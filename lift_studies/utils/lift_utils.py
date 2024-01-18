import numpy as np
import pandas as pd
from scipy.stats import chi2_contingency, norm


def filter_conversions(
    conversions, start_date, end_date, conversion_event_name, study_groups
):
    """
    Filter conversions to only include those that are relevant to the study.

    Args:
        conversions (pandas.DataFrame): DataFrame containing all conversions.
        start_date (datetime.date): Start date of the study.
        end_date (datetime.date): End date of the study.
        conversion_event_name (str): Name of the conversion event.
        study_groups (pandas.DataFrame): DataFrame containing the study groups.

    Returns:
        valid_conversions (pandas.DataFrame): DataFrame containing all valid conversions
    """
    # conversions within the study's timeframe and conversion event
    valid_conversions = conversions[
        conversions["event_time"].dt.date.ge(pd.Timestamp(start_date).date())
        & conversions["event_time"].dt.date.le(pd.Timestamp(end_date).date())
        & conversions["event_name"].eq(conversion_event_name)
    ]

    # conversions where the customer is part of one of the study's groups
    valid_conversions = valid_conversions.merge(
        study_groups, left_on="user_phone", right_on="phone_number", how="inner"
    )

    # remove duplicates - some customers may have multiple conversions
    valid_conversions = valid_conversions[["user_phone", "group_name"]].drop_duplicates(
        ignore_index=True
    )

    return valid_conversions


def get_confidence_interval(count, nobs, alpha: float = 0.05):
    """
    Get confidence interval for a normal distribution.

    Args:
        count (float): Count of conversions.
        nobs (int): Number of observations.

    Returns:
        ci_low (float): Lower bound of the confidence interval.
        ci_upp (float): Upper bound of the confidence interval.
    """
    prop = count / nobs

    std = np.sqrt(prop * (1 - prop) / nobs)
    dist = norm.isf(alpha / 2.0) * std

    ci_low = prop - dist
    ci_upp = prop + dist

    ci_low = np.clip(ci_low, 0, 1)
    ci_upp = np.clip(ci_upp, 0, 1)

    return float(ci_low), float(ci_upp)


def get_conversion_results_for_group(valid_conversions, group_name, group_size):
    """
    Get results for a given study group.

    Args:
        valid_conversions (pandas.DataFrame): DataFrame containing all valid conversions.
        group_name (str): Group name to retrieve results for.
        group_size (int): Number of customers in the group.

    Returns:
        num_conversions (int): Number of conversions in the group.
        conversion_rate (float): Conversion rate in the group.
        conversion_rate_ci (float): Confidence interval for the conversion rate.
    """
    # number of conversions in the group
    num_conversions = valid_conversions[
        valid_conversions["group_name"] == group_name
    ].shape[0]
    # conversion rate
    conversion_rate = num_conversions / group_size if group_size > 0 else 0
    # confidence interval for the conversion rate
    conversion_rate_ci = [
        round(value, 4)
        for value in get_confidence_interval(num_conversions, group_size)
    ]

    return {
        "conversions": num_conversions,
        "conversion_rate": conversion_rate,
        "confidence_interval": conversion_rate_ci,
    }


def calculate_lift(test_conversion_rate, control_conversion_rate):
    """
    Calculate lift from incremental conversions and control conversions.

    Args:
        incremental_conversions (int): Incremental conversions.
        control_conversions (int): Control conversions.

    Returns:
        float: Lift.
    """
    return (
        100 * (test_conversion_rate - control_conversion_rate) / control_conversion_rate
        if control_conversion_rate > 0
        else np.inf
    )


def calculate_cost_per_incremental_conversion(
    average_message_cost, num_msgs, incremental_conversions
):
    """
    Calculate cost per incremental conversion.

    Args:
        average_message_cost (float): Average message cost.
        num_msgs (int): Total messages sent.
        incremental_conversions (int): Incremental conversions.

    Returns:
        float: Cost per incremental conversion.
    """
    return (
        (average_message_cost * num_msgs / incremental_conversions)
        if incremental_conversions > 0
        else np.inf
    )


def calculate_p_value(
    control_conversions, control_group_size, test_conversions, test_group_size
):
    """
    Calculate p-value for a two sample test.

    Args:
        control_conversions (int): Control conversions.
        control_group_size (int): Control group size.
        test_conversions (int): Test conversions.
        test_group_size (int): Test group size.

    Returns:
        float: P-value.
    """
    control_not_converted = control_group_size - control_conversions
    test_not_converted = test_group_size - test_conversions

    if (control_not_converted == 0 and test_not_converted == 0) or (
        control_conversions == 0 and test_conversions == 0
    ):
        p_value = np.nan
    else:
        observed_array = np.array(
            [
                [control_conversions, control_not_converted],
                [test_conversions, test_not_converted],
            ]
        )
        p_value = chi2_contingency(observed_array, correction=True).pvalue

    return p_value


def get_study_stats(valid_conversions, control_group_size, test_group_size):
    """
    Get metrics for a given study.

    Args:
        valid_conversions (pandas.DataFrame): DataFrame containing all valid conversions.
        control_group_size (int): Size of the control group.
        test_group_size (int): Size of the test group.

    Returns:
        control_results (dict): Results for the control group.
        test_results (dict): Results for the test group.
        p_value (float): P-value for the difference between conversion rates.
        lift_perc (float): Lift percentage.
        cost_per_incremental_conv (float): Cost per incremental conversion.
    """
    # calculate statistical results for each group
    control_results = get_conversion_results_for_group(
        valid_conversions, "control", control_group_size
    )
    test_results = get_conversion_results_for_group(
        valid_conversions, "test", test_group_size
    )

    # calculate p-value for the difference between conversion rates
    p_value = calculate_p_value(
        control_results["conversions"],
        control_group_size,
        test_results["conversions"],
        test_group_size,
    )

    # calculate lift
    lift_perc = calculate_lift(
        test_results["conversion_rate"], control_results["conversion_rate"]
    )

    return control_results, test_results, lift_perc, p_value
