// 運行時配置檔案
// 這個檔案會在應用程式載入時動態讀取，可以在 build 後修改
window.APP_CONFIG = {
  // Azure Storage 配置
  AZURE_STORAGE_ACCOUNT_NAME: '',
  AZURE_STORAGE_CONTAINER_NAME: 'videos',
  AZURE_STORAGE_SAS_TOKEN: '',  // 請在這裡填入您的 SAS Token
  
  // Video Processor 端點
  VIDEO_PROCESSOR_ENDPOINT: '',  // 請在這裡填入您的 Function App 端點
  VIDEO_PROCESSOR_DELETE_ENDPOINT: '',  // 請在這裡填入刪除端點
  VIDEO_PROCESSOR_QUERY_ENDPOINT: '',  // 請在這裡填入查詢端點
  
  // Azure OpenAI 配置
  AZURE_OPENAI_ENDPOINT: '',  // 請在這裡填入您的 OpenAI 端點
  AZURE_OPENAI_API_KEY: '',  // 請在這裡填入您的 API Key
  AZURE_OPENAI_DEPLOYMENT_NAME: '',  // 請在這裡填入部署名稱
  AZURE_OPENAI_API_VERSION: '2024-10-21',  // API 版本
};
