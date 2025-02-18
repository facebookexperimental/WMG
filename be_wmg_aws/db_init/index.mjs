// Copyright (c) Facebook, Inc. and its affiliates.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import AWS from 'aws-sdk';
import mysql from 'mysql';
import { promisify } from 'util';
import axios from 'axios';

// Environment variables for database connection
const db_host = process.env.DB_HOST;
const db_user = process.env.DB_USER;
const db_secret_arn = process.env.DB_SECRET_ARN;
const db_name = process.env.DB_NAME;
let db_pass;

const dbUpdates = {
  1: [
    "ALTER TABLE signals ADD COLUMN capi_event VARCHAR(100)",
    "ALTER TABLE signals ADD COLUMN capi_event_custom_data varchar(2000)",
  ],
  2: [
    "ALTER TABLE lift_studies ADD COLUMN template_names VARCHAR(2000)",
  ],
};

export const lambdaHandler = async (event, context) => {
  const responseData = {};
  let responseStatus = 'SUCCESS';
  if (event.RequestType == 'Delete') {
    await sendResponse(event, context, responseStatus, responseData);
    return true;
  }

  let connection;
  try {
    db_pass = await getDatabasePassword();
    connection = createConnection();

    console.info('Creating keywords table schema');
    await queryDatabase(
      connection,
      `CREATE TABLE IF NOT EXISTS keywords (
          id INT AUTO_INCREMENT PRIMARY KEY,
          keyword VARCHAR(200) NOT NULL UNIQUE,
          \`signal\` VARCHAR(100) NOT NULL,
          capi_event VARCHAR(100),
          capi_event_custom_data varchar(2000),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`
    );

    console.info('Creating capi_signals table schema');
    await queryDatabase(
      connection,
      `CREATE TABLE IF NOT EXISTS capi_signals (
          id INT AUTO_INCREMENT PRIMARY KEY,
          business_phone_number_id VARCHAR(20) NOT NULL,
          consumer_phone_number VARCHAR(20) NOT NULL,
          ctwa_clid VARCHAR(200) NOT NULL,
          source_id VARCHAR(200) NOT NULL,
          raw_payload VARCHAR(2000) NOT NULL,
          event_timestamp TIMESTAMP
        )`
    );

    console.info('Creating signals table schema');
    await queryDatabase(
      connection,
      `CREATE TABLE IF NOT EXISTS signals (
          id INT AUTO_INCREMENT PRIMARY KEY,
          keyword_id INT,
          business_phone_number_id VARCHAR(20) NOT NULL,
          consumer_phone_number VARCHAR(20) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (keyword_id) REFERENCES keywords(id)
        )`
    );

    console.info('Creating audience rules table schema');
    await queryDatabase(
      connection,
      `CREATE TABLE IF NOT EXISTS audience_rules (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          name varchar(250) NOT NULL,
          include JSON,
          exclude JSON,
          query varchar(2000),
          subscriber_list_id varchar(50),
          creation_time timestamp not null default current_timestamp
        )`
    );

    console.info('Creating events schema');
    await queryDatabase(
      connection,
      `CREATE TABLE IF NOT EXISTS events (
          event_name varchar(250) NOT NULL,
          event_time BIGINT,
          user_name varchar(250) NOT NULL,
          user_phone varchar(20) NOT NULL,
          event_raw_data JSON
          )`
    );

    // This schema helps to provide the mapping between the subscriber (user phone and name)
    // and the subscriber list id.
    // It will help us to identify the subscribers who are part of a list, and accordindly
    // remove subscribers who are no longer part of the list.
    console.info('Creating subscriber list schema');
    await queryDatabase(
      connection,
      `CREATE TABLE IF NOT EXISTS subscriber_list (
        user_name varchar(250) NOT NULL,
        user_phone varchar(20) NOT NULL,
        subscriber_list_id varchar(50),
        PRIMARY KEY (subscriber_list_id, user_phone)
        )`
    );

    console.info('Creating lift studies table schema');
    await queryDatabase(
      connection,
      `CREATE TABLE IF NOT EXISTS lift_studies (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255),
        start_date DATE,
        end_date DATE,
        sample_size INT,
        template_names VARCHAR(2000),
        control_group_size INT,
        test_group_size INT,
        messages_count INT,
        avg_message_cost DOUBLE,
        status VARCHAR(255)
      )`
    );

    console.info('Creating lift studies groups table schema');
    await queryDatabase(
      connection,
      `CREATE TABLE IF NOT EXISTS lift_studies_groups (
        study_id VARCHAR(255),
        phone_number VARCHAR(20),
        group_name VARCHAR(255)
      )`
    );

    const latest_db_version = getLatestDBVersion()
    console.info('Creating db version table schema');
    await queryDatabase(
      connection,
      `CREATE TABLE IF NOT EXISTS db_version (
        version INT NOT NULL PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    await queryDatabase(
      connection,
      `INSERT INTO db_version (version)
        SELECT ?
        WHERE NOT EXISTS (SELECT * FROM db_version)`,
      [latest_db_version]
    );

    const current_db_version = await getCurrentDBVersion(connection);
    if (current_db_version < latest_db_version) {
      console.info("Updating db from version " + current_db_version + " to version " + latest_db_version);
      await updateDatabase(connection, current_db_version, latest_db_version);
    } else {
      console.info("No need to update db, current version is " + current_db_version);
    }

  } catch (error) {
    console.error(error);
    responseStatus = 'FAILED';
  } finally {
    // Close the database connection
    if (connection) connection.destroy();

    await sendResponse(event, context, responseStatus, responseData);
  }
  return true;
};

// CloudFormation uses a pre-signed S3 URL to receive the response back from the custom resources managed by it. This is a simple function
// which shall be used to send the response back to CFN custom resource by performing PUT request to the pre-signed S3 URL.
async function sendResponse(event, context, responseStatus, responseData, physicalResourceId = null) {
  const responseBody = JSON.stringify({
    Status: responseStatus,
    Reason: "See the details in CloudWatch Log Stream: " + context.logStreamName,
    PhysicalResourceId: physicalResourceId || context.logStreamName,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: responseData
  });

  console.info("Response body:\n", responseBody);

  const responseOptions = {
    headers: {
      'Content-Type': '',
      'Content-Length': responseBody.length
    }
  };

  try {
    await axios.put(event.ResponseURL, responseBody, responseOptions);

    console.info('CloudFormationSendResponse Success');
  } catch (error) {
    console.error('CloudFormationSendResponse Error:', error);
    throw new Error('Could not send CloudFormation response');
  }
}

// Helper function to query the database
const queryDatabase = async (connection, queryStr, params) => {
  const queryAsync = promisify(connection.query).bind(connection);

  try {
    const result = await queryAsync(queryStr, params);
    return result;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// Helper function to create a database connection
const createConnection = () => {
  console.info('Creating db connection');
  return mysql.createConnection({
    host: db_host,
    user: db_user,
    password: db_pass,
    database: db_name
  });
};

// Helper function to get the database password from AWS Secrets Manager
const getDatabasePassword = async () => {
  try {
    console.info('Getting password');
    const client = new AWS.SecretsManager();
    const data = await client.getSecretValue({ SecretId: db_secret_arn }).promise();
    console.info('Parsing password');
    if ('SecretString' in data) {
      const secret = JSON.parse(data.SecretString);
      return secret.password;
    } else {
      const decodedBinarySecret = Buffer.from(data.SecretBinary, 'base64');
      return decodedBinarySecret.toString();
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// Function to get the latest version of the database based on the dbUpdates object
function getLatestDBVersion() {
  return Object.keys(dbUpdates).sort().pop() || 0;
};

// Function to get the current version of the database based on the db_version table
const getCurrentDBVersion = async (connection) => {
  const queryStr = "SELECT MAX(version) AS version FROM db_version";

  const result = await queryDatabase(connection, queryStr);
  return parseInt(result[0].version);
};

// Function to update the database based on the dbUpdates object
const updateDatabase = async (connection, currentVersion, latestVersion) => {
  const queryAsync = promisify(connection.query).bind(connection);

  for (let i = currentVersion + 1; i <= latestVersion; i++) {
    let updates = dbUpdates[i];
    try {
      await connection.beginTransaction();
      for (let update_query of updates) {
        console.info(`Running update ${i}: ${update_query}`);
        await queryAsync(update_query);
      }
      await connection.commit();
      await queryDatabase(connection, "INSERT INTO db_version (version) VALUES (?)", [i]);
      console.info(`Update ${i} completed`);
    } catch (error) {
      console.error(`Rolling back update ${i}`);
      await connection.rollback();
      throw error;
    };
  };
};
