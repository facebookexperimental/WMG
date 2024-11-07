# Configure the AWS provider
provider "aws" {
  region = var.aws_region
}

module "lambdas" {
  source = "./lambda"

  depends_on = [ module.vpc , module.database]


  stack_name                = var.stack-name
  WMGSecurityToken          = var.WMGSecurityToken

  CAPI_GRAPHAPI_VERSION     = var.CAPIGraphApiVersion
  CAPIDataSourceId          = var.CAPIDataSourceId
  CAPIIntegrationEnabled    = var.CAPIIntegrationEnabled
  CAPIPageId                = var.CAPIPageId
  CAPISecurityToken         = var.CAPISecurityToken

  WMGPrivateLambdaSubnet1   = var.WMGPrivateLambdaSubnet1 != null ? var.WMGPrivateLambdaSubnet1 : module.vpc[0].WMGPrivateLambdaSubnet1
  WMGPrivateLambdaSubnet2   = var.WMGPrivateLambdaSubnet2 != null ? var.WMGPrivateLambdaSubnet2 : module.vpc[0].WMGPrivateLambdaSubnet2
  WMGLambdaSecurityGroup    = var.WMGLambdaSecurityGroup != null ? var.WMGLambdaSecurityGroup : module.vpc[0].WMGLambdaSecurityGroup

  DB_HOST                   = module.database.DB_HOST
  DB_NAME                   = module.database.DB_NAME
  DB_SECRET_ARN             = module.database.DB_SECRET_ARN
  DB_USER                   = module.database.DB_USER

  SECRET_MANAGER_POLICY_ARN = module.database.SECRET_MANAGER_POLICY_ARN

  SENT_MESSAGE_QUEUE_URL    = module.queue.SENT_MESSAGE_QUEUE_URL
  SENT_MESSAGE_QUEUE_ARN    = module.queue.SENT_MESSAGE_QUEUE_ARN

  OUTPUT_BUCKET             = module.storage.OUTPUT_BUCKET
  OUTPUT_BUCKET_ARN         = module.storage.OUTPUT_BUCKET_ARN

  WEBHOOK_MESSAGE_SNS_ARN   = module.queue.WEBHOOK_MESSAGE_SNS_ARN
}

module "apigateway" {
  source = "./api_gateway"
  depends_on = [ module.lambdas ]

  stack_name       = var.stack-name
  WebhookStageName = var.WebhookStageName

  router_lambda = {
     invoke_arn    = module.lambdas.router_lambda.invoke_arn
     function_name = module.lambdas.router_lambda.function_name
  }

  events_lambda = {
     invoke_arn    = module.lambdas.events_lambda.invoke_arn
     function_name = module.lambdas.events_lambda.function_name
  }

  audience_rules_lambda = {
     invoke_arn    = module.lambdas.audience_rules_lambda.invoke_arn
     function_name = module.lambdas.audience_rules_lambda.function_name
  }

  capi_integration_lambda = {
     invoke_arn    = module.lambdas.capi_integration_lambda.invoke_arn
     function_name = module.lambdas.capi_integration_lambda.function_name
  }

  campaigns_performance_lambda = {
     invoke_arn    = module.lambdas.campaigns_performance_lambda.invoke_arn
     function_name = module.lambdas.campaigns_performance_lambda.function_name
  }

  keywords_lambda = {
     invoke_arn    = module.lambdas.manage_keywords_lambda.invoke_arn
     function_name = module.lambdas.manage_keywords_lambda.function_name
  }

  authorizer_lambda = {
     invoke_arn    = module.lambdas.authorizer_lambda.invoke_arn
     function_name = module.lambdas.authorizer_lambda.function_name
     arn           = module.lambdas.authorizer_lambda.arn
  }

  webhook_message_sns_arn = module.queue.WEBHOOK_MESSAGE_SNS_ARN
}

module "database" {
  source = "./database"

  depends_on = [ module.vpc ]

  stack_name                 = var.stack-name
  WMGDatabaseClusterDBName   = var.WMGDatabaseClusterDBName
  WMGDatabaseClusterUsername = var.WMGDatabaseClusterUsername

  WMGPrivateDBSubnet1     = var.WMGPrivateDBSubnet1 != null ? var.WMGPrivateDBSubnet1 : module.vpc[0].WMGPrivateDBSubnet1
  WMGPrivateDBSubnet2     = var.WMGPrivateDBSubnet2 != null ? var.WMGPrivateDBSubnet2 : module.vpc[0].WMGPrivateDBSubnet2
  WMGRDSSecurityGroup     = var.WMGRDSSecurityGroup != null ? var.WMGRDSSecurityGroup : module.vpc[0].WMGRDSSecurityGroup
  WMGPrivateLambdaSubnet1 = var.WMGPrivateLambdaSubnet1 != null ? var.WMGPrivateLambdaSubnet1 : module.vpc[0].WMGPrivateLambdaSubnet1
  WMGPrivateLambdaSubnet2 = var.WMGPrivateLambdaSubnet2 != null ? var.WMGPrivateLambdaSubnet2 : module.vpc[0].WMGPrivateLambdaSubnet2
  WMGLambdaSecurityGroup  = var.WMGLambdaSecurityGroup != null ? var.WMGLambdaSecurityGroup : module.vpc[0].WMGLambdaSecurityGroup
}

module "vpc" {
  source = "./vpc"
  count  = var.EnableWMGVpc ? 1 : 0

  stack_name                 = var.stack-name
}

module "queue" {
   source = "./queue"

   stack_name                 = var.stack-name
}

module "storage" {
   source = "./storage"

   stack_name                 = var.stack-name
}
