import AWS from 'aws-sdk';

AWS.config.update({ region: 'sa-east-1' });
const sqs = new AWS.SQS();
export const lambdaHandler = async (event, context) => {
    console.log('Incoming request ' + JSON.stringify(event));

    try {
        // Get the API request from the event
        const apiRequest = JSON.parse(event.body);

        // Get the endpoint to replay the request to
        const endpoint = 'graph.facebook.com/v17/' + apiRequest.endpoint;

        // Make the request to the endpoint
        const client = new AWS.Request('POST', endpoint);
        client.headers = apiRequest.headers;
        const response = await client.send();

        // Check if the HTTP request was successful
        if (response.statusCode === 200) {
            console.log("HTTP Request Successful. Status Code:", response.statusCode);

            const queueUrl = process.env.QUEUE_URL;
            const params = {
                MessageBody: JSON.stringify(event),
                QueueUrl: queueUrl
            };

            // Send a message to the SQS queue
            const sendMessageResponse = await sqs.sendMessage(params).promise();

            console.log("Successfully enqueued to queue. Message ID:", sendMessageResponse.MessageId);
        } else {
            console.error("HTTP Request Failed. Status Code:", response.statusCode);
        }

        // Return the response
        return {
            statusCode: response.statusCode,
            body: response.body
        };
    } catch (error) {
        console.error("Error:", error);

        // Handle errors and return an appropriate response
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal Server Error' })
        };
    }
};
