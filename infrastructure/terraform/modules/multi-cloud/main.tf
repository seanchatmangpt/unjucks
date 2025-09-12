# KGEN Multi-Cloud Terraform Module
# Supports AWS, Azure, and GCP deployments with consistent configuration

terraform {
  required_version = ">= 1.0"
  
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
      version = "~> 2.20"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.10"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

# Variable definitions
variable "cloud_provider" {
  description = "Target cloud provider"
  type        = string
  validation {
    condition     = contains(["aws", "azure", "gcp"], var.cloud_provider)
    error_message = "Cloud provider must be one of: aws, azure, gcp"
  }
}

variable "project_name" {
  description = "Name of the KGEN project"
  type        = string
  default     = "kgen"
}

variable "environment" {
  description = "Environment name"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "region" {
  description = "Cloud provider region"
  type        = string
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = []
}

variable "kubernetes_version" {
  description = "Kubernetes cluster version"
  type        = string
  default     = "1.28"
}

variable "node_pool_config" {
  description = "Node pool configuration"
  type = object({
    instance_type    = string
    min_nodes       = number
    max_nodes       = number
    desired_nodes   = number
    disk_size_gb    = number
    auto_scaling    = bool
  })
  default = {
    instance_type  = "standard"
    min_nodes     = 3
    max_nodes     = 20
    desired_nodes = 6
    disk_size_gb  = 100
    auto_scaling  = true
  }
}

variable "multi_tenant_config" {
  description = "Multi-tenancy configuration"
  type = object({
    enabled           = bool
    isolation_mode    = string
    default_quotas    = map(string)
    premium_quotas    = map(string)
    enterprise_quotas = map(string)
  })
  default = {
    enabled        = true
    isolation_mode = "namespace"
    default_quotas = {
      cpu    = "4"
      memory = "8Gi"
      storage = "50Gi"
    }
    premium_quotas = {
      cpu    = "20"
      memory = "40Gi"
      storage = "500Gi"
    }
    enterprise_quotas = {
      cpu    = "100"
      memory = "200Gi"
      storage = "2Ti"
    }
  }
}

variable "database_config" {
  description = "Database configuration"
  type = object({
    engine_version     = string
    instance_class     = string
    allocated_storage  = number
    multi_az          = bool
    backup_retention  = number
    encryption        = bool
  })
  default = {
    engine_version    = "15"
    instance_class    = "large"
    allocated_storage = 500
    multi_az         = true
    backup_retention = 30
    encryption       = true
  }
}

variable "redis_config" {
  description = "Redis configuration"
  type = object({
    node_type           = string
    num_cache_nodes     = number
    parameter_group     = string
    auto_failover       = bool
    multi_az           = bool
  })
  default = {
    node_type       = "large"
    num_cache_nodes = 3
    parameter_group = "default.redis7"
    auto_failover   = true
    multi_az       = true
  }
}

variable "monitoring_config" {
  description = "Monitoring and observability configuration"
  type = object({
    enabled           = bool
    prometheus        = bool
    grafana          = bool
    jaeger           = bool
    log_retention    = number
  })
  default = {
    enabled        = true
    prometheus     = true
    grafana       = true
    jaeger        = true
    log_retention = 30
  }
}

variable "security_config" {
  description = "Security configuration"
  type = object({
    network_policies     = bool
    pod_security        = bool
    encryption_at_rest  = bool
    encryption_in_transit = bool
    service_mesh       = bool
  })
  default = {
    network_policies      = true
    pod_security         = true
    encryption_at_rest   = true
    encryption_in_transit = true
    service_mesh         = true
  }
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    Project   = "kgen"
    ManagedBy = "terraform"
  }
}

# Local values for standardization across cloud providers
locals {
  cluster_name = "${var.project_name}-${var.environment}-cluster"
  
  # Standardized instance types across cloud providers
  instance_types = {
    aws = {
      small     = "m5.large"
      standard  = "m5.xlarge"
      large     = "m5.2xlarge"
      xlarge    = "m5.4xlarge"
    }
    azure = {
      small     = "Standard_D2s_v3"
      standard  = "Standard_D4s_v3"
      large     = "Standard_D8s_v3"
      xlarge    = "Standard_D16s_v3"
    }
    gcp = {
      small     = "n1-standard-2"
      standard  = "n1-standard-4"
      large     = "n1-standard-8"
      xlarge    = "n1-standard-16"
    }
  }
  
  # Standardized database instance classes
  db_instance_classes = {
    aws = {
      small     = "db.t3.large"
      standard  = "db.r6g.xlarge"
      large     = "db.r6g.2xlarge"
      xlarge    = "db.r6g.4xlarge"
    }
    azure = {
      small     = "GP_Gen5_2"
      standard  = "GP_Gen5_4"
      large     = "GP_Gen5_8"
      xlarge    = "GP_Gen5_16"
    }
    gcp = {
      small     = "db-custom-2-8192"
      standard  = "db-custom-4-16384"
      large     = "db-custom-8-32768"
      xlarge    = "db-custom-16-65536"
    }
  }
  
  # Standardized Redis/cache instance types
  cache_node_types = {
    aws = {
      small     = "cache.t3.medium"
      standard  = "cache.r6g.large"
      large     = "cache.r6g.xlarge"
      xlarge    = "cache.r6g.2xlarge"
    }
    azure = {
      small     = "Basic"
      standard  = "Standard"
      large     = "Premium"
      xlarge    = "Premium"
    }
    gcp = {
      small     = "BASIC"
      standard  = "STANDARD_HA"
      large     = "STANDARD_HA"
      xlarge    = "STANDARD_HA"
    }
  }
  
  # Common tags applied to all resources
  common_tags = merge(var.tags, {
    Environment   = var.environment
    CloudProvider = var.cloud_provider
    Region        = var.region
    CreatedAt     = timestamp()
  })
  
  # Kubernetes namespace configuration
  namespaces = var.multi_tenant_config.enabled ? [
    "kgen-system",
    "kgen-monitoring", 
    "kgen-security",
    "tenant-default",
    "tenant-premium",
    "tenant-enterprise"
  ] : ["kgen-system", "kgen-monitoring"]
}

# Generate random passwords for databases
resource "random_password" "database_password" {
  length  = 32
  special = true
}

resource "random_password" "redis_auth_token" {
  count   = var.cloud_provider == "aws" ? 1 : 0
  length  = 128
  special = false
}

# TLS certificate for internal communications
resource "tls_private_key" "internal_ca" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "tls_self_signed_cert" "internal_ca" {
  private_key_pem = tls_private_key.internal_ca.private_key_pem

  subject {
    common_name  = "KGEN Internal CA"
    organization = "KGEN Platform"
  }

  validity_period_hours = 8760 # 1 year

  is_ca_certificate = true

  allowed_uses = [
    "key_encipherment",
    "digital_signature",
    "cert_signing",
  ]
}

# AWS-specific resources
module "aws_infrastructure" {
  count  = var.cloud_provider == "aws" ? 1 : 0
  source = "./aws"

  project_name     = var.project_name
  environment      = var.environment
  region          = var.region
  cluster_name    = local.cluster_name
  
  kubernetes_version = var.kubernetes_version
  
  node_pool_config = {
    instance_type  = local.instance_types.aws[var.node_pool_config.instance_type]
    min_size      = var.node_pool_config.min_nodes
    max_size      = var.node_pool_config.max_nodes
    desired_size  = var.node_pool_config.desired_nodes
    disk_size     = var.node_pool_config.disk_size_gb
  }
  
  database_config = {
    engine_version           = var.database_config.engine_version
    instance_class          = local.db_instance_classes.aws[var.database_config.instance_class]
    allocated_storage       = var.database_config.allocated_storage
    multi_az               = var.database_config.multi_az
    backup_retention_period = var.database_config.backup_retention
    storage_encrypted      = var.database_config.encryption
    master_password        = random_password.database_password.result
  }
  
  redis_config = {
    node_type           = local.cache_node_types.aws[var.redis_config.node_type]
    num_cache_clusters  = var.redis_config.num_cache_nodes
    parameter_group_name = var.redis_config.parameter_group
    automatic_failover_enabled = var.redis_config.auto_failover
    multi_az_enabled   = var.redis_config.multi_az
    auth_token         = random_password.redis_auth_token[0].result
  }
  
  security_config = var.security_config
  tags           = local.common_tags
}

# Azure-specific resources
module "azure_infrastructure" {
  count  = var.cloud_provider == "azure" ? 1 : 0
  source = "./azure"

  project_name     = var.project_name
  environment      = var.environment
  location        = var.region
  cluster_name    = local.cluster_name
  
  kubernetes_version = var.kubernetes_version
  
  node_pool_config = {
    vm_size             = local.instance_types.azure[var.node_pool_config.instance_type]
    min_count          = var.node_pool_config.min_nodes
    max_count          = var.node_pool_config.max_nodes
    node_count         = var.node_pool_config.desired_nodes
    os_disk_size_gb    = var.node_pool_config.disk_size_gb
    enable_auto_scaling = var.node_pool_config.auto_scaling
  }
  
  database_config = {
    sku_name           = local.db_instance_classes.azure[var.database_config.instance_class]
    version            = var.database_config.engine_version
    storage_mb         = var.database_config.allocated_storage * 1024
    backup_retention_days = var.database_config.backup_retention
    geo_redundant_backup_enabled = var.database_config.multi_az
    storage_encrypted  = var.database_config.encryption
    administrator_password = random_password.database_password.result
  }
  
  redis_config = {
    sku_name     = local.cache_node_types.azure[var.redis_config.node_type]
    capacity     = var.redis_config.node_type == "large" ? 1 : 0
    family       = var.redis_config.node_type == "large" ? "P" : "C"
    enable_non_ssl_port = false
  }
  
  security_config = var.security_config
  tags           = local.common_tags
}

# GCP-specific resources
module "gcp_infrastructure" {
  count  = var.cloud_provider == "gcp" ? 1 : 0
  source = "./gcp"

  project_name     = var.project_name
  environment      = var.environment
  region          = var.region
  cluster_name    = local.cluster_name
  
  kubernetes_version = var.kubernetes_version
  
  node_pool_config = {
    machine_type       = local.instance_types.gcp[var.node_pool_config.instance_type]
    min_node_count    = var.node_pool_config.min_nodes
    max_node_count    = var.node_pool_config.max_nodes
    initial_node_count = var.node_pool_config.desired_nodes
    disk_size_gb      = var.node_pool_config.disk_size_gb
    auto_scaling      = var.node_pool_config.auto_scaling
  }
  
  database_config = {
    database_version  = "POSTGRES_${var.database_config.engine_version}"
    tier             = local.db_instance_classes.gcp[var.database_config.instance_class]
    disk_size        = var.database_config.allocated_storage
    availability_type = var.database_config.multi_az ? "REGIONAL" : "ZONAL"
    backup_configuration = {
      enabled                        = true
      start_time                    = "03:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = var.database_config.backup_retention
    }
    database_flags = {
      max_connections = "200"
    }
    root_password = random_password.database_password.result
  }
  
  redis_config = {
    tier               = local.cache_node_types.gcp[var.redis_config.node_type]
    memory_size_gb     = var.redis_config.node_type == "xlarge" ? 16 : 8
    redis_version      = "REDIS_7_0"
    display_name       = "${local.cluster_name}-redis"
    auth_enabled       = true
    transit_encryption_mode = "SERVER_AUTHENTICATION"
  }
  
  security_config = var.security_config
  labels         = local.common_tags
}

# Kubernetes provider configuration
data "aws_eks_cluster" "cluster" {
  count = var.cloud_provider == "aws" ? 1 : 0
  name  = module.aws_infrastructure[0].cluster_name
}

data "aws_eks_cluster_auth" "cluster" {
  count = var.cloud_provider == "aws" ? 1 : 0
  name  = module.aws_infrastructure[0].cluster_name
}

data "azurerm_kubernetes_cluster" "cluster" {
  count               = var.cloud_provider == "azure" ? 1 : 0
  name                = module.azure_infrastructure[0].cluster_name
  resource_group_name = module.azure_infrastructure[0].resource_group_name
}

data "google_container_cluster" "cluster" {
  count    = var.cloud_provider == "gcp" ? 1 : 0
  name     = module.gcp_infrastructure[0].cluster_name
  location = var.region
}

# Configure Kubernetes provider based on cloud provider
provider "kubernetes" {
  host = var.cloud_provider == "aws" ? data.aws_eks_cluster.cluster[0].endpoint : (
    var.cloud_provider == "azure" ? data.azurerm_kubernetes_cluster.cluster[0].kube_config[0].host :
    "https://${data.google_container_cluster.cluster[0].endpoint}"
  )
  
  cluster_ca_certificate = base64decode(
    var.cloud_provider == "aws" ? data.aws_eks_cluster.cluster[0].certificate_authority[0].data : (
      var.cloud_provider == "azure" ? data.azurerm_kubernetes_cluster.cluster[0].kube_config[0].cluster_ca_certificate :
      data.google_container_cluster.cluster[0].master_auth[0].cluster_ca_certificate
    )
  )
  
  token = var.cloud_provider == "aws" ? data.aws_eks_cluster_auth.cluster[0].token : null
  
  client_certificate = var.cloud_provider == "azure" ? base64decode(
    data.azurerm_kubernetes_cluster.cluster[0].kube_config[0].client_certificate
  ) : null
  
  client_key = var.cloud_provider == "azure" ? base64decode(
    data.azurerm_kubernetes_cluster.cluster[0].kube_config[0].client_key
  ) : null
  
  exec {
    api_version = var.cloud_provider == "gcp" ? "client.authentication.k8s.io/v1beta1" : null
    command     = var.cloud_provider == "gcp" ? "gke-gcloud-auth-plugin" : null
  }
}

# Configure Helm provider
provider "helm" {
  kubernetes {
    host = var.cloud_provider == "aws" ? data.aws_eks_cluster.cluster[0].endpoint : (
      var.cloud_provider == "azure" ? data.azurerm_kubernetes_cluster.cluster[0].kube_config[0].host :
      "https://${data.google_container_cluster.cluster[0].endpoint}"
    )
    
    cluster_ca_certificate = base64decode(
      var.cloud_provider == "aws" ? data.aws_eks_cluster.cluster[0].certificate_authority[0].data : (
        var.cloud_provider == "azure" ? data.azurerm_kubernetes_cluster.cluster[0].kube_config[0].cluster_ca_certificate :
        data.google_container_cluster.cluster[0].master_auth[0].cluster_ca_certificate
      )
    )
    
    token = var.cloud_provider == "aws" ? data.aws_eks_cluster_auth.cluster[0].token : null
    
    client_certificate = var.cloud_provider == "azure" ? base64decode(
      data.azurerm_kubernetes_cluster.cluster[0].kube_config[0].client_certificate
    ) : null
    
    client_key = var.cloud_provider == "azure" ? base64decode(
      data.azurerm_kubernetes_cluster.cluster[0].kube_config[0].client_key
    ) : null
    
    exec {
      api_version = var.cloud_provider == "gcp" ? "client.authentication.k8s.io/v1beta1" : null
      command     = var.cloud_provider == "gcp" ? "gke-gcloud-auth-plugin" : null
    }
  }
}

# Create Kubernetes namespaces
resource "kubernetes_namespace" "kgen_namespaces" {
  for_each = toset(local.namespaces)
  
  metadata {
    name = each.value
    
    labels = {
      "app.kubernetes.io/managed-by" = "terraform"
      "kgen.io/environment"         = var.environment
      "kgen.io/tenant-tier" = each.value == "tenant-premium" ? "premium" : (
        each.value == "tenant-enterprise" ? "enterprise" : "standard"
      )
    }
    
    annotations = {
      "kgen.io/created-at" = timestamp()
    }
  }
}

# Create resource quotas for tenant isolation
resource "kubernetes_resource_quota" "tenant_quotas" {
  for_each = var.multi_tenant_config.enabled ? {
    "tenant-default"    = var.multi_tenant_config.default_quotas
    "tenant-premium"    = var.multi_tenant_config.premium_quotas
    "tenant-enterprise" = var.multi_tenant_config.enterprise_quotas
  } : {}
  
  metadata {
    name      = "${each.key}-quota"
    namespace = kubernetes_namespace.kgen_namespaces[each.key].metadata[0].name
  }
  
  spec {
    hard = merge(each.value, {
      "persistentvolumeclaims" = "10"
      "services"              = "20"
      "secrets"               = "50"
      "configmaps"            = "50"
      "pods"                  = "100"
    })
  }
}

# Install Istio service mesh if enabled
resource "helm_release" "istio_base" {
  count = var.security_config.service_mesh ? 1 : 0
  
  name       = "istio-base"
  repository = "https://istio-release.storage.googleapis.com/charts"
  chart      = "base"
  version    = "1.19.0"
  namespace  = "istio-system"
  
  create_namespace = true
  
  values = [
    yamlencode({
      global = {
        meshID      = local.cluster_name
        meshConfig = {
          trustDomain = "cluster.local"
        }
      }
    })
  ]
  
  depends_on = [kubernetes_namespace.kgen_namespaces]
}

resource "helm_release" "istiod" {
  count = var.security_config.service_mesh ? 1 : 0
  
  name       = "istiod"
  repository = "https://istio-release.storage.googleapis.com/charts"
  chart      = "istiod"
  version    = "1.19.0"
  namespace  = "istio-system"
  
  values = [
    yamlencode({
      global = {
        meshID = local.cluster_name
      }
      pilot = {
        resources = {
          requests = {
            cpu    = "500m"
            memory = "2048Mi"
          }
          limits = {
            cpu    = "1000m"
            memory = "4096Mi"
          }
        }
      }
    })
  ]
  
  depends_on = [helm_release.istio_base]
}

# Install monitoring stack if enabled
resource "helm_release" "prometheus_stack" {
  count = var.monitoring_config.enabled && var.monitoring_config.prometheus ? 1 : 0
  
  name       = "kgen-monitoring"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  version    = "51.2.0"
  namespace  = "kgen-monitoring"
  
  values = [
    yamlencode({
      prometheus = {
        prometheusSpec = {
          retention = "${var.monitoring_config.log_retention}d"
          resources = {
            requests = {
              cpu    = "1000m"
              memory = "4Gi"
            }
            limits = {
              cpu    = "2000m"
              memory = "8Gi"
            }
          }
          storageSpec = {
            volumeClaimTemplate = {
              spec = {
                storageClassName = "fast-ssd"
                accessModes      = ["ReadWriteOnce"]
                resources = {
                  requests = {
                    storage = "100Gi"
                  }
                }
              }
            }
          }
        }
      }
      grafana = {
        enabled = var.monitoring_config.grafana
        adminPassword = "admin123"  # Change this in production
        resources = {
          requests = {
            cpu    = "250m"
            memory = "512Mi"
          }
          limits = {
            cpu    = "500m"
            memory = "1Gi"
          }
        }
      }
      alertmanager = {
        enabled = true
        alertmanagerSpec = {
          resources = {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "200m"
              memory = "256Mi"
            }
          }
        }
      }
    })
  ]
  
  depends_on = [kubernetes_namespace.kgen_namespaces]
}

# Install Jaeger tracing if enabled
resource "helm_release" "jaeger" {
  count = var.monitoring_config.enabled && var.monitoring_config.jaeger ? 1 : 0
  
  name       = "jaeger"
  repository = "https://jaegertracing.github.io/helm-charts"
  chart      = "jaeger"
  version    = "0.71.11"
  namespace  = "kgen-monitoring"
  
  values = [
    yamlencode({
      provisionDataStore = {
        cassandra = false
        elasticsearch = true
      }
      elasticsearch = {
        deploy = true
        resources = {
          requests = {
            cpu    = "500m"
            memory = "1Gi"
          }
          limits = {
            cpu    = "1000m"
            memory = "2Gi"
          }
        }
      }
      collector = {
        resources = {
          requests = {
            cpu    = "200m"
            memory = "512Mi"
          }
          limits = {
            cpu    = "400m"
            memory = "1Gi"
          }
        }
      }
      query = {
        resources = {
          requests = {
            cpu    = "200m"
            memory = "512Mi"
          }
          limits = {
            cpu    = "400m"
            memory = "1Gi"
          }
        }
      }
    })
  ]
  
  depends_on = [kubernetes_namespace.kgen_namespaces]
}

# Create secrets for database connections
resource "kubernetes_secret" "database_credentials" {
  metadata {
    name      = "kgen-database-credentials"
    namespace = "kgen-system"
  }
  
  data = {
    host     = var.cloud_provider == "aws" ? module.aws_infrastructure[0].rds_endpoint : (
      var.cloud_provider == "azure" ? module.azure_infrastructure[0].postgres_fqdn :
      module.gcp_infrastructure[0].postgres_connection_name
    )
    port     = "5432"
    database = "kgen_platform"
    username = "kgen_user"
    password = random_password.database_password.result
  }
  
  type = "Opaque"
  
  depends_on = [kubernetes_namespace.kgen_namespaces]
}

resource "kubernetes_secret" "redis_credentials" {
  metadata {
    name      = "kgen-redis-credentials"
    namespace = "kgen-system"
  }
  
  data = {
    host = var.cloud_provider == "aws" ? module.aws_infrastructure[0].redis_endpoint : (
      var.cloud_provider == "azure" ? module.azure_infrastructure[0].redis_hostname :
      module.gcp_infrastructure[0].redis_host
    )
    port = "6379"
    auth_token = var.cloud_provider == "aws" ? random_password.redis_auth_token[0].result : ""
  }
  
  type = "Opaque"
  
  depends_on = [kubernetes_namespace.kgen_namespaces]
}