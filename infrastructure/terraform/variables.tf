# KGEN Enterprise Infrastructure - Variable Definitions
# Comprehensive variable definitions for multi-cloud enterprise deployment

# ================================================
# CORE CONFIGURATION VARIABLES
# ================================================

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "kgen"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be one of: dev, staging, production."
  }
}

variable "team_name" {
  description = "Team responsible for this infrastructure"
  type        = string
  default     = "platform-engineering"
}

variable "cost_center" {
  description = "Cost center for resource billing"
  type        = string
  default     = "engineering"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "unjucks.app"
}

# ================================================
# MULTI-CLOUD CONFIGURATION
# ================================================

variable "cloud_providers" {
  description = "List of cloud providers to deploy to"
  type        = list(string)
  default     = ["aws"]
  validation {
    condition = alltrue([
      for provider in var.cloud_providers :
      contains(["aws", "azure", "gcp"], provider)
    ])
    error_message = "Cloud providers must be from: aws, azure, gcp."
  }
}

variable "deployment_strategy" {
  description = "Multi-cloud deployment strategy"
  type        = string
  default     = "primary-secondary"
  validation {
    condition     = contains(["primary-secondary", "active-active", "disaster-recovery", "cost-optimization"], var.deployment_strategy)
    error_message = "Deployment strategy must be one of: primary-secondary, active-active, disaster-recovery, cost-optimization."
  }
}

# ================================================
# NETWORKING CONFIGURATION
# ================================================

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnets"
  type        = bool
  default     = true
}

variable "enable_vpn_gateway" {
  description = "Enable VPN Gateway for hybrid connectivity"
  type        = bool
  default     = false
}

variable "production_cidrs" {
  description = "CIDR blocks allowed to access production environment"
  type        = list(string)
  default     = ["10.0.0.0/8", "172.16.0.0/12"]
}

variable "staging_cidrs" {
  description = "CIDR blocks allowed to access staging environment"
  type        = list(string)
  default     = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]
}

# ================================================
# AWS-SPECIFIC VARIABLES
# ================================================

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-west-2"
}

variable "aws_vpc_cidr" {
  description = "CIDR block for AWS VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "aws_private_subnets" {
  description = "Private subnet CIDR blocks for AWS"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "aws_public_subnets" {
  description = "Public subnet CIDR blocks for AWS"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

variable "aws_instance_type" {
  description = "EC2 instance type for AWS deployment"
  type        = string
  default     = "t3.medium"
}

variable "aws_db_instance_class" {
  description = "RDS instance class for AWS"
  type        = string
  default     = "db.t3.micro"
}

variable "aws_ssl_certificate_arn" {
  description = "ARN of SSL certificate in AWS Certificate Manager"
  type        = string
  default     = null
}

# ================================================
# AZURE-SPECIFIC VARIABLES
# ================================================

variable "azure_region" {
  description = "Azure region for deployment"
  type        = string
  default     = "East US 2"
}

variable "azure_vnet_cidr" {
  description = "CIDR block for Azure VNet"
  type        = string
  default     = "10.1.0.0/16"
}

variable "azure_private_subnets" {
  description = "Private subnet CIDR blocks for Azure"
  type        = list(string)
  default     = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
}

variable "azure_public_subnets" {
  description = "Public subnet CIDR blocks for Azure"
  type        = list(string)
  default     = ["10.1.101.0/24", "10.1.102.0/24", "10.1.103.0/24"]
}

variable "azure_vm_size" {
  description = "VM size for Azure deployment"
  type        = string
  default     = "Standard_B2s"
}

variable "azure_db_sku_name" {
  description = "Database SKU name for Azure"
  type        = string
  default     = "B_Gen5_1"
}

variable "azure_storage_tier" {
  description = "Storage tier for Azure Storage Account"
  type        = string
  default     = "Standard"
}

variable "azure_ssl_certificate_path" {
  description = "Path to SSL certificate for Azure"
  type        = string
  default     = null
}

# ================================================
# GCP-SPECIFIC VARIABLES
# ================================================

variable "gcp_project_id" {
  description = "GCP project ID"
  type        = string
  default     = null
}

variable "gcp_region" {
  description = "GCP region for deployment"
  type        = string
  default     = "us-central1"
}

variable "gcp_network_cidr" {
  description = "CIDR block for GCP VPC"
  type        = string
  default     = "10.2.0.0/16"
}

variable "gcp_private_subnets" {
  description = "Private subnet CIDR blocks for GCP"
  type        = list(string)
  default     = ["10.2.1.0/24", "10.2.2.0/24", "10.2.3.0/24"]
}

variable "gcp_public_subnets" {
  description = "Public subnet CIDR blocks for GCP"
  type        = list(string)
  default     = ["10.2.101.0/24", "10.2.102.0/24", "10.2.103.0/24"]
}

variable "gcp_machine_type" {
  description = "Machine type for GCP deployment"
  type        = string
  default     = "e2-medium"
}

variable "gcp_db_tier" {
  description = "Database tier for GCP Cloud SQL"
  type        = string
  default     = "db-f1-micro"
}

variable "gcp_storage_class" {
  description = "Storage class for GCP Cloud Storage"
  type        = string
  default     = "STANDARD"
}

variable "gcp_ssl_certificate_name" {
  description = "Name of SSL certificate in GCP"
  type        = string
  default     = null
}

# ================================================
# COMPUTE CONFIGURATION
# ================================================

variable "min_instances" {
  description = "Minimum number of instances in auto scaling group"
  type        = number
  default     = 2
}

variable "max_instances" {
  description = "Maximum number of instances in auto scaling group"
  type        = number
  default     = 10
}

variable "desired_instances" {
  description = "Desired number of instances in auto scaling group"
  type        = number
  default     = 3
}

variable "enable_auto_scaling" {
  description = "Enable auto scaling for compute resources"
  type        = bool
  default     = true
}

# ================================================
# DATABASE CONFIGURATION
# ================================================

variable "db_allocated_storage" {
  description = "Allocated storage for database (GB)"
  type        = number
  default     = 20
}

variable "db_engine_version" {
  description = "Database engine version"
  type        = string
  default     = "14.9"
}

variable "backup_retention_days" {
  description = "Number of days to retain database backups"
  type        = number
  default     = 7
}

variable "enable_storage_versioning" {
  description = "Enable versioning for storage buckets"
  type        = bool
  default     = true
}

# ================================================
# KUBERNETES CONFIGURATION
# ================================================

variable "kubernetes_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.28"
}

variable "k8s_node_pool_min_size" {
  description = "Minimum size of Kubernetes node pool"
  type        = number
  default     = 1
}

variable "k8s_node_pool_max_size" {
  description = "Maximum size of Kubernetes node pool"
  type        = number
  default     = 5
}

variable "k8s_node_instance_types" {
  description = "Instance types for Kubernetes nodes"
  type        = list(string)
  default     = ["t3.medium", "t3.large"]
}

variable "k8s_storage_class" {
  description = "Storage class for Kubernetes persistent volumes"
  type        = string
  default     = "gp3"
}

variable "k8s_storage_size" {
  description = "Storage size for persistent volumes"
  type        = string
  default     = "20Gi"
}

variable "enable_network_policies" {
  description = "Enable Kubernetes network policies"
  type        = bool
  default     = true
}

variable "k8s_pod_security_context" {
  description = "Pod security context configuration"
  type = object({
    runAsNonRoot = bool
    runAsUser    = number
    fsGroup      = number
  })
  default = {
    runAsNonRoot = true
    runAsUser    = 65534
    fsGroup      = 65534
  }
}

# ================================================
# KGEN APPLICATION CONFIGURATION
# ================================================

variable "kgen_image_repository" {
  description = "KGEN container image repository"
  type        = string
  default     = "ghcr.io/your-org/kgen"
}

variable "kgen_image_tag" {
  description = "KGEN container image tag"
  type        = string
  default     = "latest"
}

variable "kgen_replicas" {
  description = "Number of KGEN application replicas"
  type        = number
  default     = 3
}

variable "kgen_cpu_request" {
  description = "CPU request for KGEN containers"
  type        = string
  default     = "100m"
}

variable "kgen_memory_request" {
  description = "Memory request for KGEN containers"
  type        = string
  default     = "256Mi"
}

variable "kgen_cpu_limit" {
  description = "CPU limit for KGEN containers"
  type        = string
  default     = "500m"
}

variable "kgen_memory_limit" {
  description = "Memory limit for KGEN containers"
  type        = string
  default     = "512Mi"
}

# ================================================
# SECURITY CONFIGURATION
# ================================================

variable "enable_waf" {
  description = "Enable Web Application Firewall"
  type        = bool
  default     = true
}

# ================================================
# MONITORING & OBSERVABILITY
# ================================================

variable "enable_monitoring" {
  description = "Enable monitoring and observability stack"
  type        = bool
  default     = true
}

variable "enable_prometheus" {
  description = "Enable Prometheus monitoring"
  type        = bool
  default     = true
}

variable "enable_grafana" {
  description = "Enable Grafana dashboards"
  type        = bool
  default     = true
}

variable "enable_elk_stack" {
  description = "Enable ELK stack for logging"
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "Number of days to retain logs"
  type        = number
  default     = 30
}

# ================================================
# ALERTING CONFIGURATION
# ================================================

variable "alert_email_addresses" {
  description = "Email addresses for alerts"
  type        = list(string)
  default     = []
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications"
  type        = string
  default     = null
  sensitive   = true
}

variable "pagerduty_service_key" {
  description = "PagerDuty service key for critical alerts"
  type        = string
  default     = null
  sensitive   = true
}

# ================================================
# STATE MANAGEMENT
# ================================================

variable "state_bucket" {
  description = "S3 bucket for Terraform state storage"
  type        = string
  default     = null
}