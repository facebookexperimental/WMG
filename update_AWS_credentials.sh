#!/bin/bash

# Step 1: Invoke the command and capture the output
creds_output=$(corp_cloud aws get-creds 361535335283 --role SSOAdmin --output json)

# Step 2: Extract required values from the output
aws_access_key=$(echo "$creds_output" | grep -o '"aws_access_key_id": "[^"]*' | cut -d'"' -f4)
aws_secret_key=$(echo "$creds_output" | grep -o '"aws_secret_access_key": "[^"]*' | cut -d'"' -f4)
aws_session_token=$(echo "$creds_output" | grep -o '"aws_session_token": "[^"]*' | cut -d'"' -f4)

# Step 3: Run `aws configure` with the extracted credentials
aws configure set aws_access_key_id "$aws_access_key"
aws configure set aws_secret_access_key "$aws_secret_key"
aws configure set aws_session_token "$aws_session_token"

echo "AWS CLI configuration is updated."
