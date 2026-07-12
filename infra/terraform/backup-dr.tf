# RDS: automated daily backups (7-day retention, set in rds.tf) plus a
# manual cross-region snapshot copy for disaster recovery.
resource "aws_db_instance_automated_backups_replication" "cross_region" {
  source_db_instance_arn = aws_db_instance.postgres.arn
  kms_key_id              = null # use default KMS key in DR region
}

# Stated targets (documented, not enforced by Terraform itself):
# RPO (Recovery Point Objective): <= 24h (daily automated backups + PITR via WAL)
# RTO (Recovery Time Objective): <= 4h (restore from snapshot + re-point ECS service)