variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  description = "Name of the Cloud Run service"
  type        = string
  default     = "rag-eval-pack"
}

variable "image" {
  description = "Container image URL"
  type        = string
}

variable "memory" {
  description = "Memory allocation"
  type        = string
  default     = "512Mi"
}

variable "cpu" {
  description = "CPU allocation"
  type        = string
  default     = "1"
}

variable "min_instances" {
  description = "Minimum instances"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum instances"
  type        = number
  default     = 10
}

resource "google_cloud_run_v2_service" "rag_eval_pack" {
  name     = var.service_name
  location = var.region

  template {
    service_account = google_service_account.rag_eval_pack.email

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = var.image
      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
      }
      ports {
        container_port = 3000
        name           = "http1"
      }
      env {
        name  = "NODE_ENV"
        value = "production"
      }
    }
  }
}

resource "google_service_account" "rag_eval_pack" {
  account_id   = "${var.service_name}-sa"
  display_name = "RAG Eval Pack Service Account"
}

resource "google_cloud_run_v2_service_iam_member" "rag_eval_pack" {
  location = var.region
  name     = google_cloud_run_v2_service.rag_eval_pack.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.rag_eval_pack.email}"
}

output "service_url" {
  value = google_cloud_run_v2_service.rag_eval_pack.uri
}

output "service_email" {
  value = google_service_account.rag_eval_pack.email
}