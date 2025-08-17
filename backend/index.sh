#!/usr/bin/env bash
set -euo pipefail

# This script reads backend/config.yaml, exports env vars expected by
# create_index/create_aisearch_index.py, then runs the Python script.

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

# Resolve paths relative to this script so it works from any CWD
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/config.yaml"
PY_SCRIPT="$SCRIPT_DIR/create_index/create_aisearch_index.py"

if [ ! -f "$CONFIG_FILE" ]; then
        echo "Error: config.yaml not found at $CONFIG_FILE" >&2
        exit 1
fi

echo "Parsing configuration from $CONFIG_FILE..."
# shellcheck disable=SC2046
eval $(parse_yaml "$CONFIG_FILE" "config_")

# Map YAML values to environment variables expected by the Python script
export SEARCH_SERVICE_NAME="${config_azure_searchService_name:-}"
export SEARCH_CLIENT_KEY="${config_azure_searchService_clientKey:-}"
export AZURE_OPENAI_RESOURCE_URL="https://${config_azure_aiService_name:-}.openai.azure.com"
export AZURE_OPENAI_API_KEY="${config_azure_aiService_subscriptionKey:-}"
export AZURE_OPENAI_EMBEDDING_MODEL_NAME="${config_azure_aiService_openAI_embeddingModelName:-}"
export AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME="${config_azure_aiService_openAI_embeddingDeploymentName:-}"
export AZURE_OPENAI_EMBEDDING_DIMENSIONS="${config_azure_aiService_openAI_embeddingDimensions:-3072}"
export SEARCH_INDEX_NAME="${config_azure_searchService_indexName:-}"

# Basic validation
missing=()
for var in \
    SEARCH_SERVICE_NAME SEARCH_CLIENT_KEY \
    AZURE_OPENAI_RESOURCE_URL AZURE_OPENAI_API_KEY \
    AZURE_OPENAI_EMBEDDING_MODEL_NAME AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME \
    SEARCH_INDEX_NAME; do
    if [ -z "${!var:-}" ]; then
        missing+=("$var")
    fi
done

if [ ${#missing[@]} -gt 0 ]; then
    echo "Error: missing required configuration for: ${missing[*]}" >&2
    echo "Check backend/config.yaml and try again." >&2
    exit 1
fi

# Helper to mask secrets in logs
mask() {
    local s="${1:-}"
    if [ -z "$s" ]; then echo ""; return; fi
    local len=${#s}
    if [ $len -le 8 ]; then echo "****"; else echo "${s:0:4}****${s: -4}"; fi
}

echo "Configured:"
echo "- Search service: $SEARCH_SERVICE_NAME"
echo "- Search index:  $SEARCH_INDEX_NAME"
echo "- OpenAI endpoint: $AZURE_OPENAI_RESOURCE_URL"
echo "- OpenAI API key:  $(mask "$AZURE_OPENAI_API_KEY")"
echo "- Search client key: $(mask "$SEARCH_CLIENT_KEY")"
echo "- Embedding: model=$AZURE_OPENAI_EMBEDDING_MODEL_NAME, deployment=$AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME, dims=$AZURE_OPENAI_EMBEDDING_DIMENSIONS"

# Choose Python interpreter
PYTHON_BIN=${PYTHON_BIN:-}
if [ -z "${PYTHON_BIN}" ]; then
    if command -v python >/dev/null 2>&1; then
        PYTHON_BIN=python
    else
        echo "Error: Python is not installed or not in PATH" >&2
        exit 1
    fi
fi

echo "Installing Python dependencies..."
"$PYTHON_BIN" -m pip install -r "$SCRIPT_DIR/create_index/requirements.txt"
echo "Running index creation with $PYTHON_BIN ..."
"$PYTHON_BIN" "$PY_SCRIPT"
echo "Done."

