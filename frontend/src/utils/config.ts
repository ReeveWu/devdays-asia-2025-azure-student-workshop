// 環境變數配置
export const config = {
  // Azure Blob Storage
  azureStorage: {
    connectionString: process.env.REACT_APP_AZURE_STORAGE_CONNECTION_STRING || '',
    containerName: process.env.REACT_APP_AZURE_STORAGE_CONTAINER_NAME || 'videos',
  },
  
  // Azure OpenAI
  azureOpenAI: {
    endpoint: process.env.REACT_APP_AZURE_OPENAI_ENDPOINT || '',
    apiKey: process.env.REACT_APP_AZURE_OPENAI_API_KEY || '',
    deploymentName: process.env.REACT_APP_AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o',
    apiVersion: process.env.REACT_APP_AZURE_OPENAI_API_VERSION || '2024-10-21',
  },
  
  // 轉錄 API
  transcriptionAPI: {
    endpoint: process.env.REACT_APP_TRANSCRIPTION_API_ENDPOINT || 'http://localhost:3001/api/transcription',
  },
  
  // 影片處理 API
  videoProcessorAPI: {
    endpoint: process.env.REACT_APP_VIDEO_PROCESSOR_ENDPOINT || 'https://video-processor-dubbgcc2dsf4g7hc.swedencentral-01.azurewebsites.net/api/index_video',
    deleteEndpoint: process.env.REACT_APP_VIDEO_PROCESSOR_DELETE_ENDPOINT || 'https://video-processor-dubbgcc2dsf4g7hc.swedencentral-01.azurewebsites.net/api/delete_video',
    queryEndpoint: process.env.REACT_APP_VIDEO_PROCESSOR_QUERY_ENDPOINT || 'https://video-processor-dubbgcc2dsf4g7hc.swedencentral-01.azurewebsites.net/api/query_video',
  },
  
  // 已移除開發模式與 mock 設定，僅保留真實 API 設定
};

// 支援的影片格式
export const SUPPORTED_VIDEO_FORMATS = [
  'video/mp4',
  'video/mov',
  'video/avi',
  'video/mkv',
  'video/webm',
];

// 檔案大小限制 (100MB)
export const MAX_FILE_SIZE = 100 * 1024 * 1024;
