data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "main" {
  cidr_block           = "172.32.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.stack_name}-WMG-VPC"
  }
}


resource "aws_subnet" "WMGPrivateDBSubnet1" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "172.32.0.0/20"
  availability_zone = data.aws_availability_zones.available.names[0]


  tags = {
    Name = "${var.stack_name}-WMGPrivateDBSubnet1"
  }
}

resource "aws_subnet" "WMGPrivateDBSubnet2" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "172.32.16.0/20"
  availability_zone = data.aws_availability_zones.available.names[1]


  tags = {
    Name = "${var.stack_name}-WMGPrivateDBSubnet2"
  }
}

resource "aws_subnet" "WMGPrivateLambdaSubnet1" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "172.32.32.0/20"
  availability_zone = data.aws_availability_zones.available.names[0]


  tags = {
    Name = "${var.stack_name}-WMGPrivateLambdaSubnet1"
  }
}

resource "aws_subnet" "WMGPrivateLambdaSubnet2" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "172.32.48.0/20"
  availability_zone = data.aws_availability_zones.available.names[1]


  tags = {
    Name = "${var.stack_name}-WMGPrivateLambdaSubnet2"
  }
}

resource "aws_subnet" "WMGPublicSubnet1" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "172.32.64.0/20"
  availability_zone = data.aws_availability_zones.available.names[0]


  tags = {
    Name = "${var.stack_name}-WMGPublicSubnet1"
  }
}

resource "aws_subnet" "WMGPublicSubnet2" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "172.32.80.0/20"
  availability_zone = data.aws_availability_zones.available.names[1]


  tags = {
    Name = "${var.stack_name}-WMGPublicSubnet2"
  }
}

resource "aws_internet_gateway" "WMGInternetGateway" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.stack_name}-WMGInternetGateway"
  }
}

# resource "aws_internet_gateway_attachment" "WMGAttachInternetGateway" {
#   internet_gateway_id = aws_internet_gateway.WMGInternetGateway.id
#   vpc_id              = aws_vpc.main.id
# }

resource "aws_route_table" "WMGCustomRouteTable" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.WMGInternetGateway.id
  }

  tags = {
    Name = "${var.stack_name}-WMGCustomRouteTable"
  }
}

resource "aws_route_table" "WMGRouteTable" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.WMGNAT.id
  }

  tags = {
    Name = "${var.stack_name}-WMGRouteTable"
  }
}


resource "aws_route_table_association" "WMGSubnetRouteTableAssociation1" {
  subnet_id      = aws_subnet.WMGPrivateDBSubnet1.id
  route_table_id = aws_route_table.WMGRouteTable.id
}

resource "aws_route_table_association" "WMGSubnetRouteTableAssociation2" {
  subnet_id      = aws_subnet.WMGPrivateDBSubnet2.id
  route_table_id = aws_route_table.WMGRouteTable.id
}

resource "aws_route_table_association" "WMGSubnetRouteTableAssociation3" {
  subnet_id      = aws_subnet.WMGPrivateLambdaSubnet1.id
  route_table_id = aws_route_table.WMGRouteTable.id
}

resource "aws_route_table_association" "WMGSubnetRouteTableAssociation4" {
  subnet_id      = aws_subnet.WMGPrivateLambdaSubnet2.id
  route_table_id = aws_route_table.WMGRouteTable.id
}

resource "aws_route_table_association" "WMGSubnetRouteTableAssociation5" {
  subnet_id      = aws_subnet.WMGPublicSubnet1.id
  route_table_id = aws_route_table.WMGCustomRouteTable.id
}

resource "aws_route_table_association" "WMGSubnetRouteTableAssociation6" {
  subnet_id      = aws_subnet.WMGPublicSubnet2.id
  route_table_id = aws_route_table.WMGCustomRouteTable.id
}


resource "aws_nat_gateway" "WMGNAT" {
  allocation_id = aws_eip.WMGEIP.id
  subnet_id     = aws_subnet.WMGPublicSubnet1.id

  tags = {
    Name = "${var.stack_name}-WMGNAT"
  }

  # To ensure proper ordering, it is recommended to add an explicit dependency
  # on the Internet Gateway for the VPC.
  depends_on = [aws_internet_gateway.WMGInternetGateway]
}

resource "aws_eip" "WMGEIP" {
  domain = "vpc"
}


resource "aws_security_group" "WMGRDSSecurityGroup" {
  name        = "${var.stack_name}-WMGRDSSecurityGroup"
  description = "Allow My SQL access from lambda subnets"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${var.stack_name}-WMGRDSSecurityGroup"
  }
}

resource "aws_vpc_security_group_ingress_rule" "WMGRDSSecurityGroup_tcp" {
  security_group_id = aws_security_group.WMGRDSSecurityGroup.id
  cidr_ipv4         = aws_vpc.main.cidr_block
  from_port         = 3306
  ip_protocol       = "tcp"
  to_port           = 3306
}

resource "aws_security_group" "WMGLambdaSecurityGroup" {
  name        = "${var.stack_name}-WMGLambdaSecurityGroup"
  description = " Security group for Lambda ENIs"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${var.stack_name}-WMGLambdaSecurityGroup"
  }
}

resource "aws_vpc_security_group_egress_rule" "WMGRDSSecurityGroup_tcp" {
  security_group_id = aws_security_group.WMGLambdaSecurityGroup.id
  ip_protocol       = -1
  cidr_ipv4         = "0.0.0.0/0"
}
