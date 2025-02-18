// Copyright (c) Facebook, Inc. and its affiliates.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import AWS from 'aws-sdk';
import crypto from 'crypto';
import fetch from 'node-fetch';
import mysql from 'mysql';
import { promisify } from 'util';

// Environment variables for database connection
const db_host = process.env.DB_HOST;
const db_user = process.env.DB_USER;
const dbSecretArn = process.env.DB_SECRET_ARN;
const db_name = process.env.DB_NAME;
let dbPass;

const sqs = new AWS.SQS();
export const lambdaHandler = async (event, context) => {
    let connection;
    try {
        // Specific handling for lift study logic, as it shouldn't break the main routing flow
        try {
            // Parse the request body into a JSON object
            let request_data = JSON.parse(event.body);
            if (request_data.type == 'template') {
                // Connect to the database
                dbPass = await getDatabasePassword();
                connection = createConnection();

                // Check if there is an active lift study
                const activeStudyId = await getActiveStudyId(connection);
                if (activeStudyId != null) {
                    console.info('Active lift study found.');
                    // Check if this is an initial template for the active study
                    const templateName = request_data.template.name;
                    const lift_study_templates = await getStudyTemplates(connection, activeStudyId);
                    console.info('Checking if template ' + templateName + ' is in the study templates: ' + lift_study_templates.toString());
                    if (lift_study_templates.includes(templateName)) {
                        // Check if the phone number is already assigned to a group
                        const phoneNumber = request_data.to;
                        let phoneGroup = await getPhoneGroup(connection, activeStudyId, phoneNumber);
                        if (phoneGroup == null) {
                            console.info('Phone not assigned to any group.');
                            // The phone number is not assigned to any group, check if both groups are available for assignment
                            const groupsStatus = await getGroupsStatus(connection, activeStudyId);
                            if (groupsStatus.control_full == 0 && groupsStatus.test_full == 0) {
                                // Randomly assign the phone to either group
                                const randomByte = crypto.randomBytes(1)[0];
                                phoneGroup = randomByte < 128 ? 'test' : 'control';
                                await assignPhoneToGroup(connection, activeStudyId, phoneNumber, phoneGroup);
                                console.info('Phone randomly assigned to group: ' + phoneGroup);
                            }
                            // If at least one group is full, check if only one group is full
                            else if (groupsStatus.control_full == 0 || groupsStatus.test_full == 0) {
                                // Only one group is full, assign the phone number to the other group
                                phoneGroup = groupsStatus.control_full == 0 ? 'control' : 'test';
                                await assignPhoneToGroup(connection, activeStudyId, phoneNumber, phoneGroup);
                                console.info('Phone assigned to group: ' + phoneGroup);
                            }
                            // If both groups are full, none of the blocks above run and no group is assigned
                        }

                        if (phoneGroup == 'control') {
                            // Drop the message if the phone group is control
                            console.info('Message dropped: phone number in control group');
                            return {
                                statusCode: 200,
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    "messaging_product": "whatsapp",
                                    "contacts": [
                                        {
                                            "input": phoneNumber,
                                            "wa_id": phoneNumber
                                        }
                                    ],
                                    "messages": [
                                        {
                                            "id": "wamid." + crypto.randomBytes(28).toString('hex'),
                                            "message_status": "accepted"
                                        }
                                    ]
                                })
                            };
                        }
                        else if (phoneGroup == 'test'){
                            // Increment the messages counter if the phone group is test
                            await incrementMessagesCount(connection, activeStudyId);
                            console.info('Incremented lift study messages count.');
                        }
                    }
                }
            }
        }
        catch (error) {
            console.error("Error while running lift study:", error);
        }

        console.info('Replay request to Cloud API');
        const businessNumberId = event.pathParameters.business_phone_number_id;
        const endpoint = `https://graph.facebook.com/v17.0/${businessNumberId}/messages`;
        const headers = {
            'Authorization': event.headers['Authorization'],
            'Content-Type': event.headers['Content-Type'],
        };
        const requestOptions = {
            headers,
            method: 'POST',
            body: event.body,
        };
        const response = await fetch(endpoint, requestOptions);
        const data = await response.json();

        // Check if the HTTP request was successful
        if (response.status === 200) {
            console.info("HTTP Request Successful. Enqueuing...");

            const queueUrl = process.env.QUEUE_URL;
            const params = {
                MessageBody: JSON.stringify({...JSON.parse(event.body), business_number_id: businessNumberId }),
                QueueUrl: queueUrl
            };
            const sendMessageResponse = await sqs.sendMessage(params).promise();

            console.info("Successfully enqueued to queue. Message ID:", sendMessageResponse.MessageId);
        } else {
            console.error("Error:", data);
        }

        return {
            statusCode: response.status,
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error("Error:", error);

        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'WMG - Internal Server Error' })
        };
    }
};

// Helper function to get the id of the active study
const getActiveStudyId = async (connection) => {
    const queryStr = `
      SELECT id
      FROM lift_studies
      WHERE status = 'active'
        AND start_date <= CURRENT_DATE
        AND end_date >= CURRENT_DATE;
    `;

    const activeStudy = await queryDatabase(connection, queryStr);

    return activeStudy.length == 1 ? activeStudy[0].id : null;
};

// Helper function to get the list of templates for a given study
const getStudyTemplates = async (connection, studyId) => {
    const queryStr = `
      SELECT template_names
      FROM lift_studies
      WHERE id = ?;
    `;
    const study_templates = await queryDatabase(connection, queryStr, [studyId]);

    return study_templates.length == 1 ? study_templates[0].template_names.split(",") : [];
}

// Helper function to get the group of a given phone number for a given study
const getPhoneGroup = async (connection, studyId, phoneNumber) => {
    const queryStr = `
      SELECT group_name
      FROM lift_studies_groups
      WHERE study_id = ?
        AND phone_number = ?
    `;

    const phoneGroup = await queryDatabase(connection, queryStr, [studyId, phoneNumber]);

    return phoneGroup.length == 1 ? phoneGroup[0].group_name : null;
};

// Helper function to get the group of a given phone number for a given study
const getGroupsStatus = async (connection, studyId) => {
    const queryStr = `
      SELECT
        (control_group_size = sample_size) AS control_full,
        (test_group_size = sample_size) AS test_full
      FROM lift_studies
      WHERE id = ?
    `;

    const groupsStatus = await queryDatabase(connection, queryStr, [studyId]);

    return groupsStatus[0];
};

// Helper function to set the group of a given phone number for a given study
const assignPhoneToGroup = async (connection, studyId, phoneNumber, groupName) => {
    const strGroupQuery = `
      INSERT INTO lift_studies_groups (study_id, phone_number, group_name)
      VALUES (?, ?, ?);
    `;
    const incrementCountQuery = `
      UPDATE lift_studies
      SET ${groupName}_group_size = ${groupName}_group_size + 1
      WHERE id = ?;
    `;

    try {
        await connection.beginTransaction();

        await queryDatabase(connection, strGroupQuery, [studyId, phoneNumber, groupName]);
        await queryDatabase(connection, incrementCountQuery, [studyId]);

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    }
};

// Helper function to increment the count of messages sent for a given study
const incrementMessagesCount = async (connection, studyId) => {
    const queryStr = `
      UPDATE lift_studies
      SET messages_count = messages_count + 1
      WHERE id = ?;
    `;

    await queryDatabase(connection, queryStr, [studyId]);
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
