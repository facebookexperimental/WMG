import AWS from 'aws-sdk';
AWS.config.update({region: 'sa-east-1'});
var sqs = new AWS.SQS({apiVersion: '2023-08-09'});

export const lambdaHandler = async (event, context, callback) => {
  console.log('incoming request '+JSON.stringify(event));

  // Get the API request from the event
  const apiRequest = JSON.parse(event.body);

  // Get the endpoint to replay the request to
  const endpoint = 'graph.facebook.com/v17/' + apiRequest.endpoint;

  // Make the request to the endpoint
  const client = new AWS.Request('POST', endpoint);
  client.headers = apiRequest.headers;
  const response = await client.send();

  const queueUrl = process.env.QUEUE_URL;
  // var queueUrl = 'https://sqs.sa-east-1.amazonaws.com/361535335283/wmg-tasks';
  var params = {
      MessageBody: JSON.stringify(event),
      QueueUrl: queueUrl
  };
  sqs.sendMessage(params, function(err, data) {
    if (err) {
      console.log("Error", err);
    } else {
      console.log("Successfully posted to queue, message id is : ", data.MessageId);
    }
  });

  // Return the response
  return {
    statusCode: response.statusCode,
    body: response.body
  };
  callback(null, response);
};
