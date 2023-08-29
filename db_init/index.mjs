import AWS from 'aws-sdk';
import mysql from 'mysql';
import { promisify } from 'util';
import axios from 'axios';

// Environment variables for database connection
const db_host = process.env.DB_HOST;
const db_user = process.env.DB_USER;
const db_secret_arn = process.env.DB_SECRET_ARN;
const db_name = process.env.DB_NAME;

export const lambdaHandler = async (event, context) => {
    const responseData = {};
    let responseStatus = 'SUCCESS';
    if (event.RequestType == 'Delete') {
      await sendResponse(event, context, responseStatus, responseData);
      return true;
    }

    let db_pass;
    try {
        const client = new AWS.SecretsManager();
        const data = await client.getSecretValue({ SecretId: db_secret_arn }).promise();

        if ('SecretString' in data) {
          const secret = JSON.parse(data.SecretString);
          const dbPassword = secret.password;
          db_pass = dbPassword;
          console.log(`Retrieved DB Password: ${dbPassword}`);
        } else {
          // Handle binary secret if needed
          const decodedBinarySecret = Buffer.from(data.SecretBinary, 'base64');
          db_pass = decodedBinarySecret.toString();
          console.log(`Retrieved DB Password: ${decodedBinarySecret.toString()}`);
        }
    // Now you can use 'dbPassword' in your database connection logic.
    } catch (error) {
        console.error(error);
        responseStatus = 'FAILED';
        await sendResponse(event, context, responseStatus, responseData);
        return true;
    }

    // Connect to the database
    const connection = mysql.createConnection({
        host: db_host,
        user: db_user,
        password: db_pass,
        database: db_name
    });

    const query = promisify(connection.query).bind(connection);

    try {
      await query(`
        CREATE TABLE IF NOT EXISTS keywords (
          id INT AUTO_INCREMENT PRIMARY KEY,
          keyword VARCHAR(200) UNIQUE,
          \`signal\` VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS signals (
          id INT AUTO_INCREMENT PRIMARY KEY,
          keyword_id INT,
          business_number VARCHAR(20),
          consumer_number VARCHAR(20),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (keyword_id) REFERENCES keywords(id)
        )
      `);
    } catch (error) {
        console.error(error);
        responseStatus = 'FAILED';
    } finally {
      // Close the database connection
      if(connection) connection.end();

      await sendResponse(event, context, responseStatus, responseData);
    }
    return true;
};

// CloudFormation uses a pre-signed S3 URL to receive the response back from the custom resources managed by it. This is a simple function
// which shall be used to send the response back to CFN custom resource by performing PUT request to the pre-signed S3 URL.
async function sendResponse(event, context, responseStatus, responseData, physicalResourceId=null) {
  const responseBody = JSON.stringify({
    Status: responseStatus,
    Reason: "See the details in CloudWatch Log Stream: " + context.logStreamName,
    PhysicalResourceId: physicalResourceId || context.logStreamName,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: responseData
  });

  console.info("Response body:\n", responseBody);

  const responseOptions = {
    headers: {
      'Content-Type': '',
      'Content-Length': responseBody.length
    }
  };

  try {
    await axios.put(event.ResponseURL, responseBody, responseOptions);

    console.info('CloudFormationSendResponse Success');
  } catch (error) {
    console.error('CloudFormationSendResponse Error:', error);
    throw new Error('Could not send CloudFormation response');
  }
}
