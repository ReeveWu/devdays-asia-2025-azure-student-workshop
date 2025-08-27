#!/bin/bash

parse_yaml() {
    local prefix=$2
    local s='[[:space:]]*' w='[a-zA-Z0-9_]*' fs=$(echo @|tr @ '\034')
    sed -ne "s|^\($s\):|\1|" \
        -e "s|^\($s\)\($w\)$s:$s[\"']\(.*\)[\"']$s\$|\1$fs\2$fs\3|p" \
        -e "s|^\($s\)\($w\)$s:$s\(.*\)$s\$|\1$fs\2$fs\3|p" $1 |
    awk -F$fs '{
        indent = length($1)/2;
        vname[indent] = $2;
        for (i in vname) {if (i > indent) {delete vname[i]}}
        if (length($3) > 0) {
            vn=""; for (i=0; i<indent; i++) {vn=(vn)(vname[i])("_")}
            printf("%s%s%s=\"%s\"\n", "'$prefix'",vn, $2, $3);
        }
    }'
}

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "Error: Azure CLI is not installed"
    exit 1
fi

# Check if config file exists
CONFIG_FILE="config.yaml"
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: $CONFIG_FILE not found"
    exit 1
fi

# Load configuration from YAML file
echo "Parsing configuration from $CONFIG_FILE..."
eval $(parse_yaml $CONFIG_FILE "config_")

# Configuration
LOCATION="westus2"
read -p "Enter resource group name: " RESOURCE_GROUP_NAME
read -p "Enter AI service name: " AI_SERVICE_NAME

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


# Function to create Function App with Flex Consumption plan
create_function_app() {
    local function_name="${RESOURCE_GROUP_NAME}-func"
    local storage_name="${RESOURCE_GROUP_NAME}blob"

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
    local ai_name="${AI_SERVICE_NAME}"
    local storage_name="${RESOURCE_GROUP_NAME}blob"
    local search_name="${RESOURCE_GROUP_NAME}-search"
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
    # Create/update config.yaml with the generated values
    cat << EOF > config.yaml
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
    
    print_success "Configuration written to config.yaml"
}

# Main execution
main() {
    echo "=================================================="
    echo "Azure Resources Creation Script"
    echo "Location: $LOCATION"
    echo "=================================================="
    
    echo ""
    print_status "Starting resource creation..."
    echo ""

    create_ai_search
    create_storage_account
    create_function_app
    
    output_config_template

    print_success "Resource creation completed!"

    print_status "Creating AI Search Index..."
    bash index.sh

    print_status "Uploading Function Script..."
    bash functionapp.sh

    print_status "Setting CORS for Storage Account..."
    bash storage.sh

    print_success "All resources created successfully!"
}

# Run main function
main "$@"
