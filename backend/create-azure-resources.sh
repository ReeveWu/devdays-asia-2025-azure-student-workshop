#!/bin/bash

# Azure Resource Creation Script
# This script creates Azure resources for the video processing application

set -e  # Exit on any error

# Configuration
LOCATION="swedencentral"
SUBSCRIPTION_ID=""  # Will be auto-detected

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Azure CLI is installed and user is logged in
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if Azure CLI is installed
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI is not installed. Please install it first."
        print_status "Install Azure CLI: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
        exit 1
    fi
    
    # Check if user is logged in
    if ! az account show &> /dev/null; then
        print_error "Not logged in to Azure. Please run 'az login' first."
        exit 1
    fi
    
    # Get current subscription
    SUBSCRIPTION_ID=$(az account show --query id -o tsv)
    print_success "Using subscription: $SUBSCRIPTION_ID"
}

# Function to get resource group name
get_resource_group_name() {
    echo ""
    print_status "Resource Group Configuration"
    read -p "Enter resource group name: " RESOURCE_GROUP_NAME

    print_status "Using resource group: $RESOURCE_GROUP_NAME"
}

# Function to create resource group
create_resource_group() {
    print_status "Creating resource group: $RESOURCE_GROUP_NAME"
    
    if az group show --name "$RESOURCE_GROUP_NAME" &> /dev/null; then
        print_warning "Resource group '$RESOURCE_GROUP_NAME' already exists"
    else
        az group create \
            --name "$RESOURCE_GROUP_NAME" \
            --location "$LOCATION"
        print_success "Resource group created successfully"
    fi
}

# Function to create storage account
create_storage_account() {
    local storage_name="${RESOURCE_GROUP_NAME}blob"
    
    print_status "Creating storage account: $storage_name"
    
    # Create storage account
    az storage account create \
        --name "$storage_name" \
        --resource-group "$RESOURCE_GROUP_NAME" \
        --location "$LOCATION" \
        --sku "Standard_LRS" \
        --kind "StorageV2" \
        --access-tier "Hot" \
        --allow-blob-public-access false
    
    print_success "Storage account created successfully"
    
    # Create blob container
    print_status "Creating blob container: videos"
    
    # Get storage account connection string
    local connection_string=$(az storage account show-connection-string \
        --name "$storage_name" \
        --resource-group "$RESOURCE_GROUP_NAME" \
        --query connectionString -o tsv)
    
    # Create container
    az storage container create \
        --name "videos" \
        --connection-string "$connection_string" \
        --public-access off
    
    print_success "Blob container 'videos' created successfully"
    
    # Output storage details
    echo ""
    print_status "Storage Account Details:"
    echo "  Name: $storage_name"
    echo "  Container: videos"
    echo "  Connection String: $connection_string"
}

# Function to create AI Search service
create_ai_search() {
    local search_name="${RESOURCE_GROUP_NAME}-search"

    print_status "Creating AI Search service: $search_name"
    
    az search service create \
        --name "$search_name" \
        --resource-group "$RESOURCE_GROUP_NAME" \
        --location "$LOCATION" \
        --sku "basic" \
        --partition-count 1 \
        --replica-count 1
    
    print_success "AI Search service created successfully"
    
    # Get admin key
    local admin_key=$(az search admin-key show \
        --service-name "$search_name" \
        --resource-group "$RESOURCE_GROUP_NAME" \
        --query primaryKey -o tsv)
    
    echo ""
    print_status "AI Search Service Details:"
    echo "  Name: $search_name"
    echo "  Admin Key: $admin_key"
    echo "  Search URL: https://$search_name.search.windows.net"
}

# Function to create AI Foundry (Cognitive Services)
create_ai_foundry() {
    local ai_name="${RESOURCE_GROUP_NAME}-ai"
    
    print_status "Creating AI Foundry: $ai_name"
    
    az cognitiveservices account create \
    --name "$ai_name" \
    --resource-group "$RESOURCE_GROUP_NAME" \
    --kind AIServices \
    --sku S0 \
    --location "$LOCATION" \
    --assign-identity \
    --yes
    
    print_success "AI Foundry service created successfully"
    
    # Get subscription key
    local subscription_key=$(az cognitiveservices account keys list \
        --name "$ai_name" \
        --resource-group "$RESOURCE_GROUP_NAME" \
        --query key1 -o tsv)
    
    # Get endpoint
    local endpoint=$(az cognitiveservices account show \
        --name "$ai_name" \
        --resource-group "$RESOURCE_GROUP_NAME" \
        --query properties.endpoint -o tsv)
    
    echo ""
    print_status "AI Foundry Service Details:"
    echo "  Name: $ai_name"
    echo "  Subscription Key: $subscription_key"
    echo "  Endpoint: $endpoint"
}

# Function to create Function App with Flex Consumption plan
create_function_app() {
    local function_name="${RESOURCE_GROUP_NAME}-func"
    local storage_name="${RESOURCE_GROUP_NAME}blob"   # 這要和 create_storage_account 同名

    print_status "Creating Function App (Flex Consumption, Python 3.12): $function_name"

    az functionapp create \
        --resource-group "$RESOURCE_GROUP_NAME" \
        --name "$function_name" \
        --storage-account "$storage_name" \
        --flexconsumption-location "$LOCATION" \
        --runtime "python" \
        --runtime-version "3.12"

    print_success "Function App created successfully"
    echo ""
    print_status "Function App Details:"
    echo "  Name: $function_name"
    echo "  URL: https://$function_name.azurewebsites.net"
}

# Function to output configuration template
output_config_template() {
    local storage_name="${RESOURCE_GROUP_NAME}blob"
    local search_name="${RESOURCE_GROUP_NAME}-search"
    local ai_name="${RESOURCE_GROUP_NAME}-ai"
    local function_name="${RESOURCE_GROUP_NAME}-func"

    # Get necessary keys and connection strings
    local storage_connection=$(az storage account show-connection-string \
        --name "$storage_name" \
        --resource-group "$RESOURCE_GROUP_NAME" \
        --query connectionString -o tsv)
    
    local search_key=$(az search admin-key show \
        --service-name "$search_name" \
        --resource-group "$RESOURCE_GROUP_NAME" \
        --query primaryKey -o tsv)
    
    local ai_key=$(az cognitiveservices account keys list \
        --name "$ai_name" \
        --resource-group "$RESOURCE_GROUP_NAME" \
        --query key1 -o tsv)
    
    echo ""
    echo "=================================================="
    print_success "All resources created successfully!"
    echo "=================================================="
    echo ""
    print_status "Updated config.yaml template:"
    echo ""
    cat << EOF
azure:
  resourceGroup: 
    name: $RESOURCE_GROUP_NAME
  functionApp:
    name: $function_name
    zipFile: function_app.zip    
  aiService:
    name: $ai_name
    subscriptionKey: $ai_key
    openAI:
      embeddingModelName: text-embedding-3-large
      embeddingDeploymentName: text-embedding-3-large
      embeddingDimensions: 3072
  searchService:
    name: $search_name
    clientKey: $search_key
    indexName: ws-video-index
  storage:
    accountName: $storage_name
    blobContainerName: videos
    connectionString: $storage_connection
EOF
}

# Main execution
main() {
    echo "=================================================="
    echo "Azure Resources Creation Script"
    echo "Location: $LOCATION"
    echo "=================================================="
    
    check_prerequisites
    get_resource_group_name
    
    echo ""
    print_status "Starting resource creation..."
    echo ""
    
    create_resource_group
    create_storage_account
    create_ai_search
    create_ai_foundry
    create_function_app
    
    output_config_template
    
    echo ""
    print_success "Resource creation completed!"
    print_warning "Please update your config.yaml with the values shown above."
    print_warning "Note: You may need to create OpenAI deployments manually in Azure AI Foundry portal."
}

# Run main function
main "$@"
