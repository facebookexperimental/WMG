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
const db_secret_arn = process.env.DB_SECRET_ARN;
const db_name = process.env.DB_NAME;
let db_pass;

AWS.config.update({ region: 'sa-east-1' });
export const lambdaHandler = async (event, context) => {
    const httpMethod = event.httpMethod;

    console.info('Http method: ', httpMethod);
    console.info('Event: ', event);
    console.info('Body : ', event.body);

    let connection;
    try {
        db_pass = await getDatabasePassword();
        connection = createConnection();

        if (httpMethod === 'GET') {
            console.info("Received Audience Rule GET All request");
            const result = await queryDatabase(connection, 'SELECT * FROM audience_rules');

            return generateResponse(200, { result });
        } else if (httpMethod === 'POST') {
            const queryParams = event.queryStringParameters || {};
            const su_access_token = queryParams.su_access_token;
            const wacs_id = queryParams.wacs_id;
            const ad_account_id = queryParams.ad_account_id;
            let errorMessage = '';

            console.info('Received Audience Rule POST request,  Body:', event.body);
            let { name, include, exclude } = JSON.parse(event.body);

            if (!name) {
                errorMessage = 'Missing required parameters: name. Please provide a name for the audience rule.';
                throw new Error(errorMessage);
            }

            if (!include && !exclude) {
                errorMessage = 'Missing required parameters: include or exclude. Please provide at least one parameter.';
                throw new Error(errorMessage);
            }

            let sql_query = createSqlQueryForAudienceRule(include, exclude);

            include = JSON.stringify(include);
            exclude = JSON.stringify(exclude);

            // Endpoint to trigger the subscriber list creation
            const createSubscriberListResponse = await createSubscriberList(name, su_access_token, wacs_id, ad_account_id);
            console.info('Create Subscriber List Response: ', createSubscriberListResponse);

            const subscriber_list_id = createSubscriberListResponse.id;

            const insert_query = 'INSERT INTO audience_rules (name, include, exclude, query, subscriber_list_id) VALUES (?, ?, ?, ?, ?)';
            const result = await queryDatabase(connection, insert_query, [name, include, exclude, sql_query, subscriber_list_id]);
            const insertId = result.insertId;

            // Select the newly inserted row and send it back as a response
            const select = 'SELECT * FROM audience_rules WHERE id = ?';
            const createdRule = await queryDatabase(connection, select, [insertId]);

            return generateResponse(200, { createdRule: createdRule, subscriberList: createSubscriberListResponse });

        }
        else if (httpMethod === 'DELETE') {
            console.info('Received Audience Rule DELETE request');
            // Delete all the rows from the table
            const delete_query = 'DELETE FROM audience_rules';

            const result = await queryDatabase(connection, delete_query);
            return generateResponse(200, { message: 'Successfully deleted all the rules' });

        } else {
            return generateResponse(405, { message: 'Method Not Allowed' });
        }
    } catch (error) {
        console.error(error);
        return generateResponse(500, { message: 'Internal Server Error + ', errorMessage: error.message });
    } finally {
        // Close the database connection
        if (connection) connection.destroy();
    }
};

const createSqlQueryForAudienceRule = (include, exclude) => {

    let include_query = null;
    let exclude_query = null;
    let sql_query = null;

    if (include) {
        include_query = generateRulesQuery(include);
    }

    if (exclude) {
        exclude_query = generateRulesQuery(exclude);
    }

    if (include == null || exclude == null) {
        sql_query = include_query != null ? include_query : exclude_query;
        return sql_query;
    }

    sql_query = `WITH `;

    sql_query += ` latest_inclusion_events AS (`
        + `${include_query}`
        + `),`;

    sql_query += ` latest_exclusion_events AS (`
        + `${exclude_query}`
        + `)`;

    console.info(`Include Query: ${include_query}, Exclude Query: ${exclude_query}`);

    sql_query += ` SELECT DISTINCT lie.user_name, lie.user_phone FROM latest_inclusion_events AS lie `
        + `LEFT JOIN latest_exclusion_events AS lee ON lie.user_phone = lee.user_phone `
        + `WHERE lee.user_phone is NULL OR lie.event_time > lee.event_time;`


    console.info(`SQL Query: ${sql_query}`);

    return sql_query;
}

// Fetch subscriber list
const fetchSubscriberList = async () => {
    console.info("Fetching Subscriber List...");
    const url = 'https://graph.facebook.com/v18.0/' + wacs_id + '/subscriber_lists';
    const params = {
        access_token: su_access_token,
        ad_account: ad_account_id,
        fields: 'name,description'
    };

    try {
        const response = await axios.get(url, { params });
        return response.data;
    }
    catch (error) {
        console.info(error);
        throw error;
    }
}


// Function to create the subscriber list
const createSubscriberList = async (rule_name, su_access_token, wacs_id, ad_account_id) => {

    const url = 'https://graph.facebook.com/v18.0/act_' + ad_account_id + '/customaudiences';
    const params = {
        access_token: su_access_token,
        subtype: 'SUBSCRIBER_LIST',
        whats_app_business_phone_number_id: wacs_id,
        name: rule_name,
        description: 'A subscriber list created via SSAPI for Audience Rule named ' + rule_name,
    };

    try {
        const response = await axios.post(url, params);
        return response.data;
    }
    catch (error) {
        console.log(error);
        throw error;
    }

};

// Function to help generate the query for exclusion event
const generateRulesQuery = (rule) => {

    // REFERENCE:
    //
    // WITH
    // latest_inclusion_events AS (SELECT user_name, user_phone, MAX(event_time) as event_time FROM events
    // WHERE ((UNIX_TIMESTAMP(event_time) > (UNIX_TIMESTAMP(NOW()) - 1.296e+6) AND event_name = 'AddToCart')) GROUP BY 1, 2),
    // latest_exclusion_events AS (SELECT user_name, user_phone, MAX(event_time) as event_time FROM events
    // WHERE ((UNIX_TIMESTAMP(event_time) > (UNIX_TIMESTAMP(NOW()) - 864000) AND event_name = 'Purchase')) GROUP BY 1, 2)
    // SELECT inclusion.user_name, inclusion.user_phone
    // FROM latest_inclusion_events inclusion
    // LEFT JOIN latest_exclusion_events exclusion ON inclusion.user_phone = exclusion.user_phone
    // WHERE exclusion.user_phone IS NULL OR inclusion.event_time > exclusion.event_time;


    // Please note: retention value needs to be in seconds

    // check if rule is an array, if not make it an array
    const ruleArray = Array.isArray(rule) ? rule : [rule];

    // map each rule array object to a SQL condition
    const conditions = ruleArray.map((ruleObj) => {
        const { event_name, retention } = ruleObj;
        return `(UNIX_TIMESTAMP(event_time) > UNIX_TIMESTAMP(NOW() - ${retention}) AND event_name = '${event_name}')`;
    });

    console.info(`Conditions: ${conditions}`)

    // join the conditions with OR
    const conditionsStr = conditions.join(' OR ');

    // frame the SQL query
    const query = `SELECT user_name, user_phone, MAX(event_time) as event_time FROM events WHERE (${conditionsStr}) GROUP BY 1, 2`;

    console.info(`Query: ${query}`);

    return query;
}

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
