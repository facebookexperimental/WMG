variable "stack_name" {
    type = string
}

variable "WMGSecurityToken" {
    type = string
}

variable "CAPIDataSourceId" {
    type = string
}

variable "CAPIPageId" {
    type = string
}

variable "CAPIIntegrationEnabled" {
    type = bool
}

variable "CAPI_GRAPHAPI_VERSION" {
    type = string
}

variable "CAPISecurityToken" {
    type = string
}

variable "WMGPrivateLambdaSubnet1" {
    type = string
}
variable "WMGPrivateLambdaSubnet2" {
    type = string
}

variable "WMGLambdaSecurityGroup" {
  type = string
}

variable "DB_HOST" {
    type = string
}

variable "DB_NAME" {
    type = string
}

variable "DB_SECRET_ARN" {
    type = string
}

variable "DB_USER" {
    type = string
}

variable "SECRET_MANAGER_POLICY_ARN" {
    type = string
}

variable "SENT_MESSAGE_QUEUE_URL" {
    type = string
}

variable "SENT_MESSAGE_QUEUE_ARN" {
    type = string
}

variable "OUTPUT_BUCKET" {
    type = string
}

variable "OUTPUT_BUCKET_ARN" {
    type = string
}

variable "WEBHOOK_MESSAGE_SNS_ARN" {
    type = string
}
