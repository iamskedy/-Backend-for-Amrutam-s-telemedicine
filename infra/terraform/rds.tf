resource "aws_security_group" "rds" {
  name   = "amrutam-rds-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id] # only the app tier, no public access
  }
}

resource "aws_db_instance" "postgres" {
  identifier             = "amrutam-db-${var.environment}"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = "db.t3.medium"
  allocated_storage      = 50
  storage_encrypted      = true
  multi_az               = true
  db_name                = "amrutam"
  username               = "amrutam_admin"
  password               = var.db_password
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  backup_retention_period = 7
  deletion_protection    = true
}

resource "aws_db_subnet_group" "main" {
  subnet_ids = aws_subnet.private[*].id
}