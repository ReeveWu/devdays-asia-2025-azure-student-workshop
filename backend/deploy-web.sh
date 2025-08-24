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

echo "=========================================="
echo "Step 1: Generating Frontend Configuration"
echo "=========================================="

# Load configuration from YAML file
echo "Parsing configuration from $CONFIG_FILE..."
eval $(parse_yaml $CONFIG_FILE "config_")

# 設定路徑
BACKEND_CONFIG="./config.yaml"
OUTPUT_DIR="../frontend/public"
OUTPUT_FILE="$OUTPUT_DIR/config.js"
BUILD_OUTPUT_FILE="../frontend/build/config.js"

# 從 config.yaml 讀取配置
STORAGE_ACCOUNT_NAME=$config_azure_storage_accountName
STORAGE_CONTAINER_NAME=$config_azure_storage_blobContainerName
FUNCTION_APP_NAME=$config_azure_functionApp_name
AI_SERVICE_NAME=$config_azure_aiService_name
AI_SERVICE_KEY=$config_azure_aiService_subscriptionKey
RESOURCE_GROUP_NAME=$config_azure_resourceGroup_name

echo "配置資訊："
echo "資源群組: $RESOURCE_GROUP_NAME"
echo "儲存帳戶: $STORAGE_ACCOUNT_NAME"
echo "Function App: $FUNCTION_APP_NAME"
echo "AI 服務: $AI_SERVICE_NAME"
echo ""

# 請使用者輸入 OpenAI 部署名稱
read -p "請輸入 OpenAI 部署名稱: " OPENAI_DEPLOYMENT

# 請使用者輸入 SAS Token
read -p "請輸入 Azure Storage SAS Token: " USER_SAS_TOKEN

if [ -z "$USER_SAS_TOKEN" ]; then
    echo "Error: SAS Token 不能為空"
    exit 1
fi

# 確保輸出目錄存在
mkdir -p "$OUTPUT_DIR"

# 生成 config.js 文件
cat > "$OUTPUT_FILE" << EOF
// 運行時配置檔案
// 這個檔案會在應用程式載入時動態讀取，可以在 build 後修改
window.APP_CONFIG = {
  // Azure Storage 配置
  AZURE_STORAGE_ACCOUNT_NAME: '$STORAGE_ACCOUNT_NAME',
  AZURE_STORAGE_CONTAINER_NAME: '$STORAGE_CONTAINER_NAME',
  AZURE_STORAGE_SAS_TOKEN: '$USER_SAS_TOKEN',  // 使用者輸入的 SAS Token
  
  // Video Processor 端點
  VIDEO_PROCESSOR_ENDPOINT: 'https://$FUNCTION_APP_NAME.azurewebsites.net/api/index_video',
  VIDEO_PROCESSOR_DELETE_ENDPOINT: 'https://$FUNCTION_APP_NAME.azurewebsites.net/api/delete_video',
  VIDEO_PROCESSOR_QUERY_ENDPOINT: 'https://$FUNCTION_APP_NAME.azurewebsites.net/api/query_video',

  // Azure OpenAI 配置
  AZURE_OPENAI_ENDPOINT: 'https://$AI_SERVICE_NAME.openai.azure.com/',
  AZURE_OPENAI_API_KEY: '$AI_SERVICE_KEY',
  AZURE_OPENAI_DEPLOYMENT_NAME: '$OPENAI_DEPLOYMENT',
  AZURE_OPENAI_API_VERSION: '2024-10-21',
};
EOF

echo "✅ 成功生成 $OUTPUT_FILE"

# 如果 build 目錄存在，也複製一份到 build 目錄
if [ -d "../frontend/build" ]; then
    cp "$OUTPUT_FILE" "$BUILD_OUTPUT_FILE"
    echo "✅ 同時複製到 $BUILD_OUTPUT_FILE"
fi

echo ""
echo "==============================="
echo "Step 2: Deploying to Azure"
echo "==============================="

# 檢查 frontend/build 目錄是否存在
if [ ! -d "../frontend/build" ]; then
    echo "Error: ../frontend/build 目錄不存在"
    echo "請先執行 'npm run build' 來建立前端應用程式"
    exit 1
fi

echo "正在啟用 Azure Storage Static Website..."
az storage blob service-properties update \
  --account-name "$config_azure_storage_accountName" \
  --connection-string "$config_azure_storage_connectionString" \
  --static-website \
  --index-document index.html \
  --404-document index.html

if [ $? -ne 0 ]; then
    echo "Error: 啟用 Static Website 失敗"
    exit 1
fi

echo "✅ 成功啟用 Static Website"

echo "正在上傳檔案到 Azure Storage..."
az storage blob upload-batch \
  --account-name "$config_azure_storage_accountName" \
  --connection-string "$config_azure_storage_connectionString" \
  --overwrite \
  -s ../frontend/build \
  -d '$web'

if [ $? -ne 0 ]; then
    echo "Error: 檔案上傳失敗"
    exit 1
fi

echo "✅ 檔案上傳成功"

# 取得 Static Website URL
WEBSITE_URL=$(az storage account show \
  --name "$config_azure_storage_accountName" \
  --resource-group "$config_azure_resourceGroup_name" \
  --query "primaryEndpoints.web" \
  --output tsv)

echo ""
echo "=========================================="
echo "✅ 部署完成！"
echo "=========================================="
echo "Website URL: $WEBSITE_URL"
echo "配置文件已生成並部署到 Azure Static Website"
echo "=========================================="
