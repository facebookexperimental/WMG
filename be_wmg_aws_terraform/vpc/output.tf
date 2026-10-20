# Copyright (c) Meta Platforms, Inc. and affiliates.
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.

output "WMGPrivateDBSubnet1" {
  value = aws_subnet.WMGPrivateDBSubnet1.id
}

output "WMGPrivateDBSubnet2" {
  value = aws_subnet.WMGPrivateDBSubnet2.id
}

output "WMGRDSSecurityGroup" {
  value = aws_security_group.WMGRDSSecurityGroup.id
}

output "WMGPrivateLambdaSubnet1" {
  value = aws_subnet.WMGPrivateLambdaSubnet1.id
}

output "WMGPrivateLambdaSubnet2" {
  value = aws_subnet.WMGPrivateLambdaSubnet2.id
}

output "WMGLambdaSecurityGroup" {
  value = aws_security_group.WMGLambdaSecurityGroup.id
}
