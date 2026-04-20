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
    prefix = "environments/dev"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

variable "project_id" {
  description = "GCP project ID for dev environment"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

module "cloud_run" {
  source = "../../modules/cloud-run"

  project_id    = var.project_id
  region        = var.region
  service_name  = "rag-eval-pack-dev"
  image         = "gcr.io/${var.project_id}/rag-eval-pack:latest"
  memory        = "512Mi"
  cpu           = "1"
  min_instances = 0
  max_instances = 3

  providers = {
    google = google
  }
}

resource "google_secret_manager_secret" "anthropic_api_key" {
  secret_id = "rag-eval-pack-anthropic-key"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "openai_api_key" {
  secret_id = "rag-eval-pack-openai-key"

  replication {
    auto {}
  }
}