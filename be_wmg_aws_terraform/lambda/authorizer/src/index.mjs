// Copyright (c) Facebook, Inc. and its affiliates.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import AWS from 'aws-sdk';

const securityTokenSecretArn = process.env.SECURITY_TOKEN_ARN;

export const lambdaHandler = async (event) => {
    console.info('Authorization started', event.methodArn);
    const token = event.authorizationToken;
    const tmp = event.methodArn.split(':');
    const apiGatewayArnTmp = tmp[5].split('/');

    // Create wildcard resource (ref: https://repost.aws/knowledge-center/api-gateway-lambda-authorization-errors)
    const resource = tmp[0] + ":" + tmp[1] + ":" + tmp[2] + ":" + tmp[3] + ":" + tmp[4] + ":" + apiGatewayArnTmp[0] + '/*/*';

    // Get the token from AWS Secrets Manager
    const securityToken = await getWMGSecurityToken();

    // Construct a response which basically will be a policy
    const authResponse = {}
    authResponse.principalId = 'user';
    const policyDocument = {};
    policyDocument.Version = '2012-10-17';
    policyDocument.Statement = [];
    const statement1 = {};
    statement1.Action = 'execute-api:Invoke';
    statement1.Effect = token === securityToken ? 'Allow' : 'Deny';
    statement1.Resource = resource;
    policyDocument.Statement[0] = statement1;
    authResponse.policyDocument = policyDocument;

    return authResponse;
  };

// Helper function to get the Security Token from AWS Secrets Manager
const getWMGSecurityToken = async () => {
  try {
      console.info('Getting WMGSecurityToken');
      const client = new AWS.SecretsManager();
      const data = await client.getSecretValue({ SecretId: securityTokenSecretArn }).promise();
      console.info('Parsing WMGSecurityToken');
      if ('SecretString' in data) {
          const secret = JSON.parse(data.SecretString);
          return secret.WMGSecurityToken;
      } else {
          const decodedBinarySecret = Buffer.from(data.SecretBinary, 'base64');
          return decodedBinarySecret.toString();
      }
  } catch (error) {
      console.error(error);
      throw error;
  }
};
