# WMG

## Setup

Requirements:
- [aws-cli]( https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [aws-sam-cli](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- Node 18:
  - Install nvm: `curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash`
  - Make sure to set the environment variable with the command that is outputted by the previous step.
  - Then you install Node: `nvm install 18`

## Utilities

- To update expired AWS credentials (make sure you are using VPN): `sh update_AWS_credentials.sh`
- To have aliases for some sam commands, run the following:
```
git config --local alias.build '!sam build -t iac.yaml'
git config --local alias.deploy '!sam deploy'
git config --local alias.validate '!sam validate -t iac.yaml --lint'
```
After that you can invoke those commands by simply running `git build`, `git deploy` or `git validate`.
