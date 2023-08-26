import AWS from 'aws-sdk';
AWS.config.update({region: 'sa-east-1'});
var sqs = new AWS.SQS({apiVersion: '2023-08-09'});

export const lambdaHandler = async (event, context, callback) => {
    const response = {
        statusCode: 200,
        body: JSON.stringify('ACK for notif'),
        headers : {'Content-Type':'application/json'},
    };

    console.log('incoming webhoook '+JSON.stringify(event));
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
    callback(null, response);
};
