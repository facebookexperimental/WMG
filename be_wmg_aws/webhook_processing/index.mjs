// Copyright (c) Facebook, Inc. and its affiliates.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import AWS from 'aws-sdk';
import mysql from 'mysql';
import axios from 'axios';
import { promisify } from 'util';

// Environment variables for database connection
const db_host = process.env.DB_HOST;
const db_user = process.env.DB_USER;
const dbSecretArn = process.env.DB_SECRET_ARN;
const db_name = process.env.DB_NAME;

let dbPass;
let connection;

AWS.config.update({ region: 'sa-east-1' });
export const lambdaHandler = async (event, context) => {
    const httpMethod = event.httpMethod;

    try {
        console.info('Received event: ', JSON.stringify(event));

        let payload = JSON.parse(event.Records[0].Sns.Message);
        let wa_payload = payload.entry[0].changes[0].value;
        let statuses = wa_payload.statuses;
        if (statuses) {
            return generateResponse(200, {});
        }

        let message;
        if (wa_payload.message_echoes) {
            message = wa_payload.message_echoes[0]
        } else {
            message = wa_payload.messages[0]
        }
        let metadata = wa_payload.metadata;

        dbPass = await getDatabasePassword();
        connection = createConnection();

        console.info('Received message: ', JSON.stringify(message));
        const messageBodyText = message.text.body;
        const businessNumberId = metadata.phone_number_id;
        const consumerNumber = message.from;
        const referral = message.referral;

        console.info('Fetching all keywords from database');
        const keywords = await queryDatabase(connection, 'SELECT id, keyword, capi_event, capi_event_custom_data FROM keywords');
        // Extract keywords and their corresponding IDs
        const keywordMap = new Map();
        for (const row of keywords) {
            keywordMap.set(row.keyword, { id: row.id });
        }

        console.info('Searching keywords in the message body');
        const matchingKeywords = [];
        for (const [keyword, data] of keywordMap.entries()) {
            if (messageBodyText.includes(keyword)) {
                matchingKeywords.push({ id: data.id, keyword});
            }
        }

        console.info(`${matchingKeywords.length} keywords found in the message body`);
        if (matchingKeywords.length > 0) {
            for (const { id, keyword } of matchingKeywords) {
                console.log('Updating signals table for keyword: ' + keyword);
                await queryDatabase(
                    connection,
                    'INSERT INTO signals (keyword_id, business_phone_number_id, consumer_phone_number) VALUES (?, ?, ?)',
                    [id, businessNumberId, consumerNumber]
                );
            }
        }
        return generateResponse(200, {});
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        console.info("Inside finally")
        if (connection) connection.destroy();
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
