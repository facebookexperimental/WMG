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
const db_secret_arn = process.env.DB_SECRET_ARN;
const db_name = process.env.DB_NAME;
let db_pass;

AWS.config.update({ region: 'sa-east-1' });
export const lambdaHandler = async (event, context) => {
    const httpMethod = event.httpMethod;
    const { id: keyword_id } = event.pathParameters || {};

    let connection;
    try {
        db_pass = await getDatabasePassword();
        connection = createConnection();

        if (httpMethod === 'GET') {
            if (keyword_id) {
                console.info('keyword_id: ', keyword_id);
                const result = await queryDatabase(connection, 'SELECT * FROM keywords WHERE id=?', [keyword_id]);
                return generateResponse(200, result);
            } else {
                const result = await queryDatabase(connection, 'SELECT * FROM keywords');
                return generateResponse(200, result);
            }
        } else if (httpMethod === 'POST') {
            console.info('Body:', event.body);
            const {keyword, signal} = JSON.parse(event.body);
            const result = await queryDatabase(connection, 'INSERT INTO keywords (keyword, `signal`) VALUES (?, ?)', [keyword, signal]);
            return generateResponse(200, { id: result.insertId, keyword, signal });
        } else if (httpMethod === 'PUT') {
            console.info('Body:', event.body, 'keyword_id: ', keyword_id);
            const {keyword, signal} = JSON.parse(event.body);
            await queryDatabase(connection, 'UPDATE keywords SET keyword=?, `signal`=? WHERE id=?', [keyword, signal, keyword_id]);
            return generateResponse(200, { id: keyword_id, keyword, signal });
        } else {
            return generateResponse(405, { message: 'Method Not Allowed' });
        }
    } catch (error) {
        console.error(error);
        return generateResponse(500, { message: 'Internal Server Error' });
    } finally {
        // Close the database connection
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
