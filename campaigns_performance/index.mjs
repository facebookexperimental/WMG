import AWS from 'aws-sdk';
import mysql from 'mysql';
import { promisify } from 'util';
import fetch from 'node-fetch';

const db_host = process.env.DB_HOST;
const db_user = process.env.DB_USER;
const db_secret_arn = process.env.DB_SECRET_ARN;
const db_name = process.env.DB_NAME;
let db_pass;

AWS.config.update({ region: 'sa-east-1' });
const s3 = new AWS.S3();

export const lambdaHandler = async (event, context) => {
    let connection;
    try {
        // Extract and validate query parameters
        const { wabaId, startDate, endDate, startTimeUnix, endTimeUnix } = validateQueryParameters(event);
        const accessToken = event.headers?.Authorization?.substring(7); // remove "Bearer " prefix;
        console.info('Params: ', wabaId, startDate, endDate, startTimeUnix, endTimeUnix);

        db_pass = await getDatabasePassword();
        connection = createConnection();

        console.info('Fecthing signal counts');
        const signalCountsQuery = `
            SELECT s.business_phone_number_id as businessNumberId, k.signal, COUNT(*) AS signalCount
            FROM signals s
            JOIN keywords k ON s.keyword_id = k.id
            ${startDate ? `WHERE s.created_at >= ? AND s.created_at <= ?`: ``}
            GROUP BY s.business_phone_number_id, k.signal
        `;
        const signalCountsResult = await queryDatabase(connection, signalCountsQuery, [startDate, endDate]);
        connection.destroy();

        // Prepare a map to store signal counts for each business number
        const signalCountMap = new Map();
        const uniqueSignalTypes = new Set();
        signalCountsResult.forEach(({businessNumberId, signal, signalCount}) => {
            uniqueSignalTypes.add(signal);

            if (!signalCountMap.has(businessNumberId)) {
                signalCountMap.set(businessNumberId, {});
            }
            signalCountMap.get(businessNumberId)[signal] = signalCount;
        });

        // Prepare CSV header based on retrieved unique signal types
        const uniqueSignalTypesArray = [...uniqueSignalTypes];
        const headerRow = ['Business Number', 'Conversations', ...uniqueSignalTypesArray].join(',') + '\n';

        // Fetch conversation analytics and waba numbers
        const conversationsByBizNumber = await fetchConversationByBussinessNumber(accessToken, wabaId, startTimeUnix, endTimeUnix);
        const businessNumbersById = await fetchBusinnessNumbersById(accessToken, wabaId);

        // Prepare CSV content with dynamic signal columns
        console.info('Generating csv');
        let csvContent = headerRow;
        signalCountMap.forEach((signalCounts, businessNumberId) => {
            const businessNumber = businessNumbersById[businessNumberId];
            const defaultValue = businessNumber ? 0 : 'N/A'; // N/A means this number doesn't belong to the waba or there was an error when retrieving it

            const conversationCount = conversationsByBizNumber[businessNumber] !== undefined
                ? conversationsByBizNumber[businessNumber]
                : defaultValue;

            const signalValues = uniqueSignalTypesArray.map((signalType) => signalCounts[signalType] || 0);
            csvContent += `${businessNumber || businessNumberId},${conversationCount},${signalValues.join(',')}\n`;
        });

        // Upload CSV to S3
        const bucketName = process.env.BUCKET_NAME;
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const fileName = `wmg_campaigns_performance_${timestamp}.csv`;
        console.info(`Uploading to S3 bucket ${bucketName} with name: ${fileName}`);
        await s3.putObject({
            Bucket: bucketName,
            Key: fileName,
            Body: csvContent
        }).promise();

        // Return CSV content as response
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${fileName}"`
            },
            body: csvContent
        };
    } catch (error) {
        console.error(error);
        if (error instanceof ValidationError) {
            // Return a 400 Bad Request error for validation errors
            return {
                statusCode: error.statusCode,
                body: JSON.stringify({ message: 'Bad Request', error: error.message }),
            };
        } else {
            // Handle other types of errors
            return {
                statusCode: 500,
                body: JSON.stringify({ message: 'Internal Server Error', error: error.message }),
            };
        }
    }
};

class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
        this.statusCode = 400;
    }
}

// Helper function to extract and validate query parameters
const validateQueryParameters = (event) => {
    console.info('Validating parameters');
    // Helper function to validate a parameter exists and is not empty
    const validateWabaId = (param, paramName) => {
        if (!param || param.trim() === '') {
            throw new ValidationError(`Missing or empty parameter: ${paramName}. Send waba_id in the path parameter: myurl/<waba_id>?start_date=<unix_start_date>&end_date=<unix_end_date>`);
        }
    };

    // Helper function to validate a parameter is a positive integer
    const validateDate = (date, paramName) => {
        const value = parseInt(date, 10);
        if (date !== undefined && (isNaN(value) || value < 0)) {
            throw new ValidationError(`Invalid ${paramName}: ${date}. It must be a unix timestamp.`);
        }
    };

    // Helper function to validate that end_date is greater than start_date
    const validateDateRange = (startTime, endTime) => {
        if (startTime && !endTime || !startTime && endTime) {
            throw new ValidationError('You must provide both dates or none');
        }

        if (startTime && endTime && startTime >= endTime) {
            throw new ValidationError('Invalid date range: end_date must be greater than start_date');
        }
    };

    const queryParams = event.queryStringParameters || {};
    const wabaId = event.pathParameters && event.pathParameters.waba_id;
    const startTimeUnix = queryParams.start_time;
    const endTimeUnix = queryParams.end_time;

    // Validate parameters
    validateWabaId(wabaId, 'waba_id');
    validateDate(startTimeUnix, 'start_time');
    validateDate(endTimeUnix, 'end_time');
    validateDateRange(startTimeUnix, endTimeUnix);

    // Convert timestamps to Date objects
    const startDate = startTimeUnix && new Date(parseInt(startTimeUnix, 10) * 1000);
    const endDate = endTimeUnix && new Date(parseInt(endTimeUnix, 10) * 1000);

    return {
        wabaId,
        startDate,
        endDate,
        startTimeUnix,
        endTimeUnix,
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

// Helper function to fetch conversation analytics data from Facebook API
const fetchConversationByBussinessNumber = async (accessToken, wabaId, startTimeUnix, endTimeUnix) => {
    try {
        console.info('Fetching conversation analytics for waba ' + wabaId);

        // Set default values for startDate and endDate so that we bring all data
        const defaultStartDate = 0; // Begining of time
        const defaultEndDate = Math.floor(Date.now() / 1000); // Current time in UNIX timestamp
        const apiUrl = `https://graph.facebook.com/v17.0/${wabaId}?access_token=${
                accessToken
            }&fields=conversation_analytics.start(${
                startTimeUnix || defaultStartDate
            }).end(${endTimeUnix || defaultEndDate}).granularity(MONTHLY).dimensions(["PHONE"])`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        if (response.status !== 200) throw new Error(JSON.stringify(data));

        const dataPoints = data?.conversation_analytics?.data[0]?.data_points || [];

        const conversationData = {};
        dataPoints.forEach(dataPoint => {
            const businessPhoneNumber = dataPoint.phone_number.replace(/\D/g, ''); // only digits
            const conversationCount = dataPoint.conversation;

            if (conversationData[businessPhoneNumber]) {
                conversationData[businessPhoneNumber] += conversationCount;
            } else {
                conversationData[businessPhoneNumber] = conversationCount;
            }
        });

        return conversationData;
    } catch (error) {
        console.error(error);
        return {};
    }
};

const fetchBusinnessNumbersById = async (accessToken, wabaId) => {
    try {
        console.info('Fetching waba numbers');
        const apiUrl = `https://graph.facebook.com/v17.0/${wabaId}/phone_numbers?access_token=${accessToken}`;
        const response = await fetch(apiUrl);
        const responseJson = await response.json();
        if (response.status !== 200) throw new Error(JSON.stringify(responseJson));

        return (responseJson.data || []).reduce((result, phoneNumberData) => {
            result[phoneNumberData.id] = phoneNumberData.display_phone_number.replace(/\D/g, ''); // only digits
            return result;
        }, {});
    }
    catch (error) {
       console.error(error);
       return {};
    }
}
