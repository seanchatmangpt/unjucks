# KGEN Enterprise Infrastructure - Main Configuration
# Supports AWS, Azure, GCP multi-cloud deployments with auto-scaling and HA

terraform {
  required_version = ">= 1.6.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  backend "s3" {
    # Configure backend based on environment
    # bucket = "${var.state_bucket}"
    # key    = "kgen/${var.environment}/terraform.tfstate"
    # region = "${var.aws_region}"
    encrypt = true
  }
}

# Local variables for consistent naming and configuration
locals {
  name_prefix = "${var.project_name}-${var.environment}"
  
  common_tags = {
    Project      = var.project_name
    Environment  = var.environment
    ManagedBy    = "Terraform"
    Application  = "KGEN"
    Owner        = var.team_name
    CostCenter   = var.cost_center
    Backup       = "Required"
    Monitoring   = "Enabled"
  }
  
  # Multi-cloud configuration
  deploy_aws   = contains(var.cloud_providers, "aws")
  deploy_azure = contains(var.cloud_providers, "azure")
  deploy_gcp   = contains(var.cloud_providers, "gcp")
  
  # Security configuration
  allowed_ingress_cidrs = var.environment == "production" ? var.production_cidrs : var.staging_cidrs
}

# Random suffix for unique resource naming
resource "random_id" "suffix" {
  byte_length = 4
}

# Data sources for existing resources
data "aws_availability_zones" "available" {
  count = local.deploy_aws ? 1 : 0
  state = "available"
}

data "azurerm_client_config" "current" {
  count = local.deploy_azure ? 1 : 0
}

data "google_project" "current" {
  count = local.deploy_gcp ? 1 : 0
}

# ================================================
# AWS INFRASTRUCTURE MODULE
# ================================================
module "aws_infrastructure" {
  count  = local.deploy_aws ? 1 : 0
  source = "./modules/aws"

  # Basic Configuration
  name_prefix         = local.name_prefix
  environment         = var.environment
  aws_region          = var.aws_region
  availability_zones  = data.aws_availability_zones.available[0].names
  
  # Networking
  vpc_cidr           = var.aws_vpc_cidr
  private_subnets    = var.aws_private_subnets
  public_subnets     = var.aws_public_subnets
  enable_nat_gateway = var.enable_nat_gateway
  enable_vpn_gateway = var.enable_vpn_gateway
  
  # Compute Configuration
  instance_type           = var.aws_instance_type
  min_size               = var.min_instances
  max_size               = var.max_instances
  desired_capacity       = var.desired_instances
  enable_auto_scaling    = var.enable_auto_scaling
  
  # Database Configuration
  db_instance_class      = var.aws_db_instance_class
  db_allocated_storage   = var.db_allocated_storage
  db_engine_version      = var.db_engine_version
  backup_retention_days  = var.backup_retention_days
  
  # Storage Configuration
  storage_bucket_name    = "${local.name_prefix}-storage-${random_id.suffix.hex}"
  enable_versioning      = var.enable_storage_versioning
  enable_encryption      = true
  
  # Security Configuration
  allowed_cidrs          = local.allowed_ingress_cidrs
  ssl_certificate_arn    = var.aws_ssl_certificate_arn
  enable_waf             = var.enable_waf
  
  # Monitoring & Logging
  enable_cloudwatch      = var.enable_monitoring
  log_retention_days     = var.log_retention_days
  
  # Tags
  tags = local.common_tags
}

# ================================================
# AZURE INFRASTRUCTURE MODULE
# ================================================
module "azure_infrastructure" {
  count  = local.deploy_azure ? 1 : 0
  source = "./modules/azure"

  # Basic Configuration
  name_prefix           = local.name_prefix
  environment           = var.environment
  azure_region          = var.azure_region
  resource_group_name   = "${local.name_prefix}-rg"
  
  # Networking
  vnet_address_space    = [var.azure_vnet_cidr]
  private_subnets       = var.azure_private_subnets
  public_subnets        = var.azure_public_subnets
  
  # Compute Configuration
  vm_size               = var.azure_vm_size
  min_instances         = var.min_instances
  max_instances         = var.max_instances
  enable_auto_scaling   = var.enable_auto_scaling
  
  # Database Configuration
  db_sku_name           = var.azure_db_sku_name
  db_storage_mb         = var.db_allocated_storage * 1024
  backup_retention_days = var.backup_retention_days
  
  # Storage Configuration
  storage_account_name  = "${replace(local.name_prefix, "-", "")}${random_id.suffix.hex}"
  storage_tier          = var.azure_storage_tier
  
  # Security Configuration
  allowed_cidrs         = local.allowed_ingress_cidrs
  ssl_certificate_path  = var.azure_ssl_certificate_path
  
  # Monitoring & Logging
  enable_monitoring     = var.enable_monitoring
  log_retention_days    = var.log_retention_days
  
  # Tags
  tags = local.common_tags
}

# ================================================
# GCP INFRASTRUCTURE MODULE
# ================================================
module "gcp_infrastructure" {
  count  = local.deploy_gcp ? 1 : 0
  source = "./modules/gcp"

  # Basic Configuration
  name_prefix     = local.name_prefix
  environment     = var.environment
  gcp_region      = var.gcp_region
  gcp_project_id  = var.gcp_project_id
  
  # Networking
  network_cidr       = var.gcp_network_cidr
  private_subnets    = var.gcp_private_subnets
  public_subnets     = var.gcp_public_subnets
  
  # Compute Configuration
  machine_type          = var.gcp_machine_type
  min_instances         = var.min_instances
  max_instances         = var.max_instances
  enable_auto_scaling   = var.enable_auto_scaling
  
  # Database Configuration
  db_tier               = var.gcp_db_tier
  db_disk_size          = var.db_allocated_storage
  backup_retention_days = var.backup_retention_days
  
  # Storage Configuration
  bucket_name           = "${local.name_prefix}-storage-${random_id.suffix.hex}"
  storage_class         = var.gcp_storage_class
  
  # Security Configuration
  allowed_cidrs         = local.allowed_ingress_cidrs
  ssl_certificate_name  = var.gcp_ssl_certificate_name
  
  # Monitoring & Logging
  enable_monitoring     = var.enable_monitoring
  
  # Tags
  labels = local.common_tags
}

# ================================================
# KUBERNETES INFRASTRUCTURE MODULE
# ================================================
module "kubernetes_cluster" {
  source = "./modules/kubernetes"
  
  # Dependencies
  depends_on = [
    module.aws_infrastructure,
    module.azure_infrastructure,
    module.gcp_infrastructure
  ]
  
  # Basic Configuration
  name_prefix         = local.name_prefix
  environment         = var.environment
  kubernetes_version  = var.kubernetes_version
  
  # Multi-cloud cluster configuration
  cloud_providers = var.cloud_providers
  
  # AWS EKS Configuration
  eks_cluster_endpoint = local.deploy_aws ? module.aws_infrastructure[0].eks_cluster_endpoint : null
  eks_cluster_ca       = local.deploy_aws ? module.aws_infrastructure[0].eks_cluster_ca : null
  eks_cluster_token    = local.deploy_aws ? module.aws_infrastructure[0].eks_cluster_token : null
  
  # Azure AKS Configuration
  aks_cluster_endpoint = local.deploy_azure ? module.azure_infrastructure[0].aks_cluster_endpoint : null
  aks_cluster_ca       = local.deploy_azure ? module.azure_infrastructure[0].aks_cluster_ca : null
  aks_cluster_token    = local.deploy_azure ? module.azure_infrastructure[0].aks_cluster_token : null
  
  # GCP GKE Configuration
  gke_cluster_endpoint = local.deploy_gcp ? module.gcp_infrastructure[0].gke_cluster_endpoint : null
  gke_cluster_ca       = local.deploy_gcp ? module.gcp_infrastructure[0].gke_cluster_ca : null
  gke_cluster_token    = local.deploy_gcp ? module.gcp_infrastructure[0].gke_cluster_token : null
  
  # Node Pool Configuration
  node_pool_min_size  = var.k8s_node_pool_min_size
  node_pool_max_size  = var.k8s_node_pool_max_size
  node_instance_types = var.k8s_node_instance_types
  
  # KGEN Application Configuration
  kgen_image_repository = var.kgen_image_repository
  kgen_image_tag        = var.kgen_image_tag
  kgen_replicas         = var.kgen_replicas
  
  # Resources
  kgen_cpu_request      = var.kgen_cpu_request
  kgen_memory_request   = var.kgen_memory_request
  kgen_cpu_limit        = var.kgen_cpu_limit
  kgen_memory_limit     = var.kgen_memory_limit
  
  # Storage
  storage_class_name    = var.k8s_storage_class
  storage_size          = var.k8s_storage_size
  
  # Security
  pod_security_context  = var.k8s_pod_security_context
  enable_network_policies = var.enable_network_policies
  
  # Monitoring & Logging
  enable_prometheus     = var.enable_prometheus
  enable_grafana        = var.enable_grafana
  enable_elk_stack      = var.enable_elk_stack
  
  # Tags
  tags = local.common_tags
}

# ================================================
# MONITORING INFRASTRUCTURE MODULE
# ================================================
module "monitoring" {
  source = "./modules/monitoring"
  
  depends_on = [
    module.aws_infrastructure,
    module.azure_infrastructure,
    module.gcp_infrastructure,
    module.kubernetes_cluster
  ]
  
  # Basic Configuration
  name_prefix = local.name_prefix
  environment = var.environment
  
  # Multi-cloud configuration
  cloud_providers = var.cloud_providers
  
  # AWS Monitoring Resources
  aws_cloudwatch_enabled = local.deploy_aws && var.enable_monitoring
  aws_region             = var.aws_region
  
  # Azure Monitoring Resources
  azure_monitor_enabled = local.deploy_azure && var.enable_monitoring
  azure_region          = var.azure_region
  azure_resource_group  = local.deploy_azure ? module.azure_infrastructure[0].resource_group_name : null
  
  # GCP Monitoring Resources
  gcp_monitoring_enabled = local.deploy_gcp && var.enable_monitoring
  gcp_project_id         = var.gcp_project_id
  
  # Kubernetes Monitoring
  kubernetes_enabled     = var.enable_monitoring
  prometheus_enabled     = var.enable_prometheus
  grafana_enabled        = var.enable_grafana
  
  # Alerting Configuration
  alert_email_addresses  = var.alert_email_addresses
  slack_webhook_url      = var.slack_webhook_url
  pagerduty_service_key  = var.pagerduty_service_key
  
  # Log Retention
  log_retention_days     = var.log_retention_days
  
  # Tags
  tags = local.common_tags
}

# ================================================
# OUTPUTS
# ================================================

output "infrastructure_summary" {
  description = "Summary of deployed infrastructure"
  value = {
    environment     = var.environment
    cloud_providers = var.cloud_providers
    name_prefix     = local.name_prefix
    
    aws_resources = local.deploy_aws ? {
      vpc_id            = module.aws_infrastructure[0].vpc_id
      load_balancer_dns = module.aws_infrastructure[0].load_balancer_dns
      rds_endpoint      = module.aws_infrastructure[0].rds_endpoint
      s3_bucket         = module.aws_infrastructure[0].s3_bucket_name
      eks_cluster_name  = module.aws_infrastructure[0].eks_cluster_name
    } : null
    
    azure_resources = local.deploy_azure ? {
      resource_group_name   = module.azure_infrastructure[0].resource_group_name
      vnet_id              = module.azure_infrastructure[0].vnet_id
      load_balancer_ip     = module.azure_infrastructure[0].load_balancer_ip
      database_server_name = module.azure_infrastructure[0].database_server_name
      storage_account_name = module.azure_infrastructure[0].storage_account_name
      aks_cluster_name     = module.azure_infrastructure[0].aks_cluster_name
    } : null
    
    gcp_resources = local.deploy_gcp ? {
      network_name        = module.gcp_infrastructure[0].network_name
      load_balancer_ip    = module.gcp_infrastructure[0].load_balancer_ip
      database_name       = module.gcp_infrastructure[0].database_name
      storage_bucket_name = module.gcp_infrastructure[0].storage_bucket_name
      gke_cluster_name    = module.gcp_infrastructure[0].gke_cluster_name
    } : null
  }
}

output "application_endpoints" {
  description = "Application access endpoints"
  value = {
    aws_endpoint   = local.deploy_aws ? "https://${module.aws_infrastructure[0].load_balancer_dns}" : null
    azure_endpoint = local.deploy_azure ? "https://${module.azure_infrastructure[0].load_balancer_ip}" : null
    gcp_endpoint   = local.deploy_gcp ? "https://${module.gcp_infrastructure[0].load_balancer_ip}" : null
  }
  sensitive = false
}

output "monitoring_dashboards" {
  description = "Monitoring and observability endpoints"
  value = {
    prometheus_url = var.enable_prometheus ? "https://${local.name_prefix}-prometheus.${var.domain_name}" : null
    grafana_url    = var.enable_grafana ? "https://${local.name_prefix}-grafana.${var.domain_name}" : null
    kibana_url     = var.enable_elk_stack ? "https://${local.name_prefix}-kibana.${var.domain_name}" : null
  }
}

output "database_endpoints" {
  description = "Database connection endpoints"
  value = {
    aws_rds_endpoint   = local.deploy_aws ? module.aws_infrastructure[0].rds_endpoint : null
    azure_db_endpoint  = local.deploy_azure ? module.azure_infrastructure[0].database_endpoint : null
    gcp_db_endpoint    = local.deploy_gcp ? module.gcp_infrastructure[0].database_endpoint : null
  }
  sensitive = true
}

output "kubernetes_config" {
  description = "Kubernetes cluster configuration"
  value = {
    cluster_endpoints = module.kubernetes_cluster.cluster_endpoints
    kubeconfig_paths  = module.kubernetes_cluster.kubeconfig_paths
    namespaces        = module.kubernetes_cluster.namespaces
  }
  sensitive = true
}