// Copyright (c) Facebook, Inc. and its affiliates.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import { SecretsManager } from '@aws-sdk/client-secrets-manager';
import mysql from 'mysql';
import axios from 'axios';
import { promisify } from 'util';

// Environment variables for database connection
const db_host = process.env.DB_HOST;
const db_user = process.env.DB_USER;
const dbSecretArn = process.env.DB_SECRET_ARN;
const db_name = process.env.DB_NAME;
const capiTokenArn = process.env.CAPI_TOKEN_SECRET_ARN;
const capi_integration_enabled = process.env.CAPI_INTEGRATION_ENABLED;
const capi_page_id = process.env.CAPI_PAGE_ID;
const capi_datasource_id = process.env.CAPI_DATASOURCE_ID;
const capi_graphapi_version = process.env.CAPI_GRAPHAPI_VERSION;


let dbPass;
let connection;

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

        if (referral) {
            await queryDatabase(
                connection,
                'INSERT INTO capi_signals (ctwa_clid, source_id, raw_payload, event_timestamp, business_phone_number_id, consumer_phone_number) VALUES (?, ?, ?, ?, ?, ?)',
                [referral.ctwa_clid, referral.source_id, JSON.stringify(referral), new Date(Number.parseInt(message.timestamp) * 1000), businessNumberId, consumerNumber]
            );
        }


        console.info('Fetching all keywords from database');
        const keywords = await queryDatabase(connection, 'SELECT id, keyword, capi_event, capi_event_custom_data FROM keywords');
        // Extract keywords and their corresponding IDs
        const keywordMap = new Map();
        for (const row of keywords) {
            keywordMap.set(row.keyword, { id: row.id, capi_event: row.capi_event, capi_event_custom_data: row.capi_event_custom_data });
        }

        console.info('Searching keywords in the message body');
        const matchingKeywords = [];
        for (const [keyword, data] of keywordMap.entries()) {
            if (messageBodyText.includes(keyword)) {
                matchingKeywords.push({ id: data.id, keyword, capi_event: data.capi_event, capi_event_custom_data: data.capi_event_custom_data });
            }
        }

        console.info(`${matchingKeywords.length} keywords found in the message body`);
        if (matchingKeywords.length > 0) {
            for (const { id, keyword, capi_event, capi_event_custom_data } of matchingKeywords) {
                console.log('Updating signals table for keyword: ' + keyword);
                await queryDatabase(
                    connection,
                    'INSERT INTO signals (keyword_id, business_phone_number_id, consumer_phone_number) VALUES (?, ?, ?)',
                    [id, businessNumberId, consumerNumber]
                );
                if (capi_integration_enabled == "true" && capi_event != null) {
                    await sendCapiEvent(capi_event, capi_event_custom_data, businessNumberId, consumerNumber);
                }
            }
        }
        return generateResponse(200, {});
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        if (connection) connection.destroy();
    }
};

const sendCapiEvent = async (eventName, capi_event_custom_data, businessNumberId, consumerNumber) => {
    const fetch_rules_query = `SELECT ctwa_clid, event_timestamp FROM capi_signals WHERE business_phone_number_id = ${businessNumberId} and consumer_phone_number = ${consumerNumber} order by event_timestamp desc limit 1`;
    const fetch_rules_result = await queryDatabase(connection, fetch_rules_query);
    if (fetch_rules_result.length == 0) {
        return;
    }

    const lastCtwaClid = fetch_rules_result[0].ctwa_clid;
    const event_timestamp = fetch_rules_result[0].event_timestamp;

    const access_token = await getCAPIToken();
    let data =  {
        action_source: "business_messaging",
        messaging_channel: "whatsapp",
        event_name: eventName,
        event_time: event_timestamp,
        user_data: {
            page_id: capi_page_id,
            ctwa_clid: lastCtwaClid,
        }
    }

    if (capi_event_custom_data != null) {
        data.custom_data = JSON.parse(capi_event_custom_data);
    }
    const requestBody = JSON.stringify({
        data: [
            data
        ]
    });

    console.info("Request body:\n", requestBody);

    const responseOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': requestBody.length
        }
    };

    let url = `https://graph.facebook.com/v${capi_graphapi_version}/${capi_datasource_id}/events?access_token=${access_token}`;
    try {
        let response = await axios.post(url, requestBody, responseOptions);

        console.info('CAPI response Success', response);
    } catch (error) {
        console.error('CAPI response Error:', error.response);
        throw new Error('Could not send CAPI response');
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
        password: dbPass,
        database: db_name
    });
};

// Helper function to get the database password from AWS Secrets Manager
const getDatabasePassword = async () => {
    try {
        console.info('Getting password');
        const client = new SecretsManager();
        const data = await client.getSecretValue({ SecretId: dbSecretArn });
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

// Helper function to get the database password from AWS Secrets Manager
const getCAPIToken = async () => {
    try {
        console.info('Getting CAPI token');
        const client = new SecretsManager();
        const data = await client.getSecretValue({ SecretId: capiTokenArn });
        console.info('Parsing token');
        if ('SecretString' in data) {
            const secret = JSON.parse(data.SecretString);
            return secret.CAPISecurityToken;
        } else {
            const decodedBinarySecret = Buffer.from(data.SecretBinary, 'base64');
            return decodedBinarySecret.toString();
        }
    } catch (error) {
        console.error(error);
        throw error;
    }
};
