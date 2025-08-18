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

az storage blob service-properties update \
  --account-name "$config_azure_storage_accountName" \
  --connection-string "$config_azure_storage_connectionString" \
  --static-website \
  --index-document index.html \
  --404-document index.html

az storage blob upload-batch \
  --account-name "$config_azure_storage_accountName" \
  --connection-string "$config_azure_storage_connectionString" \
  --overwrite \
  -s ../frontend/build \
  -d '$web'