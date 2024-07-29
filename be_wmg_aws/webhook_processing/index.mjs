// Copyright (c) Facebook, Inc. and its affiliates.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import AWS from 'aws-sdk';

AWS.config.update({ region: 'sa-east-1' });
export const lambdaHandler = async (event, context) => {
    try {
        console.info('Received event: ', JSON.stringify(event));

        return generateResponse(200, {});
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        console.info("Inside finally")
        if (connection) connection.destroy();
    }
};

// Helper function to generate the response
const generateResponse = (statusCode, data) => {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    };
};
