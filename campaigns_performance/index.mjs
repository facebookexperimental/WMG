import AWS from 'aws-sdk';

const s3 = new AWS.S3();

export const lambdaHandler = async (event, context) => {
    try {
        // Create CSV content
        const csvContent = "Name,Age\nJohn,30\nJane,28";

        // Specify bucket name and file name
        const bucketName = process.env.BUCKET_NAME;
        const fileName = 'output_datetime.csv';

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
