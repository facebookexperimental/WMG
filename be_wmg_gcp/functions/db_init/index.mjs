// Copyright (c) Facebook, Inc. and its affiliates.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import mysql from 'mysql';
import { promisify } from 'util';

import functions from '@google-cloud/functions-framework';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// Environment variables for database connection
const db_socket = process.env.DB_HOST;
const db_user = process.env.DB_USER;
const db_name = process.env.DB_NAME;
const db_secret_name = process.env.DB_SECRET_NAME;
let db_pass;

functions.http('db_init_handler', async (event, response) => {
  response.setHeader('Content-Type', 'text/plain');

  let responseCode = 200;
  let responseStatus = 'SUCCESS';

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

  } catch (error) {
    console.log("Error while trying to create databases!");
    console.error(error);
    responseCode = 500;
    responseStatus = 'Error while trying to create databases';
  } finally {
    // Close the database connection
    if (connection) connection.destroy();

    response.statusCode = responseCode;
    response.send(responseStatus);
  }
  return true;
});

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

// Helper function to get the database password from GCP Secret Manager
const getDatabasePassword = async () => {
  try {
    console.info('Getting password');
    const client = new SecretManagerServiceClient();
    const [secret] = await client.accessSecretVersion({ name: db_secret_name, });
    console.info('Parsing password');
    const password = secret.payload.data.toString();
    return password;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
