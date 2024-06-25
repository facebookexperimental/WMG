// Copyright (c) Facebook, Inc. and its affiliates.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import functions from '@google-cloud/functions-framework';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

import mysql from 'mysql';
import { promisify } from 'util';

// Environment variables for database connection
const db_host = process.env.DB_HOST;
const db_user = process.env.DB_USER;
const db_name = process.env.DB_NAME;
const db_secret_name = process.env.DB_SECRET_NAME;
let db_pass;

functions.cloudEvent('process_signals', async cloudEvent => {
    let connection;
    try {
        db_pass = await getDatabasePassword();
        connection = createConnection();

        // The PubSub message is passed as the CloudEvent's data payload.
        const base64name = cloudEvent.data.message.data;
        const messageText = base64name ? Buffer.from(base64name, 'base64').toString() : '{}';

        console.log('Received PubSub message:', messageText);

        const recordBody = JSON.parse(messageText).body;
        const businessNumberId = recordBody.business_number_id;
        const consumerNumber = recordBody.to;

        console.info('Fetching all keywords from database');
        const keywords = await queryDatabase(connection, 'SELECT id, keyword FROM keywords');
        // Extract keywords and their corresponding IDs
        const keywordMap = new Map();
        for (const row of keywords) {
            keywordMap.set(row.keyword, row.id);
        }

        console.info('Searching keywords in the message body');
        const matchingKeywords = [];
        for (const [keyword, id] of keywordMap.entries()) {
            if (messageText.includes(keyword)) {
                matchingKeywords.push({ id, keyword });
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

    } catch (error) {
        console.error('Error:', error);
    } finally {
        // Close the database connection
        if(connection) connection.destroy();
    }
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
