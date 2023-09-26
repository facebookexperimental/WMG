// Copyright (c) Facebook, Inc. and its affiliates.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

const SECURITY_TOKEN = process.env.SECURITY_TOKEN;

export const lambdaHandler = async (event) => {
    console.info('Authorization started', event.methodArn);
    const token = event.authorizationToken;
    const tmp = event.methodArn.split(':');
    const apiGatewayArnTmp = tmp[5].split('/');

    // Create wildcard resource (ref: https://repost.aws/knowledge-center/api-gateway-lambda-authorization-errors)
    const resource = tmp[0] + ":" + tmp[1] + ":" + tmp[2] + ":" + tmp[3] + ":" + tmp[4] + ":" + apiGatewayArnTmp[0] + '/*/*';

    // Construct a response which basically will be a policy
    const authResponse = {}
    authResponse.principalId = 'user';
    const policyDocument = {};
    policyDocument.Version = '2012-10-17';
    policyDocument.Statement = [];
    const statement1 = {};
    statement1.Action = 'execute-api:Invoke';
    statement1.Effect = token === SECURITY_TOKEN || alwaysAllow ? 'Allow' : 'Deny';
    statement1.Resource = resource;
    policyDocument.Statement[0] = statement1;
    authResponse.policyDocument = policyDocument;

    return authResponse;
  };
