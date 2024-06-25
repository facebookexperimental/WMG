// Copyright (c) Facebook, Inc. and its affiliates.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import functions from '@google-cloud/functions-framework';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { PubSub } from '@google-cloud/pubsub';

import crypto from 'crypto';
import fetch from 'node-fetch';
import mysql from 'mysql';
import { promisify } from 'util';

// Environment variables for database connection
const db_host = process.env.DB_HOST;
const db_user = process.env.DB_USER;
const db_name = process.env.DB_NAME;
const db_secret_name = process.env.DB_SECRET_NAME;
let db_pass;

const pubSubClient = new PubSub();

functions.http('router_handler', async (event, response) => {
    response.setHeader('Content-Type', 'application/json');

    let connection;
    try {
        // Parse the request body into a JSON object
        let request_data = event.body;
        if (request_data.type == 'template') {
            // Connect to the database
            db_pass = await getDatabasePassword();
            connection = createConnection();

            // Check if there is an active lift study
            const activeStudyId = await getActiveStudyId(connection);
            if (activeStudyId != null) {
                console.info('Active lift study found.');
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

                    response.statusCode = 200;
                    response.send(JSON.stringify({ message: 'Message dropped because the phone number is in control group' }));
                    return;
                }
                else if (phoneGroup == 'test'){
                    // Increment the messages counter if the phone group is test
                    await incrementMessagesCount(connection, activeStudyId);
                    console.info('Incremented lift study messages count.');
                }
            }
        }

        console.info('Replay request to Cloud API');
        const businessNumberId = event.query.business_phone_number_id;
        const endpoint = `https://graph.facebook.com/v17.0/${businessNumberId}/messages`;
        const headers = {
            'Authorization': event.headers['x-forwarded-authorization'],
            'Content-Type': event.headers['content-type'],
        };
        const requestOptions = {
            headers,
            method: 'POST',
            body: JSON.stringify(event.body),
        };
        console.log('Replay request to Cloud API:', requestOptions);

        const responseCloudAPI = await fetch(endpoint, requestOptions);

        const data = await responseCloudAPI.json();

        // Check if the HTTP request was successful
        if (responseCloudAPI.status === 200) {
            console.info("HTTP Request Successful. Enqueuing...");

            const topicName = process.env.TOPIC_NAME;
            const messageContent = JSON.stringify({
                body: {...event.body, business_number_id: businessNumberId },
            });
            const sendMessageResponse = publishMessage(topicName, messageContent);

            console.info("Successfully enqueued to queue. Message ID:", sendMessageResponse.messageId);
        } else {
            console.error("Error:", data);
        }

        response.statusCode = responseCloudAPI.status;
        response.send(JSON.stringify(data));
        return;
    } catch (error) {
        console.error("Error:", error);

        response.statusCode = 500;
        response.send(JSON.stringify({ message: 'WMG - Internal Server Error' }));
        return;
    }
});

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

async function publishMessage(topicNameOrId, data) {
    // Publishes the message as a string, e.g. "Hello, world!" or JSON.stringify(someObject)
    const dataBuffer = Buffer.from(data);

    try {
      const messageId = await pubSubClient
        .topic(topicNameOrId)
        .publishMessage({data: dataBuffer});
      console.log(`Message ${messageId} published.`);
    } catch (error) {
      console.error('Error while publishing:', error);
      throw error;
    }

    return { messageId: messageId };
  }
