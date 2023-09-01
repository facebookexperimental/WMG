import AWS from 'aws-sdk';
import mysql from 'mysql';
import { promisify } from 'util';

// Environment variables for database connection
const db_host = process.env.DB_HOST;
const db_user = process.env.DB_USER;
const db_secret_arn = process.env.DB_SECRET_ARN;
const db_name = process.env.DB_NAME;
let db_pass;

const s3 = new AWS.S3({apiVersion: '2006-03-01'});
export const lambdaHandler = async (event, context) => {
    let connection;
    try {
        db_pass = await getDatabasePassword();
        connection = createConnection();

        // // Create CSV content
        // const csvContent = "Name,Age\nJohn,30\nJane,28";

        const signalCountsQuery = `
            SELECT s.business_number, k.signal, COUNT(*) AS signal_count
            FROM signals s
            JOIN keywords k ON s.keyword_id = k.id
            GROUP BY s.business_number, k.signal
        `;
        const signalCountsResult = await queryDatabase(connection, signalCountsQuery);

        // Close the database connection
        connection.end();

        // Prepare a map to store signal counts for each business number
        const signalCountMap = new Map();
        const uniqueSignalTypes = new Set();

        signalCountsResult.forEach((row) => {
            const businessNumber = row.business_number;
            const signalType = row.signal;
            const signalCount = row.signal_count;

            // Add the signal type to the set of unique signal types
            uniqueSignalTypes.add(signalType);

            if (!signalCountMap.has(businessNumber)) {
                signalCountMap.set(businessNumber, {});
            }

            signalCountMap.get(businessNumber)[signalType] = signalCount;
        });

        // Convert the set of unique signal types to an array
        const uniqueSignalTypesArray = [...uniqueSignalTypes];

        // Prepare CSV header based on retrieved unique signal types
        const headerRow = ['Business Number', ...uniqueSignalTypesArray].join(',') + '\n';

        // Create CSV content with dynamic signal columns
        let csvContent = headerRow;
        signalCountMap.forEach((signalCounts, businessNumber) => {
            const signalValues = uniqueSignalTypesArray.map((signalType) => signalCounts[signalType] || 0);
            csvContent += `${businessNumber},${signalValues.join(',')}\n`;
        });

        // Specify bucket name and file name
        const bucketName = process.env.BUCKET_NAME;
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const fileName = `wmg_campaigns_performance_${timestamp}.csv`;

        // Upload CSV to S3
        await s3.putObject({
            Bucket: bucketName,
            Key: fileName,
            Body: csvContent
        }).promise();

        // Prepare response headers
        const headers = {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${fileName}"`
        };

        // Return CSV content as response
        return {
            statusCode: 200,
            headers: headers,
            body: csvContent
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Error creating, uploading, or downloading CSV file', error: error.message })
        };
    }
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
