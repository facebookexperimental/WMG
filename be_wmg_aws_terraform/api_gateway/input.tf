variable "stack_name" {
  type = string
}

variable "WebhookStageName" {
  type = string
}

variable "router_lambda" {
  type = object({
    invoke_arn    = string
    function_name = string
  })

}
variable "events_lambda" {
  type = object({
    invoke_arn    = string
    function_name = string
  })
}

variable "audience_rules_lambda" {
  type = object({
    invoke_arn    = string
    function_name = string
  })
}

variable "capi_integration_lambda" {
  type = object({
    invoke_arn    = string
    function_name = string
  })
}

variable "campaigns_performance_lambda" {
  type = object({
    invoke_arn    = string
    function_name = string
  })
}

variable "keywords_lambda" {
  type = object({
    invoke_arn    = string
    function_name = string
  })
}

variable "authorizer_lambda" {
  type = object({
    invoke_arn    = string
    function_name = string
    arn           = string
  })
}

variable "webhook_message_sns_arn" {
  type = string
}
