variable "stack-name" {
    type = string
}

variable "aws_region" {
    type = string
    default = "us-east-1"
}

variable "WMGDatabaseClusterUsername" {
    type = string
    default = "admin"
}

variable "WMGDatabaseClusterDBName" {
    type = string
    default = "wmgdb"
}

variable "WMGSecurityToken" {
    type = string
    description = "You must define a token that will need to be passed in the Authorization header when calling the APIs."
    sensitive = true
}

variable "CAPISecurityToken" {
    type = string
    description = "You must define a token that will need to be passed in the CAPI integration."
    sensitive = true
}

variable "CAPIIntegrationEnabled" {
    type = bool
    default = false
    description = "Flag to enable CAPI Integration"
}

variable "CAPIGraphApiVersion" {
    type = string
    default = "20.0"
    description = "You must define the graph api version used to call CAPI."
}

variable "CAPIPageId" {
    type = string
    default = ""
    description = "Page id responsible for running CTWA events"
}

variable "CAPIDataSourceId" {
    type = string
    default = ""
    description = "Data source responsible for receiving business messaging signals"
}

variable "WebhookEndpointName" {
    type = string
    default = "subscribe-notif"
    description = "Examples are subscribe,subscribe-notifications, post-notifications,etc."
    validation {
        condition     = can(regex("^[a-zA-Z][a-zA-Z0-9-]*",var.WebhookEndpointName))
        error_message = "The WebhookEndpointName value must follow the pattern [a-zA-Z][a-zA-Z0-9-]."
    }
}

variable "WebhookStageName" {
    type = string
    default = "v1"
    description = "Examples are v1,test,prod,etc."
}

variable "WebhookLogRetentionDays" {
    type = number
    default = "7"
    description = "Number of days to retain logs in CloudWatch"
    validation {
        condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.WebhookLogRetentionDays)
        error_message = "Must select a valid retention value. [1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653]"
    }
}

variable "EnableWMGVpc" {
    type = bool
    default = true
    description = "This flag control if WMG will create a dedicated VPC"
}

variable "WMGPrivateDBSubnet1" {
    type = string
    nullable = true
}

variable "WMGPrivateDBSubnet2" {
    type = string
    nullable = true
}

variable "WMGRDSSecurityGroup" {
    type = string
    nullable = true
}

variable "WMGPrivateLambdaSubnet1" {
    type = string
    nullable = true
}

variable "WMGPrivateLambdaSubnet2" {
    type = string
    nullable = true
}

variable "WMGLambdaSecurityGroup" {
    type = string
    nullable = true
}
