// 配置管理工具
// 支援 build 後動態修改配置

// 定義配置鍵的類型
export type ConfigKey = 
  | 'AZURE_STORAGE_ACCOUNT_NAME'
  | 'AZURE_STORAGE_CONTAINER_NAME'
  | 'AZURE_STORAGE_SAS_TOKEN'
  | 'VIDEO_PROCESSOR_ENDPOINT'
  | 'VIDEO_PROCESSOR_DELETE_ENDPOINT'
  | 'VIDEO_PROCESSOR_QUERY_ENDPOINT'
  | 'AZURE_OPENAI_ENDPOINT'
  | 'AZURE_OPENAI_API_KEY'
  | 'AZURE_OPENAI_DEPLOYMENT_NAME'
  | 'AZURE_OPENAI_API_VERSION'
  | 'API_BASE_URL';

// 擴展 window 物件類型定義
declare global {
  interface Window {
    APP_CONFIG?: Record<ConfigKey, string>;
  }
}

// 配置獲取函數
export const getConfig = (key: ConfigKey): string => {
  // 優先使用運行時配置
  if (window.APP_CONFIG && window.APP_CONFIG[key]) {
    return window.APP_CONFIG[key];
  }
  
  // 降級到環境變數（開發時使用）
  const envKey = `REACT_APP_${key}`;
  return process.env[envKey] || '';
};

// 檢查配置是否完整
export const validateConfig = (requiredKeys: ConfigKey[]): { isValid: boolean; missingKeys: ConfigKey[] } => {
  const missingKeys: ConfigKey[] = [];
  
  for (const key of requiredKeys) {
    if (!getConfig(key)) {
      missingKeys.push(key);
    }
  }
  
  return {
    isValid: missingKeys.length === 0,
    missingKeys
  };
};

// 常用配置常數
export const CONFIG_KEYS = {
  AZURE_STORAGE_ACCOUNT_NAME: 'AZURE_STORAGE_ACCOUNT_NAME',
  AZURE_STORAGE_CONTAINER_NAME: 'AZURE_STORAGE_CONTAINER_NAME',
  AZURE_STORAGE_SAS_TOKEN: 'AZURE_STORAGE_SAS_TOKEN',
  VIDEO_PROCESSOR_ENDPOINT: 'VIDEO_PROCESSOR_ENDPOINT',
  VIDEO_PROCESSOR_DELETE_ENDPOINT: 'VIDEO_PROCESSOR_DELETE_ENDPOINT',
  VIDEO_PROCESSOR_QUERY_ENDPOINT: 'VIDEO_PROCESSOR_QUERY_ENDPOINT',
  AZURE_OPENAI_ENDPOINT: 'AZURE_OPENAI_ENDPOINT',
  AZURE_OPENAI_API_KEY: 'AZURE_OPENAI_API_KEY',
  AZURE_OPENAI_DEPLOYMENT_NAME: 'AZURE_OPENAI_DEPLOYMENT_NAME',
  AZURE_OPENAI_API_VERSION: 'AZURE_OPENAI_API_VERSION',
  API_BASE_URL: 'API_BASE_URL',
} as const satisfies Record<ConfigKey, ConfigKey>;