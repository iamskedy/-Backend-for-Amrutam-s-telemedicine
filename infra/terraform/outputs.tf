output "rds_endpoint" {
  value = aws_db_instance.postgres.endpoint
}
output "redis_endpoint" {
  value = aws_elasticache_replication_group.redis.primary_endpoint_address
}
output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}