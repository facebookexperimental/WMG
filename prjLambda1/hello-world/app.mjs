/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */

// export const lambdaHandler = async (event, context) => {
//     try {
//         console.info('HTTP trigger fired! Biz Eng rules!');
//         console.info(JSON.stringify(event));

//         return {
//             'statusCode': 200,
//             'body': JSON.stringify({
//                 message: 'hello world - biz eng rules, we will rock you!!!',
//             })
//         }
//     } catch (err) {
//         console.log(err);
//         return err;
//     }
// };

import AWS from 'aws-sdk';
const s3 = new AWS.S3();

export const handler = async (event, context) => {
    try {
        // Create CSV content
        const csvContent = "Name,Age\nJohn,30\nJane,28";

        // Specify bucket name and file name
        const bucketName = 'wmg-output';
        const fileName = 'output_datetime.csv';

        // Upload CSV to S3
        await s3.putObject({
            Bucket: bucketName,
            Key: fileName,
            Body: csvContent
        }).promise();

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'CSV file created and uploaded successfully' })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Error creating or uploading CSV file', error: error.message })
        };
    }
};
