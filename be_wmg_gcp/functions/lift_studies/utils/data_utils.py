import json
from io import StringIO

import mysql.connector
import pandas as pd
from google.cloud import secretmanager, storage


class LiftCloudStorageHandler:
    """
    Class for handling Cloud Storage operations.
    """

    def __init__(self):
        self.client = storage.Client()

    def read_file(self, bucket: str, file_key: str):
        """
        Read a file from Cloud Storage.

        Args:
            bucket (str): Bucket name.
            file_key (str): File path.

        Returns:
            data (str): Content of the file.
        """
        bucket = self.client.get_bucket(bucket)
        blob = bucket.blob(file_key)
        content = blob.download_as_string().decode("utf-8")

        return content

    def get_conversions(self, bucket: str, file_key: str):
        """
        Read a file with conversion data from Cloud Storage.

        Args:
            bucket (str): Bucket name.
            file_key (str): File key.

        Returns:
            conversions (pandas.DataFrame): DataFrame containing the conversion data.
        """
        data = self.read_file(bucket, file_key)
        conversions = pd.read_csv(StringIO(data))
        conversions["event_time"] = pd.to_datetime(conversions["event_time"])

        return conversions


class LiftDatabaseHandler:
    """
    Class for handling lift study data.
    """

    def __init__(self):
        self.conn = None

    def __del__(self):
        """
        When the object is deleted, close the connection to the database if it exists.
        """
        if getattr(self, "conn", None) is not None:
            self.close()

    def connect(self, db_host: str, db_name: str, db_user: str, db_secret_name: str):
        """
        Open a connection to the database.

        Args:
            db_host (str): Host name or IP address of the MySQL db server.
            db_name (str): Name of the database.
            db_user (str): Username to connect to the database.
            db_secret_name (str): name of the secret containing the database password.
        """
        db_pass = self.get_database_password(db_secret_name)
        self.conn = mysql.connector.connect(
            host=db_host,
            database=db_name,
            user=db_user,
            password=db_pass,
        )

    def close(self):
        """
        Close connection to the database.
        """
        self.conn.close()

    @staticmethod
    def get_database_password(db_secret_name: str) -> str:
        """
        Get the password for the database.

        Args:
            db_secret_name (str): name of the secret containing the database password.

        Returns:
            password (str): Password for the database.
        """
        try:
            print("Getting password")
            client = secretmanager.SecretManagerServiceClient()
            secret = client.access_secret_version(request={"name": db_secret_name})
            print("Parsing password")
            password = secret.payload.data.decode("UTF-8")
            return password
        except Exception as e:
            print(e)
            raise e

    def execute_query(self, query: str, commit: bool = False, params: tuple = ()):
        """
        Execute a MySQL query.

        Args:
            query (str): Query to be executed.
            commit (bool): Whether or not to commit the changes after executing the query. Defaults to False.
            params (tuple): Parameters to be used in the query. Defaults to an empty tuple.

        Returns:
            result (tuple): Result of the query.
            cols (list): List of column names.
        """
        cursor = self.conn.cursor()
        cursor.execute(query, params)

        if commit:
            self.conn.commit()

        result = cursor.fetchall()
        cols = cursor.column_names

        cursor.close()

        return result, cols

    def read_table(self, table: str, filters: str = "") -> pd.DataFrame:
        """
        Read data from a table in the database.

        Args:
            table (str): Table to read from.
            filters (str): Filters to apply on the table.

        Returns:
            result_df (pandas.DataFrame): DataFrame containing the data.
        """
        query = f"SELECT * FROM {table}{f' WHERE {filters}' if filters else ''};"
        result, cursor_cols = self.execute_query(query)
        result_df = pd.DataFrame(result, columns=cursor_cols)
        return result_df

    def get_active_study_id(self) -> str:
        """
        Get the active study.

        Returns:
            active_study (str): ID of the active study.
        """
        query = """
            SELECT id
            FROM lift_studies
            WHERE status='active'
            AND start_date <= CURRENT_DATE
            AND end_date >= CURRENT_DATE;
        """
        active_study, _ = self.execute_query(query)

        assert len(active_study) <= 1, "More than one active study found."

        return None if not active_study else active_study[0][0]

    def upload_new_study(self, info: dict):
        """
        Upload study information to the database.

        Args:
            info (dict): Dictionary containing the study information.
        """
        keys = ", ".join(info.keys())
        values_placeholder = ", ".join(["%s"] * len(info))
        query = f"INSERT INTO lift_studies ({keys}) VALUES ({values_placeholder});"
        _, _ = self.execute_query(query, True, tuple(info.values()))

    def update_lift_study_data(self, study_id: str, field: str, value: str):
        """
        Update a field of a study.

        Args:
            study_id (str): Study ID.
            field (str): Field to update.
            value (str): Value to set.
        """
        query = f"UPDATE lift_studies SET {field}='{value}' WHERE id='{study_id}';"
        _, _ = self.execute_query(query, True)

    def exists_study_with_id(self, study_id: str) -> bool:
        """
        Check if a study exists in the database.

        Args:
            study_id (str): Study ID.

        Returns:
            exists (bool): Whether or not the study exists.
        """
        query = f"SELECT EXISTS(SELECT 1 FROM lift_studies WHERE id='{study_id}');"
        exists, _ = self.execute_query(query)

        return bool(int(exists[0][0]))
