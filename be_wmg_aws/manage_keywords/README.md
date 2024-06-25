// Copyright (c) Facebook, Inc. and its affiliates.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

# Keyword Management API

This documentation explains how to interact with the Keyword Management API, powered by an AWS Lambda function.

## API Endpoints

### Retrieve All Keywords

**GET Request**

Retrieve all keywords:

```
GET https://your-api-gateway-url/keywords
```

### Retrieve a Specific Keyword

**GET Request**

Retrieve a specific keyword by ID:

```
GET https://your-api-gateway-url/keywords/{id}
```

### Create a Keyword

**POST Request**

Create a new keyword:

```
POST https://your-api-gateway-url/keywords
```

JSON Payload:

```json
{
    "keyword": "example_keyword",
    "signal": "example_signal"
}
```

### Update a Keyword

**PUT Request**

Update an existing keyword by ID:

```
PUT https://your-api-gateway-url/keywords/{id}
```

JSON Payload:

```json
{
    "keyword": "updated_keyword",
    "signal": "updated_signal"
}
```

**Note**: DELETE functionality is not available.

Make requests to the provided URLs, and ensure your API Gateway is properly configured to trigger the Lambda function.
