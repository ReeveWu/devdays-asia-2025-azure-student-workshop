import { VideoInfo, UploadProgress } from '../types';
import { generateId, delay } from '../utils/helpers';

declare const process: any;

const config = {
  azureStorage: {
    accountName: process.env.REACT_APP_AZURE_STORAGE_ACCOUNT_NAME || '',
    containerName: process.env.REACT_APP_AZURE_STORAGE_CONTAINER_NAME || 'videos',
    sasToken: process.env.REACT_APP_AZURE_STORAGE_SAS_TOKEN?.replace(/"/g, '') || '', // 移除引號
  },
  features: {
    enableRealStorageUpload: process.env.REACT_APP_ENABLE_REAL_STORAGE_UPLOAD === 'true',
  },
  mock: {
    delayMs: parseInt(process.env.REACT_APP_MOCK_DELAY_MS || '1000'),
  },
};

class AzureStorageService {
  private accountName: string = '';
  private containerName: string = '';
  private sasToken: string = '';

  constructor() {
    this.accountName = config.azureStorage.accountName;
    this.containerName = config.azureStorage.containerName;
    this.sasToken = config.azureStorage.sasToken;

    if (config.features.enableRealStorageUpload) {
      console.log('Azure Storage 配置:', {
        accountName: this.accountName,
        containerName: this.containerName,
        hasSasToken: !!this.sasToken,
        enableRealStorageUpload: config.features.enableRealStorageUpload
      });
    }
  }

  // 建立個別 blob 的 SAS URL
  private createBlobSasUrl(blobName: string): string {
    // 清理 SAS token（移除可能存在的 ? 前綴）
    let cleanSasToken = this.sasToken;
    if (cleanSasToken.startsWith('?')) {
      cleanSasToken = cleanSasToken.substring(1);
    }

    // 建立完整的 blob URL 包含 SAS token
    return `https://${this.accountName}.blob.core.windows.net/${this.containerName}/${blobName}?${cleanSasToken}`;
  }

  // 使用 fetch API 直接上傳（避免 SDK 的身份驗證問題）
  private async uploadToAzure(file: File, onProgress?: (progress: UploadProgress) => void): Promise<VideoInfo> {
    if (!this.accountName || !this.sasToken || !this.containerName) {
      throw new Error('Azure Storage 配置不完整');
    }

    const blobName = `${generateId()}-${file.name}`;
    const blobSasUrl = this.createBlobSasUrl(blobName);

    try {
      console.log('正在上傳到 Azure Storage...', {
        fileName: blobName,
        size: file.size,
        container: this.containerName,
        url: blobSasUrl.substring(0, 100) + '...'
      });

      // 使用 XMLHttpRequest 來追蹤上傳進度
      const uploadPromise = new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // 監聽上傳進度
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable && onProgress) {
            const progress: UploadProgress = {
              loaded: event.loaded,
              total: event.total,
              percentage: Math.round((event.loaded / event.total) * 100)
            };
            onProgress(progress);
            console.log(`上傳進度: ${progress.percentage}%`);
          }
        });

        // 監聽完成事件
        xhr.addEventListener('load', () => {
          console.log('=== XMLHttpRequest load event triggered ===', { 
            status: xhr.status, 
            statusText: xhr.statusText,
            responseText: xhr.responseText?.substring(0, 200) + '...'
          });
          
          if (xhr.status >= 200 && xhr.status < 300) {
            // 確保最終進度為 100%
            console.log('上傳成功，發送最終進度 100%');
            if (onProgress) {
              const finalProgress = {
                loaded: file.size,
                total: file.size,
                percentage: 100
              };
              console.log('最終進度:', finalProgress);
              onProgress(finalProgress);
            }
            
            // 成功：回傳 blob 的公開 URL（不含 SAS token）
            const publicUrl = `https://${this.accountName}.blob.core.windows.net/${this.containerName}/${blobName}`;
            console.log('=== 上傳成功，返回 URL ===:', publicUrl);
            resolve(publicUrl);
          } else {
            console.error('=== 上傳失敗 ===:', xhr.status, xhr.statusText, xhr.responseText);
            reject(new Error(`上傳失敗: ${xhr.status} ${xhr.statusText}`));
          }
        });

        // 監聽錯誤事件
        xhr.addEventListener('error', (event) => {
          console.error('XMLHttpRequest error event:', event);
          reject(new Error('網路錯誤，上傳失敗'));
        });

        // 監聽中止事件
        xhr.addEventListener('abort', () => {
          console.error('XMLHttpRequest abort event');
          reject(new Error('上傳被中止'));
        });

        // 監聽超時事件
        xhr.addEventListener('timeout', () => {
          console.error('XMLHttpRequest timeout event');
          reject(new Error('上傳超時'));
        });

        // 設定請求
        xhr.open('PUT', blobSasUrl);
        xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        
        // 設定超時時間（5分鐘）
        xhr.timeout = 300000;

        console.log('開始上傳檔案到:', blobSasUrl.substring(0, 100) + '...');
        
        // 開始上傳
        xhr.send(file);
      });

      const publicUrl = await uploadPromise;

      const videoInfo: VideoInfo = {
        id: blobName,
        name: file.name,
        url: publicUrl,
        uploadDate: new Date(),
        size: file.size
      };

      console.log('上傳成功:', videoInfo);
      return videoInfo;

    } catch (error) {
      console.error('上傳到 Azure Storage 失敗:', error);
      throw new Error(`檔案上傳失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
    }
  }

  // Mock 的檔案上傳
  private async mockUpload(file: File, onProgress?: (progress: UploadProgress) => void): Promise<VideoInfo> {
    // 模擬上傳進度
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      await delay(config.mock.delayMs / steps);
      if (onProgress) {
        const progress: UploadProgress = {
          loaded: (file.size * i) / steps,
          total: file.size,
          percentage: (i / steps) * 100
        };
        onProgress(progress);
      }
    }

    const videoInfo: VideoInfo = {
      id: generateId(),
      name: file.name,
      url: URL.createObjectURL(file), // 使用本地 URL
      uploadDate: new Date(),
      size: file.size,
      duration: Math.floor(Math.random() * 600) + 60, // 隨機 1-10 分鐘
      thumbnail: 'https://via.placeholder.com/320x180/cccccc/ffffff?text=Video'
    };

    return videoInfo;
  }

  // 上傳影片檔案
  async uploadVideo(file: File, onProgress?: (progress: UploadProgress) => void): Promise<VideoInfo> {
    console.log('=== 開始上傳影片流程 ===');
    console.log('檔案資訊:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      enableRealStorageUpload: config.features.enableRealStorageUpload,
      hasConfiguration: !!(this.accountName && this.sasToken && this.containerName)
    });

    if (config.features.enableRealStorageUpload) {
      try {
        console.log('使用真實 Azure Storage 上傳');
        const result = await this.uploadToAzure(file, onProgress);
        console.log('=== Azure 上傳完成 ===', result);
        return result;
      } catch (error) {
        console.error('=== Azure 上傳失敗，切換到 mock 模式 ===', error);
        // 如果真實上傳失敗，回退到 mock 模式
        return this.mockUpload(file, onProgress);
      }
    } else {
      console.log('使用 mock 模式上傳');
      return this.mockUpload(file, onProgress);
    }
  }

  // 取得影片列表
  async getVideoList(): Promise<VideoInfo[]> {
    if (config.features.enableRealStorageUpload && this.accountName && this.sasToken) {
      try {
        // 使用 Blob Service SAS URL 來列出容器中的 blobs
        const containerSasUrl = `https://${this.accountName}.blob.core.windows.net/${this.containerName}?${this.sasToken.startsWith('?') ? this.sasToken.substring(1) : this.sasToken}&comp=list&restype=container`;
        
        const response = await fetch(containerSasUrl);
        if (!response.ok) {
          throw new Error(`無法取得影片列表: ${response.status} ${response.statusText}`);
        }

        const xmlText = await response.text();
        
        // 簡單的 XML 解析來提取 blob 名稱
        const blobMatches = xmlText.match(/<Name>([^<]+)<\/Name>/g) || [];
        const videos: VideoInfo[] = [];
        
        for (const match of blobMatches) {
          const blobName = match.replace(/<\/?Name>/g, '');
          if (blobName.includes('.mp4') || blobName.includes('.avi') || blobName.includes('.mov') || blobName.includes('.webm')) {
            const publicUrl = `https://${this.accountName}.blob.core.windows.net/${this.containerName}/${blobName}`;
            videos.push({
              id: blobName,
              name: blobName.split('-').slice(1).join('-'), // 移除 UUID 前綴
              url: publicUrl,
              uploadDate: new Date(), // 無法從簡單 API 獲取實際日期
              size: 0 // 無法從簡單 API 獲取實際大小
            });
          }
        }
        
        return videos;
      } catch (error) {
        console.error('取得影片列表失敗:', error);
        return [];
      }
    } else {
      // 回傳 Mock 資料
      await delay(500);
      return [
        {
          id: 'mock-1',
          name: 'demo-video-1.mp4',
          url: 'https://via.placeholder.com/320x180/cccccc/ffffff?text=Demo+Video+1',
          uploadDate: new Date(Date.now() - 86400000), // 昨天
          size: 50 * 1024 * 1024, // 50MB
          duration: 180,
          thumbnail: 'https://via.placeholder.com/320x180/cccccc/ffffff?text=Video+1'
        },
        {
          id: 'mock-2',
          name: 'demo-video-2.mp4',
          url: 'https://via.placeholder.com/320x180/cccccc/ffffff?text=Demo+Video+2',
          uploadDate: new Date(Date.now() - 172800000), // 前天
          size: 75 * 1024 * 1024, // 75MB
          duration: 300,
          thumbnail: 'https://via.placeholder.com/320x180/cccccc/ffffff?text=Video+2'
        }
      ];
    }
  }
}

export const azureStorageService = new AzureStorageService();
