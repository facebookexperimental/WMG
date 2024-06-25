terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "5.4.0"
    }
  }
}

provider "google" {
  credentials = file("meta-be-gbg-latam-gcp-account-7a35fc8ee8d6.json")

  project = "meta-be-gbg-latam-gcp-account"
  region  = "southamerica-east1"
  zone    = "southamerica-east1-c"
}

provider "google-beta" {
  credentials = file("meta-be-gbg-latam-gcp-account-7a35fc8ee8d6.json")

  project = "meta-be-gbg-latam-gcp-account"
  region  = "southamerica-east1"
  zone    = "southamerica-east1-c"
}

// local variables/constants
locals {
  project      = "meta-be-gbg-latam-gcp-account" # Google Cloud Platform Project ID
  display_name = "API Display Name"

  func_name        = "helloworld"
  second_func_name = "hello-pull-store"
  timestamp        = formatdate("YYMMDDhhmmss", timestamp())

  db_socket      = "/cloudsql/meta-be-gbg-latam-gcp-account:us-central1:mysql-8-wmg"
  db_name        = "wmg"
  db_user        = "admin"
  db_secret_name = "projects/271499818238/secrets/wmg-secret-1/versions/latest"
}

//-----------------------------------------------------------------------------------------------------------------------------
// Networking
//************
resource "google_compute_network" "wmg_peering_network" {
  name                    = "wmg-private-network"
  auto_create_subnetworks = "false"
}

resource "google_compute_global_address" "wmg_private_ip_address" {
  name          = "wmg-private-ip-address"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.wmg_peering_network.id
}

resource "google_service_networking_connection" "wmg_default" {
  network                 = google_compute_network.wmg_peering_network.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.wmg_private_ip_address.name]
}

resource "google_compute_network_peering_routes_config" "peering_routes" {
  peering              = google_service_networking_connection.wmg_default.peering
  network              = google_compute_network.wmg_peering_network.name
  import_custom_routes = true
  export_custom_routes = true
}

resource "google_vpc_access_connector" "connector-wmg" {
  name          = "vpc-con-wmg"
  ip_cidr_range = "10.8.0.0/28"
  network       = google_compute_network.wmg_peering_network.name
  region        = "us-central1"
}

//-----------------------------------------------------------------------------------------------------------------------------
// Cloud Function
//***************
resource "google_storage_bucket" "bucket" {
  name                        = "wmg-bucket"
  location                    = "SOUTHAMERICA-EAST1"
  uniform_bucket_level_access = true

  force_destroy = true
  versioning {
    enabled = true
  }
}

//https://stackoverflow.com/questions/74320094/getting-function-js-does-not-exist-error-when-deploying-1st-gen-cloud-function
# upload zipped code to the bucket
resource "google_storage_bucket_object" "archive" {
  //name   = "helloworld.zip"
  name   = "${local.func_name}_${local.timestamp}.zip" // hack to force update (ref.: https://github.com/hashicorp/terraform-provider-google/issues/1938)
  bucket = google_storage_bucket.bucket.name
  source = "./functions/helloworld.zip"
}

//https://cloud.google.com/functions/docs/tutorials/terraform
//https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/cloudfunctions2_function
resource "google_cloudfunctions2_function" "default" {
  name        = "function-wmg"
  location    = "us-central1"
  description = "Function that forwards the call to Meta endpoint."

  build_config {
    runtime     = "nodejs18"
    entry_point = "helloGET" # Set the entry point
    environment_variables = {
      BUILD_CONFIG_TEST = "build_test"
    }
    source {
      storage_source {
        bucket = google_storage_bucket.bucket.name
        object = google_storage_bucket_object.archive.name
      }
    }
  }

  service_config {
    max_instance_count = 3
    min_instance_count = 1
    available_memory   = "256M"
    timeout_seconds    = 60
    environment_variables = {
      SERVICE_CONFIG_TEST = "config_test"
    }
    ingress_settings               = "ALLOW_ALL"
    all_traffic_on_latest_revision = true
    service_account_email          = google_service_account.wmg-sa1.email
  }
}

// WMG
# DB Init
resource "google_storage_bucket_object" "db-init-archive" {
  name   = "db_init_${local.timestamp}.zip"
  bucket = google_storage_bucket.bucket.name
  source = "./functions/db_init.zip"
}

resource "google_cloudfunctions2_function" "default-db-init" {
  name        = "db-init"
  location    = "us-central1"
  description = "Function that init WMG databse."

  build_config {
    runtime               = "nodejs18"
    entry_point           = "db_init_handler"
    environment_variables = {}
    source {
      storage_source {
        bucket = google_storage_bucket.bucket.name
        object = google_storage_bucket_object.db-init-archive.name
      }
    }
  }

  service_config {
    max_instance_count = 3
    min_instance_count = 1
    available_memory   = "256M"
    timeout_seconds    = 60
    environment_variables = {
      DB_HOST        = google_sql_database_instance.wmg-db.private_ip_address
      DB_USER        = local.db_user
      DB_NAME        = local.db_name
      DB_SECRET_NAME = local.db_secret_name
    }
    vpc_connector                  = google_vpc_access_connector.connector-wmg.name
    ingress_settings               = "ALLOW_ALL"
    all_traffic_on_latest_revision = true
    service_account_email          = "meta-be-gbg-latam-gcp-account@appspot.gserviceaccount.com"
  }
}

# Router
resource "google_storage_bucket_object" "router-archive" {
  name   = "router_${local.timestamp}.zip"
  bucket = google_storage_bucket.bucket.name
  source = "./functions/router.zip"
}

resource "google_cloudfunctions2_function" "default-router" {
  name        = "router"
  location    = "us-central1"
  description = "Function that calls WA Cloud API and enqueues task."

  build_config {
    runtime               = "nodejs18"
    entry_point           = "router_handler"
    environment_variables = {}
    source {
      storage_source {
        bucket = google_storage_bucket.bucket.name
        object = google_storage_bucket_object.router-archive.name
      }
    }
  }

  service_config {
    max_instance_count = 3
    min_instance_count = 1
    available_memory   = "256M"
    timeout_seconds    = 60
    environment_variables = {
      DB_HOST        = google_sql_database_instance.wmg-db.private_ip_address
      DB_USER        = local.db_user
      DB_NAME        = local.db_name
      DB_SECRET_NAME = local.db_secret_name
      TOPIC_NAME     = "projects/meta-be-gbg-latam-gcp-account/topics/functions2-wmg-topic"
    }
    vpc_connector                  = google_vpc_access_connector.connector-wmg.name
    ingress_settings               = "ALLOW_ALL"
    all_traffic_on_latest_revision = true
    service_account_email          = "meta-be-gbg-latam-gcp-account@appspot.gserviceaccount.com"
  }
}

# Process Signals
resource "google_storage_bucket_object" "process-signals-archive" {
  name   = "process_signals_${local.timestamp}.zip"
  bucket = google_storage_bucket.bucket.name
  source = "./functions/process_signals.zip"
}

resource "google_cloudfunctions2_function" "default-process-signals" {
  name        = "process-signals"
  location    = "us-central1"
  description = "Process PubSub messages searching for keywords to be saved in the signals table"

  build_config {
    runtime               = "nodejs18"
    entry_point           = "process_signals" # Set the entry point
    environment_variables = {}
    source {
      storage_source {
        bucket = google_storage_bucket.bucket.name
        object = google_storage_bucket_object.process-signals-archive.name
      }
    }
  }

  service_config {
    max_instance_count = 3
    min_instance_count = 1
    available_memory   = "256M"
    timeout_seconds    = 60
    environment_variables = {
      DB_HOST        = google_sql_database_instance.wmg-db.private_ip_address
      DB_USER        = local.db_user
      DB_NAME        = local.db_name
      DB_SECRET_NAME = local.db_secret_name
    }
    vpc_connector                  = google_vpc_access_connector.connector-wmg.name
    ingress_settings               = "ALLOW_INTERNAL_ONLY"
    all_traffic_on_latest_revision = true
    service_account_email          = "meta-be-gbg-latam-gcp-account@appspot.gserviceaccount.com"
  }

  event_trigger {
    trigger_region = "us-central1"
    event_type     = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic   = google_pubsub_topic.wmg-topic.id
    retry_policy   = "RETRY_POLICY_RETRY"
  }
}

# Manage Keywords
resource "google_storage_bucket_object" "manage-keywords-archive" {
  name   = "manage_keywords_${local.timestamp}.zip"
  bucket = google_storage_bucket.bucket.name
  source = "./functions/manage_keywords.zip"
}

resource "google_cloudfunctions2_function" "default-manage-keywords" {
  name        = "manage-keywords"
  location    = "us-central1"
  description = "Function to make CRUD operations in keywords table."

  build_config {
    runtime               = "nodejs18"
    entry_point           = "manage_keywords_handler"
    environment_variables = {}
    source {
      storage_source {
        bucket = google_storage_bucket.bucket.name
        object = google_storage_bucket_object.manage-keywords-archive.name
      }
    }
  }

  service_config {
    max_instance_count = 3
    min_instance_count = 1
    available_memory   = "256M"
    timeout_seconds    = 60
    environment_variables = {
      DB_HOST        = google_sql_database_instance.wmg-db.private_ip_address
      DB_USER        = local.db_user
      DB_NAME        = local.db_name
      DB_SECRET_NAME = local.db_secret_name
    }
    vpc_connector                  = google_vpc_access_connector.connector-wmg.name
    ingress_settings               = "ALLOW_ALL"
    all_traffic_on_latest_revision = true
    service_account_email          = "meta-be-gbg-latam-gcp-account@appspot.gserviceaccount.com"
  }
}

# Campaigns Performance
resource "google_storage_bucket_object" "campaigns-performance-archive" {
  name   = "campaigns_performance_${local.timestamp}.zip"
  bucket = google_storage_bucket.bucket.name
  source = "./functions/campaigns_performance.zip"
}

resource "google_cloudfunctions2_function" "default-campaigns-performance" {
  name        = "campaigns-performance"
  location    = "us-central1"
  description = "Function to generate output file with campaignss performance info."

  build_config {
    runtime               = "nodejs18"
    entry_point           = "campaigns_performance_handler"
    environment_variables = {}
    source {
      storage_source {
        bucket = google_storage_bucket.bucket.name
        object = google_storage_bucket_object.campaigns-performance-archive.name
      }
    }
  }

  service_config {
    max_instance_count = 3
    min_instance_count = 1
    available_memory   = "256M"
    timeout_seconds    = 60
    environment_variables = {
      DB_HOST        = google_sql_database_instance.wmg-db.private_ip_address
      DB_USER        = local.db_user
      DB_NAME        = local.db_name
      DB_SECRET_NAME = local.db_secret_name
      BUCKET_NAME    = google_storage_bucket.bucket.name
    }
    vpc_connector                  = google_vpc_access_connector.connector-wmg.name
    ingress_settings               = "ALLOW_ALL"
    all_traffic_on_latest_revision = true
    service_account_email          = "meta-be-gbg-latam-gcp-account@appspot.gserviceaccount.com"
  }
}

# Lift Studies
resource "google_storage_bucket_object" "lift-studies-archive" {
  name   = "lift_studies_${local.timestamp}.zip"
  bucket = google_storage_bucket.bucket.name
  source = "./functions/lift_studies.zip"
}

resource "google_cloudfunctions2_function" "default-lift-studies" {
  name        = "lift-studies"
  location    = "us-central1"
  description = "Function to generate output file with lifts studies info."

  build_config {
    runtime               = "python39"
    entry_point           = "lift_studies_handler"
    environment_variables = {}
    source {
      storage_source {
        bucket = google_storage_bucket.bucket.name
        object = google_storage_bucket_object.lift-studies-archive.name
      }
    }
  }

  service_config {
    max_instance_count = 3
    min_instance_count = 1
    available_memory   = "256M"
    timeout_seconds    = 60
    environment_variables = {
      DB_HOST        = google_sql_database_instance.wmg-db.private_ip_address
      DB_USER        = local.db_user
      DB_NAME        = local.db_name
      DB_SECRET_NAME = local.db_secret_name
      BUCKET_NAME    = google_storage_bucket.bucket.name
    }
    vpc_connector                  = google_vpc_access_connector.connector-wmg.name
    ingress_settings               = "ALLOW_ALL"
    all_traffic_on_latest_revision = true
    service_account_email          = "meta-be-gbg-latam-gcp-account@appspot.gserviceaccount.com"
  }
}
// WMG

// Create IAM entry so all users can invoke the function
//https://cloud.google.com/functions/docs/reference/iam/roles
//https://console.cloud.google.com/run/detail/us-central1/function-wmg/security?authuser=1&project=meta-be-gbg-latam-gcp-account
//Authentication: Allow unauthenticated invocations | Require authentication

data "google_iam_policy" "invoker" {
  binding {
    role = "roles/viewer"
    members = [
      "allAuthenticatedUsers"
    ]
  }
}

resource "google_cloudfunctions2_function_iam_policy" "policy" {
  project        = google_cloudfunctions2_function.default.project
  location       = google_cloudfunctions2_function.default.location
  cloud_function = google_cloudfunctions2_function.default.name
  policy_data    = data.google_iam_policy.invoker.policy_data
}

//https://cloud.google.com/billing/docs/reference/rest/v1/Policy#Binding
data "google_iam_policy" "invoker2" {
  binding {
    role = "roles/run.invoker"
    members = [
      "allAuthenticatedUsers"
    ]
  }
}

resource "google_cloud_run_service_iam_policy" "policy2" {
  location    = google_cloudfunctions2_function.default.location
  project     = google_cloudfunctions2_function.default.project
  service     = google_cloudfunctions2_function.default.name
  policy_data = data.google_iam_policy.invoker2.policy_data
}

//-----------------------------------------------------------------------------------------------------------------------------
// API Gateway (beta)
//************
//https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/api_gateway_api
resource "google_api_gateway_api" "api" {
  provider     = google-beta
  api_id       = "wmg-api"
  display_name = "Protected API for WMG."
}

//https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/api_gateway_api_config
resource "google_api_gateway_api_config" "api_cfg" {
  provider      = google-beta
  api           = google_api_gateway_api.api.api_id
  api_config_id = "wmg-config"

  openapi_documents {
    document {
      path     = "spec.yaml"
      contents = filebase64("./wmg-openapi-configuration.yaml")
    }
  }
  lifecycle {
    create_before_destroy = true
  }
}

//https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/api_gateway_gateway
resource "google_api_gateway_gateway" "wmg_gw" {
  provider = google-beta
  region   = "us-central1"

  api_config = google_api_gateway_api_config.api_cfg.id

  gateway_id   = "wmg-gateway"
  display_name = local.display_name

  depends_on = [google_api_gateway_api_config.api_cfg]
}

//-----------------------------------------------------------------------------------------------------------------------------
// Topic
//******
// https://cloud.google.com/functions/docs/tutorials/terraform-pubsub

//https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/google_service_account
resource "google_service_account" "wmg-sa1" {
  account_id   = "test-topic-wmg-sa"
  display_name = "Test Service Account for WMG"
  description  = "You should manually give it permissions on GCP console..."
}

resource "google_pubsub_topic" "wmg-topic" {
  name = "functions2-wmg-topic"

  labels = {
    project = "meta-wmg" //lowercase
  }

  message_retention_duration = "86600s" //If this field is not set, message retention is controlled by settings on individual subscriptions. Cannot be more than 31 days or less than 10 minutes.
}

//https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/pubsub_subscription
resource "google_pubsub_subscription" "wmg-pull-subscription" {
  name  = "wmg-subscription"
  topic = google_pubsub_topic.wmg-topic.name

  labels = {
    project = "meta-wmg"
  }

  # 20 minutes
  message_retention_duration = "1200s"
  retain_acked_messages      = true

  ack_deadline_seconds = 20

  expiration_policy {
    ttl = "300000.5s"
  }
  retry_policy {
    minimum_backoff = "10s"
  }

  enable_message_ordering = false
}

//https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/pubsub_topic_iam
resource "google_pubsub_topic_iam_member" "publisher" {
  project = local.project
  topic   = google_pubsub_topic.wmg-topic.name
  role    = "roles/pubsub.publisher"

  //https://cloud.google.com/billing/docs/reference/rest/v1/Policy#Binding
  //member = "serviceAccount:${google_service_account.wmg-sa1.email}"
  member = "allAuthenticatedUsers"

  depends_on = [google_pubsub_topic.wmg-topic]
}

//-----------------------------------------------------------------------------------------------------------------------------
// Cloud SQL (relational database)
//********************************
#https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/sql_database
resource "google_sql_database" "database" {
  name     = "wmg"
  instance = google_sql_database_instance.wmg-db.name
}

resource "google_sql_database_instance" "wmg-db" {
  name             = "mysql-8-wmg"
  region           = "us-central1"
  database_version = "MYSQL_8_0"
  root_password    = "businessEngineeringRules!2023" # must be manually created https://console.cloud.google.com/sql/instances/mysql-8-wmg/users?authuser=1&project=meta-be-gbg-latam-gcp-account

  depends_on = [google_service_networking_connection.wmg_default]

  settings {
    tier = "db-f1-micro"
    ip_configuration {
      ipv4_enabled    = "false"
      private_network = google_compute_network.wmg_peering_network.id
    }
    password_validation_policy {
      min_length                  = 6
      complexity                  = "COMPLEXITY_DEFAULT"
      reuse_interval              = 2
      disallow_username_substring = true
      enable_password_policy      = true
    }
  }
  # set `deletion_protection` to true, will ensure that one cannot accidentally delete this instance by
  # use of Terraform whereas `deletion_protection_enabled` flag protects this instance at the GCP level.
  deletion_protection = false
}

resource "google_sql_user" "users" {
  name     = "admin"
  instance = google_sql_database_instance.wmg-db.name
  password = "businessEngineeringRules!2023" # same password to set to secrets manager
}

//-----------------------------------------------------------------------------------------------------------------------------
// Pull Function (topic trigger)
//******************************
#https://cloud.google.com/functions/docs/tutorials/terraform-pubsub

# upload 2nd zipped code to the bucket
resource "google_storage_bucket_object" "hello-pull-store-archive" {
  name   = "${local.second_func_name}_${local.timestamp}.zip" // hack to force update (ref.: https://github.com/hashicorp/terraform-provider-google/issues/1938)
  bucket = google_storage_bucket.bucket.name
  source = "./functions/hello-pull-store.zip" # $> tar -a -c -f hello-pull-store.zip -C hello-pull-store *.*
}

// 2nd function (pull trigger from topic/subscription)
resource "google_cloudfunctions2_function" "default2" {
  name        = "function-wmg-2"
  location    = "us-central1"
  description = "a new wmg function triggered by a message being published"

  build_config {
    runtime     = "nodejs18"
    entry_point = "helloPubSub" # Set the entry point
    environment_variables = {
      BUILD_CONFIG_TEST = "build_test"
    }
    source {
      storage_source {
        bucket = google_storage_bucket.bucket.name
        object = google_storage_bucket_object.hello-pull-store-archive.name
      }
    }
  }

  service_config {
    max_instance_count = 3
    min_instance_count = 1
    available_memory   = "256M"
    timeout_seconds    = 60
    environment_variables = {
      SERVICE_CONFIG_TEST = "config_test"
    }
    ingress_settings               = "ALLOW_INTERNAL_ONLY"
    all_traffic_on_latest_revision = true
    service_account_email          = google_service_account.wmg-sa1.email
  }

  event_trigger {
    trigger_region = "us-central1"
    event_type     = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic   = google_pubsub_topic.wmg-topic.id
    retry_policy   = "RETRY_POLICY_RETRY"
  }
}

//-----------------------------------------------------------------------------------------------------------------------------
// Secret (database credentials)
//******************************
#https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/secret_manager_secret.html
resource "google_secret_manager_secret" "wmg-db-secret" {
  secret_id = "wmg-secret-1"

  labels = {
    label = "wmg-solution"
  }

  replication {
    user_managed {
      replicas {
        location = "us-central1"
      }
      replicas {
        location = "us-east1"
      }
    }
  }
}

// TODO: manually inform value here => https://console.cloud.google.com/security/secret-manager/secret/wmg-secret-1/versions?authuser=1&project=meta-be-gbg-latam-gcp-account

//-----------------------------------------------------------------------------------------------------------------------------
output "function_name" {
  value = google_storage_bucket_object.archive.name
}

output "function_uri" {
  value = google_cloudfunctions2_function.default.service_config[0].uri
}

output "new_service_account" {
  value = google_service_account.wmg-sa1.email
}

output "db_public_ip" {
  value = google_sql_database_instance.wmg-db.public_ip_address
}

output "db_private_ip" {
  value = google_sql_database_instance.wmg-db.private_ip_address
}

output "second_function_name" {
  value = google_storage_bucket_object.hello-pull-store-archive.name
}

output "second_function_uri" {
  value = google_cloudfunctions2_function.default2.service_config[0].uri
}
