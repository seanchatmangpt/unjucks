# AWS Infrastructure Module Variables

variable "name_prefix" {
  description = "Name prefix for all resources"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
}

variable "private_subnets" {
  description = "List of private subnet CIDR blocks"
  type        = list(string)
}

variable "public_subnets" {
  description = "List of public subnet CIDR blocks"
  type        = list(string)
}

variable "enable_nat_gateway" {
  description = "Enable NAT gateway"
  type        = bool
  default     = true
}

variable "enable_vpn_gateway" {
  description = "Enable VPN gateway"
  type        = bool
  default     = false
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
}

variable "min_size" {
  description = "Minimum number of instances"
  type        = number
}

variable "max_size" {
  description = "Maximum number of instances"
  type        = number
}

variable "desired_capacity" {
  description = "Desired number of instances"
  type        = number
}

variable "enable_auto_scaling" {
  description = "Enable auto scaling"
  type        = bool
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
}

variable "db_engine_version" {
  description = "RDS engine version"
  type        = string
}

variable "backup_retention_days" {
  description = "Backup retention period in days"
  type        = number
}

variable "storage_bucket_name" {
  description = "S3 bucket name for storage"
  type        = string
}

variable "enable_versioning" {
  description = "Enable S3 versioning"
  type        = bool
}

variable "enable_encryption" {
  description = "Enable S3 encryption"
  type        = bool
}

variable "allowed_cidrs" {
  description = "List of allowed CIDR blocks"
  type        = list(string)
}

variable "ssl_certificate_arn" {
  description = "SSL certificate ARN"
  type        = string
  default     = null
}

variable "enable_waf" {
  description = "Enable WAF"
  type        = bool
}

variable "enable_cloudwatch" {
  description = "Enable CloudWatch monitoring"
  type        = bool
}

variable "log_retention_days" {
  description = "Log retention period in days"
  type        = number
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}