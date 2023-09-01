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
    let connection;
    try {
        db_pass = await getDatabasePassword();
        connection = createConnection();

        const records = event.Records;
        for (const record of records) {
            console.info('Parsing body:', record.body);
            const recordBody = JSON.parse(record.body);
            const messageBodyText = record.body;
            const business_number = recordBody.business_number;
            const consumer_number = recordBody.to;

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
                if (messageBodyText.includes(keyword)) {
                    matchingKeywords.push({ id, keyword });
                }
            }

            console.info(`${matchingKeywords.length} keywords found in the message body`);
            if (matchingKeywords.length > 0) {
                for (const { id, keyword } of matchingKeywords) {
                    console.log('Updating signals table for keyword: ' + keyword);
                    await queryDatabase(
                        connection,
                        'INSERT INTO signals (keyword_id, business_number, consumer_number) VALUES (?, ?, ?)',
                        [id, business_number, consumer_number]
                    );
                }
            }
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        // Close the database connection
        if(connection) connection.end();
    }
}

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
