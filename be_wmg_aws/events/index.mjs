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

    let connection;
    try {
        db_pass = await getDatabasePassword();
        connection = createConnection();

        // Note: We don't need to support "GET" requests as the volume of events could be huge.
        // For example, we have clients that send 10s of millions of events in a day, if we have this endpoint open,
        // it's likely that the request will fail overall.

        // This has been added only for testing purposes. Please remove this once the testing is done.
        if (httpMethod === 'GET') {
            console.info("Received Events GET All request");
            const result = await queryDatabase(connection, 'SELECT user_name, user_phone, event_name, event_time, event_raw_data FROM events');

            return generateResponse(200, { result });
        } else if (httpMethod === 'POST') {
            const queryParams = event.queryStringParameters || {};
            const su_access_token = queryParams.access_token;
            const wacs_id = queryParams.wacs_id;

            console.info('Received Events POST request!!!!');

            let { data } = JSON.parse(event.body);
            console.info('Data: ', data);

            for (let i = 0; i < data.length; i++) {
                const event = data[i];

                let { event_name, event_time, user_data } = event;

                let { fn, ph } = user_data;

                if (isAlreadyHashed(fn) || isAlreadyHashed(ph)) {
                    return generateResponse(400, { message: 'The event: ' + event_name + 'contains hashed fields' });
                }

                // If either phone number or first name is empty, we return an error
                if (!fn || !ph) {
                    return generateResponse(400, { message: 'The event: ' + event_name + 'is missing required fields' });
                }

                let insert_query = 'INSERT INTO events (user_name, user_phone, event_name, event_time, event_raw_data) VALUES (?, ?, ?, ?, ?)';
                const result = await queryDatabase(connection, insert_query, [fn, ph, event_name, event_time, JSON.stringify(event)]);

                // Fetch all the rules that match the event name
                const fetch_rules_query = `SELECT name as rule_name, query, subscriber_list_id FROM audience_rules WHERE include like '%${event_name}%' OR exclude like '%${event_name}%'`;
                const fetch_rules_result = await queryDatabase(connection, fetch_rules_query);

                // For each rule, check if the user matches the rule criteria
                for (let i = 0; i < fetch_rules_result.length; i++) {
                    const rule_name = fetch_rules_result[i].rule_name;
                    const query = fetch_rules_result[i].query;
                    const subscriber_list_id = fetch_rules_result[i].subscriber_list_id;
                    console.info('Rule: ', rule_name, 'Executing SQL Query: ', query, 'Subscriber List Id: ', subscriber_list_id);

                    // Check if the user matches the rule criteria
                    const does_user_match_rule = await checkIfUserMatchesRule(connection, query, fn, ph);

                    console.info('Does User Match Rule: ', does_user_match_rule);

                    // If the user doesn't match the rule, continue to the next rule
                    if (!does_user_match_rule) {
                        continue;
                    }

                    // Insert into subscriber list table
                    const insert_into_subscriber_list_table_query = `INSERT INTO subscriber_list (user_name, user_phone, subscriber_list_id) VALUES ('${fn}', '${ph}', ${subscriber_list_id})`;
                    await queryDatabase(insert_into_subscriber_list_table_query);

                    // Add the users to the subscriber list
                    await updateSubscriberList(subscriber_name, subscriber_phone, subscriber_list_id, su_access_token, wacs_id);
                }

                return generateResponse(200, { user_name: fn, user_name: fn, user_phone: ph });
            }

            return generateResponse(400, { message: 'No data received from the endpoint!' });

        }
        // Note: This has been added only for testing purposes. Please remove this once the testing is done.
        else if (httpMethod === 'DELETE') {
            console.info('Received Events DELETE request');
            // Delete all the rows from the table
            const delete_query = 'DELETE FROM events';

            const result = await queryDatabase(connection, delete_query);
            return generateResponse(200, { message: 'Successfully deleted all the events data' });

        } else {
            return generateResponse(405, { message: 'Method Not Supported' });
        }
    } catch (error) {
        console.error(error);
        return generateResponse(500, { message: 'Internal Server Error + ', error });
    } finally {
        console.info("Inside finally")
        // Close the database connection
        if (connection) connection.destroy();
    }
};

// Helper function to check if a user matches a rule
const checkIfUserMatchesRule = async (connection, query, fn, ph) => {
    let check_if_user_matches_rule_query = 'SELECT * FROM (' + query + ') as subquery where user_name = "' + fn + '" and user_phone = ' + ph + '';
    const check_if_user_matches_rule_result = await queryDatabase(connection, check_if_user_matches_rule_query);

    console.info('Check User Matches Rule Result: ', check_if_user_matches_rule_result);

    if (check_if_user_matches_rule_result.length > 0) {
        return true;
    }
    else {
        return false;
    }
}

const isAlreadyHashed = (input) => {
    return input && (input.match('^[A-Fa-f0-9]{64}$') != null);
}

const updateSubscriberList = async (subscriber_name, subscriber_phone, subscriber_list_id, su_access_token, wacs_id) => {
    console.info('Adding to Subscriber List');

    const url = 'https://graph.facebook.com/v18.0/' + wacs_id + '/subscribers';
    const access_token = su_access_token; // Need to come from query params

    const subscribers = {
        subscribers: [{
            fn: subscriber_name,
            phone: subscriber_phone,
            add_to_subscriber_lists: [subscriber_list_id]
        }]
    };

    try {
        const response = await axios.post(url, subscribers, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${access_token}`,
            },
        });

        console.info('Response on adding subscribers: ', response);
        return response.data;
    }
    catch (error) {
        console.info(error);
        throw error;
    }

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
