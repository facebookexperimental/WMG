# Copyright (c) Meta Platforms, Inc. and affiliates.
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.

variable "stack_name" {
  type = string
}

variable "WMGDatabaseClusterUsername" {
  type = string
}

variable "WMGDatabaseClusterDBName" {
  type = string
}

variable "WMGPrivateDBSubnet1" {
  type = string

}
variable "WMGPrivateDBSubnet2" {
  type = string
}

variable "WMGRDSSecurityGroup" {
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
