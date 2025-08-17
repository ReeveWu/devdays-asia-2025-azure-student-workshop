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
CONFIG_FILE="config.yaml"
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: $CONFIG_FILE not found"
    exit 1
fi

# Load configuration from YAML file
echo "Parsing configuration from $CONFIG_FILE..."
eval $(parse_yaml $CONFIG_FILE "config_")

# Update the function app environment variables
echo "Updating function app environment variables..."
az functionapp config appsettings set \
  --name "$config_azure_functionApp_name" \
  --resource-group "$config_azure_resourceGroup_name" \
  --settings AZURE_OPENAI_ENDPOINT="https://$config_azure_aiService_name.openai.azure.com" \
              AZURE_OPENAI_API_KEY="$config_azure_aiService_subscriptionKey" \
              AZURE_OPENAI_EMBEDDING_MODEL_NAME="$config_azure_aiService_openAI_embeddingModelName" \
              AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME="$config_azure_aiService_openAI_embeddingDeploymentName" \
              AZURE_OPENAI_EMBEDDING_DIMENSIONS="$config_azure_aiService_openAI_embeddingDimensions" \
              STORAGE_CONNECTION_STRING="$config_azure_storage_connectionString" \
              BLOB_CONTAINER_NAME="$config_azure_storage_blobContainerName" \
              AI_FOUNDRY_NAME="$config_azure_aiService_name" \
              AI_SERVICE_SUBSCRIPTION_KEY="$config_azure_aiService_subscriptionKey" \
              SEARCH_SERVICE_NAME="$config_azure_searchService_name" \
              SEARCH_SERVICE_CLIENT_KEY="$config_azure_searchService_clientKey" \
              SEARCH_SERVICE_INDEX_NAME="$config_azure_searchService_indexName"

# Package the function app
echo "Packaging function app..."
cd function_app
zip -r "../$config_azure_functionApp_zipFile" .
cd ..

# Deploy the function app
echo "Deploying function app (It may take a while)..."
az functionapp deployment source config-zip \
  --resource-group "$config_azure_resourceGroup_name" \
  --name "$config_azure_functionApp_name" \
  --src "$config_azure_functionApp_zipFile"

rm -rf "$config_azure_functionApp_zipFile"

# Configure CORS settings for the function app
echo "Configuring CORS settings for the function app..."
az functionapp cors remove \
  --resource-group "$config_azure_resourceGroup_name" \
  --name "$config_azure_functionApp_name" \
  --allowed-origins

az functionapp cors add \
  --resource-group "$config_azure_resourceGroup_name" \
  --name "$config_azure_functionApp_name" \
  --allowed-origins '*'

echo "Deployment completed successfully!"