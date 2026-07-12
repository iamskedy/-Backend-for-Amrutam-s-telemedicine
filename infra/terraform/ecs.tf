resource "aws_security_group" "app" {
  name   = "amrutam-app-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # via ALB only in practice; tighten with ALB SG reference in production
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_ecs_cluster" "main" {
  name = "amrutam-cluster-${var.environment}"
}

resource "aws_ecs_task_definition" "app" {
  family                   = "amrutam-app"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"

  container_definitions = jsonencode([{
    name  = "app"
    image = "REPLACE_WITH_ECR_IMAGE_URI"
    portMappings = [{ containerPort = 3000 }]
    healthCheck = {
      command  = ["CMD-SHELL", "node -e \"require('http').get('http://localhost:3000/health/live', r => process.exit(r.statusCode === 200 ? 0 : 1))\""]
      interval = 30
      timeout  = 5
      retries  = 3
    }
  }])
}

resource "aws_ecs_service" "app" {
  name            = "amrutam-app-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.app.id]
  }
}