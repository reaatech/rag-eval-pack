terraform {
  required_version = ">= 1.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    bucket = "rag-eval-pack-terraform-state"
    prefix = "environments/prod"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

variable "project_id" {
  description = "GCP project ID for prod environment"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-east1"
}

module "cloud_run" {
  source = "../../modules/cloud-run"

  project_id    = var.project_id
  region        = var.region
  service_name  = "rag-eval-pack-prod"
  image         = "gcr.io/${var.project_id}/rag-eval-pack:latest"
  memory        = "1Gi"
  cpu           = "2"
  min_instances = 1
  max_instances = 20

  providers = {
    google = google
  }
}

resource "google_secret_manager_secret" "anthropic_api_key" {
  secret_id = "rag-eval-pack-anthropic-key-prod"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "openai_api_key" {
  secret_id = "rag-eval-pack-openai-key-prod"

  replication {
    auto {}
  }
}

resource "google_monitoring_alert" "high_error_rate" {
  display_name = "RAG Eval Pack High Error Rate"
  conditions {
    display_name = "Error rate > 1%"
    condition_threshold {
      filter          = "resource.type=cloud_run_revision AND metric.type=https://cloud.googleapis.com/run.googleapis.com~1/metric/serving|run.googleapis.com/request_count AND resource.labels.service_name=rag-eval-pack-prod"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.01
      duration        = "300s"
    }
  }
}