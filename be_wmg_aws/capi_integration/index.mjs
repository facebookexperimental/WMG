// Copyright (c) Facebook, Inc. and its affiliates.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import AWS from 'aws-sdk';
import mysql from 'mysql';
import { promisify } from 'util';

// Environment variables for database connection
const db_host = process.env.DB_HOST;
const db_user = process.env.DB_USER;
const dbSecretArn = process.env.DB_SECRET_ARN;
const db_name = process.env.DB_NAME;
let dbPass;

export const lambdaHandler = async (event, context) => {
    let connection;

    const queryParams = event.queryStringParameters || {};

    let limit = queryParams.limit || 100;
    let event_timestamp_filter;
    if (queryParams.event_timestamp_after) {
        event_timestamp_filter = queryParams.event_timestamp_after;
    }

    try {
        dbPass = await getDatabasePassword();
        connection = createConnection();

        let query = `SELECT id, business_phone_number_id, consumer_phone_number , ctwa_clid, source_id, raw_payload, event_timestamp `
            + ` FROM capi_signals `
            + (event_timestamp_filter ? ` WHERE event_timestamp > ${event_timestamp_filter} ` : ``)
            + ` ORDER BY event_timestamp desc `
            + ` LIMIT ${limit}`;

        const result = await queryDatabase(connection, query);

        return generateResponse(200, { result });

    } catch (error) {
        console.error(error);
        return generateResponse(500, { message: 'Internal Server Error + ', error });
    } finally {
        if(connection) connection.destroy();
    }
};

// Helper function to generate the response
const generateResponse = (statusCode, data) => {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    };
};

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
        password: dbPass,
        database: db_name
    });
};

// Helper function to get the database password from AWS Secrets Manager
const getDatabasePassword = async () => {
    try {
        console.info('Getting password');
        const client = new AWS.SecretsManager();
        const data = await client.getSecretValue({ SecretId: dbSecretArn }).promise();
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
