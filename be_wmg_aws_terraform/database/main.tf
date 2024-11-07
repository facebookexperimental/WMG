data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

locals {
    account_id = data.aws_caller_identity.current.account_id
    region = data.aws_region.current.id
}

resource "random_password" "password" {
  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_rds_cluster" "default" {
  cluster_identifier      = "${var.stack_name}-aurora-cluster"
  engine                  = "aurora-mysql"
  engine_version          = "8.0.mysql_aurora.3.05.2"
  database_name           = var.WMGDatabaseClusterDBName
  master_username         = var.WMGDatabaseClusterUsername
  master_password         = random_password.password.result
  skip_final_snapshot     = true
  db_subnet_group_name    = aws_db_subnet_group.WMGDBSubnetGroup.name
  vpc_security_group_ids  = [var.WMGRDSSecurityGroup]
}

resource "aws_rds_cluster_instance" "example" {
  cluster_identifier   = aws_rds_cluster.default.id
  instance_class       = "db.t3.medium"
  engine               = aws_rds_cluster.default.engine
  engine_version       = aws_rds_cluster.default.engine_version
  db_subnet_group_name = aws_db_subnet_group.WMGDBSubnetGroup.name
}


resource "aws_secretsmanager_secret" "dbcreds" {
 name                    = "${aws_rds_cluster.default.cluster_identifier}-AuroraUserSecret"
 recovery_window_in_days = 0
}


resource "aws_secretsmanager_secret_version" "secret_credentials" {
 secret_id      = aws_secretsmanager_secret.dbcreds.id
 secret_string  = "{\"username\":\"${aws_rds_cluster.default.master_username}\",\"password\":\"${aws_rds_cluster.default.master_password}\"}"
}


resource "aws_db_subnet_group" "WMGDBSubnetGroup" {
  name       = "${var.stack_name}-wmg_db_subnet_group"
  subnet_ids = [var.WMGPrivateDBSubnet1, var.WMGPrivateDBSubnet2]

  tags = {
    Name = "${var.stack_name}-wmg_db_subnet_group"
  }
}
