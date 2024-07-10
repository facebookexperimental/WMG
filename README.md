# WMG

Insfrastructure capable of measuring signals in WhatsApp conversations.

There are two deployments supported today, Serverless Application Model (SAM) project to deploy an AWS Cloudformation or Terraform for GCP.

<p align="center">
  <img src="https://github.com/facebookexperimental/WMG/assets/9220147/2f546d83-c88f-4c24-8af3-ac7b0c3203a3" alt="WMG Overview"/>
</p>

## AWS Setup

Requirements:
- [aws-cli]( https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [aws-sam-cli](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- Node 18:
  - Install nvm: `curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash`
  - Make sure to set the environment variable with the command that is outputted by the previous step.
  - Then you install Node: `nvm install 18`

Deploy:
- build: `sam build -t iac.yaml`
- deploy: `sam deploy -g --stack-name <lowercase-stack-name>` (make sure the stack name is all lowercase)
- copy the outputted endpoint as it is going to be used in the next session (if you didn't copy you can still copy it visiting the Outputs tab in Cloudformation CLI)

## Usage

- Import the postman collection [WMG.postman_collection.json](https://github.com/facebookexperimental/WMG/blob/main/WMG.postman_collection.json) in your [Postman](https://www.postman.com/) account
- Set the variable `wmg_domain` with the outputted endpoint of your Cloudformation deploy (ATTENTION: make sure you don't leave an empty space at the end! Otherwise you might receive this error when calling the endpoint: `Authorization header requires 'Credential' parameter.(...)`)
- Set the variable `wmg_security_token` with the token chosen during the deploy of the stack
- Set the variable `wmg_waba_id` with the WABA ID whose phone number is going to be used
- Set the variable `whatsapp_cloud_api_token` with a token with permissions: `whatsapp_business_management`, `whatsapp_business_messaging` and `business_management`.
- Manage the keywords using the endpoints: `Get keywords`, `Get Keyword by id`, `Create Keywords`, `Update Keywords`
- Send WhatsApp messages to the `Router` endpoint instead of calling WhatsApp Cloud API directly
- Call the `Campaigns performance` endpoint whenever you want to check conversations and signals of your phone numbers.

## License

WMG is [MIT licensed](./LICENSE).
