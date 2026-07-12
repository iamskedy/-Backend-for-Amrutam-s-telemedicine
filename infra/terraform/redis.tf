resource "aws_elasticache_subnet_group" "main" {
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "amrutam-redis-${var.environment}"
  description           = "Amrutam Redis cache/queue"
  node_type             = "cache.t3.medium"
  num_cache_clusters    = 2
  engine                = "redis"
  engine_version        = "7.0"
  subnet_group_name     = aws_elasticache_subnet_group.main.name
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
}