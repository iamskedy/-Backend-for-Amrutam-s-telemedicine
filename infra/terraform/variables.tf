variable "aws_region" {
  default = "ap-south-1"
}
variable "environment" {
  default = "production"
}
variable "db_password" {
  sensitive = true
}