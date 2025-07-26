import { v4 as uuidv4 } from 'uuid';

// 格式化檔案大小
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 格式化時間
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// 生成唯一 ID
export const generateId = (): string => {
  return uuidv4();
};

// 驗證影片檔案
export const validateVideoFile = (file: File): { isValid: boolean; error?: string } => {
  const supportedFormats = [
    'video/mp4',
    'video/mov',
    'video/avi',
    'video/mkv',
    'video/webm',
    'video/quicktime'
  ];
  
  if (!supportedFormats.includes(file.type)) {
    return {
      isValid: false,
      error: '不支援的檔案格式。請選擇 MP4、MOV、AVI、MKV 或 WebM 格式的影片。'
    };
  }
  
  const maxSize = 100 * 1024 * 1024; // 100MB
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: '檔案大小不能超過 100MB。'
    };
  }
  
  return { isValid: true };
};

// 延迟執行
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// 安全的 JSON 解析
export const safeJsonParse = (jsonString: string, fallback: any = null): any => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('JSON 解析錯誤:', error);
    return fallback;
  }
};

// 截斷文字
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};
