import AWS from 'aws-sdk';
import fetch from 'node-fetch';

AWS.config.update({ region: 'sa-east-1' });
const sqs = new AWS.SQS();
export const lambdaHandler = async (event, context) => {
    try {
        console.info('Replay request to Cloud API');
        const businessNumberId = event.pathParameters.business_phone_number_id;
        const endpoint = `https://graph.facebook.com/v17.0/${businessNumberId}/messages`; // assuming there are no query params
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
            const data = await response.json();
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
