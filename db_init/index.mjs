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

AWS.config.update({ region: 'sa-east-1' });
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
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
    } catch (error) {
        console.error(error);
        responseStatus = 'FAILED';
    } finally {
      // Close the database connection
      if(connection) connection.destroy();

      await sendResponse(event, context, responseStatus, responseData);
    }
    return true;
};

// CloudFormation uses a pre-signed S3 URL to receive the response back from the custom resources managed by it. This is a simple function
// which shall be used to send the response back to CFN custom resource by performing PUT request to the pre-signed S3 URL.
async function sendResponse(event, context, responseStatus, responseData, physicalResourceId=null) {
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
