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

# Configure access policies for the storage account
echo "Configuring access policies for the storage account..."
# /bin/az storage account update \
#   --name "$config_azure_storage_accountName" \
#   --resource-group "$config_azure_resourceGroup_name" \
#   --allow-blob-public-access true

# /bin/az storage container set-permission \
#   --name "$config_azure_storage_blobContainerName" \
#   --account-name "$config_azure_storage_accountName" \
#   --public-access blob \
#   --connection-string "$config_azure_storage_connectionString"

# Configure CORS settings for the storage account
echo "Configuring CORS settings for the storage account..."
/bin/az storage cors clear \
  --services b \
  --account-name "$config_azure_storage_accountName" \
  --connection-string "$config_azure_storage_connectionString"

/bin/az storage cors add \
  --services b \
  --origins '*' \
  --methods GET PUT OPTIONS POST DELETE \
  --allowed-headers '*' \
  --exposed-headers 'x-ms-blob-type,content-type' \
  --max-age 0 \
  --account-name "$config_azure_storage_accountName" \
  --connection-string "$config_azure_storage_connectionString"