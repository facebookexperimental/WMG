// Copyright (c) Facebook, Inc. and its affiliates.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

// [START cloud functions http trigger]
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

functions.http('manage_keywords_handler', async (event, response) => {
    const httpMethod = event.method;
    const { id: keyword_id } = event.query || {};

    let connection;
    try {
        db_pass = await getDatabasePassword();
        connection = createConnection();

        if (httpMethod === 'GET') {
            if (keyword_id) {
                console.info('keyword_id: ', keyword_id);
                const result = await queryDatabase(connection, 'SELECT * FROM keywords WHERE id=?', [keyword_id]);
                return generateResponse(response, 200, result);
            } else {
                const result = await queryDatabase(connection, 'SELECT * FROM keywords');
                return generateResponse(response, 200, result);
            }
        } else if (httpMethod === 'POST') {
            console.info('Body:', JSON.stringify(event.body));
            const {keyword, signal} = event.body;
            const result = await queryDatabase(connection, 'INSERT INTO keywords (keyword, `signal`) VALUES (?, ?)', [keyword, signal]);
            return generateResponse(response, 200, { id: result.insertId, keyword, signal });
        } else if (httpMethod === 'PUT') {
            console.info('Body:', JSON.stringify(event.body), 'keyword_id: ', keyword_id);
            const {keyword, signal} = event.body;
            await queryDatabase(connection, 'UPDATE keywords SET keyword=?, `signal`=? WHERE id=?', [keyword, signal, keyword_id]);
            return generateResponse(response, 200, { id: keyword_id, keyword, signal });
        } else {
            return generateResponse(response, 405, { message: 'Method Not Allowed' });
        }
    } catch (error) {
        console.error(error);
        return generateResponse(response, 500, { message: 'Internal Server Error' });
    } finally {
        // Close the database connection
        if(connection) connection.destroy();
    }
});

// Helper function to generate the response
const generateResponse = (response, statusCode, data) => {
    response.setHeader('Content-Type', 'application/json');
    response.statusCode = statusCode;
    response.send(JSON.stringify(data));
    return true;
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
