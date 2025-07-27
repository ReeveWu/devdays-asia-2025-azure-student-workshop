import { VideoInfo, UploadProgress } from '../types';
import { delay } from '../utils/helpers';
import { config as appConfig } from '../utils/config';

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

  // 檢查檔案是否已存在
  private async checkBlobExists(blobName: string): Promise<boolean> {
    try {
      const blobSasUrl = this.createBlobSasUrl(blobName);
      console.log(`正在檢查檔案是否存在: ${blobName}`);
      const response = await fetch(blobSasUrl, { method: 'HEAD' });
      const exists = response.status === 200;
      console.log(`檔案 ${blobName} ${exists ? '已存在' : '不存在'}`);
      return exists;
    } catch (error) {
      console.error('檢查檔案是否存在時發生錯誤:', error);
      // 如果檢查失敗，為了安全起見假設檔案不存在，讓上傳繼續進行
      return false;
    }
  }

  // 使用 fetch API 直接上傳（避免 SDK 的身份驗證問題）
  private async uploadToAzure(file: File, onProgress?: (progress: UploadProgress) => void): Promise<VideoInfo> {
    if (!this.accountName || !this.sasToken || !this.containerName) {
      throw new Error('Azure Storage 配置不完整');
    }

    const blobName = file.name; // 直接使用原始檔案名稱
    
    // 檢查檔案是否已存在
    const fileExists = await this.checkBlobExists(blobName);
    if (fileExists) {
      throw new Error(`檔案名稱 "${file.name}" 已存在，請重新命名檔案或選擇其他檔案`);
    }

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
        name: file.name, // 直接使用原始檔案名稱
        url: publicUrl,
        uploadDate: new Date(),
        size: file.size,
        isIndexing: false, // 初始設為不在索引中
        isIndexed: false   // 初始設為未索引
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
    // 檢查 mock 檔案是否已存在
    const existingVideos = await this.getMockVideoList();
    const fileExists = existingVideos.some(video => video.name === file.name);
    if (fileExists) {
      throw new Error(`檔案名稱 "${file.name}" 已存在，請重新命名檔案或選擇其他檔案`);
    }

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
      id: file.name, // 使用檔案名稱作為 ID
      name: file.name,
      url: URL.createObjectURL(file), // 使用本地 URL
      uploadDate: new Date(),
      size: file.size,
      duration: Math.floor(Math.random() * 600) + 60, // 隨機 1-10 分鐘
      thumbnail: 'https://via.placeholder.com/320x180/cccccc/ffffff?text=Video',
      isIndexing: false, // Mock 模式下直接設為已索引
      isIndexed: true
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
        console.error('=== Azure 上傳失敗 ===', error);
        
        // 如果是檔案名稱重複錯誤，直接拋出，不回退到 mock 模式
        if (error instanceof Error && error.message.includes('已存在')) {
          throw error;
        }
        
        // 其他錯誤則回退到 mock 模式
        console.log('切換到 mock 模式');
        return this.mockUpload(file, onProgress);
      }
    } else {
      console.log('使用 mock 模式上傳');
      return this.mockUpload(file, onProgress);
    }
  }

  // 檢查是否為影片檔案
  private isVideoFile(fileName: string): boolean {
    const videoExtensions = ['.mp4', '.avi', '.mov', '.webm', '.mkv', '.m4v'];
    const lowerFileName = fileName.toLowerCase();
    return videoExtensions.some(ext => lowerFileName.endsWith(ext));
  }

  // 從 blob 名稱中提取原始檔案名稱（現在直接回傳，因為已經是原始檔案名稱）
  private extractOriginalFileName(blobName: string): string {
    // 現在直接使用原始檔案名稱儲存，不再需要移除 UUID 前綴
    return blobName;
  }

  // 取得 Mock 影片列表
  private async getMockVideoList(): Promise<VideoInfo[]> {
    await delay(500);
    return [
      {
        id: 'mock-1',
        name: 'demo-video-1.mp4',
        url: 'https://via.placeholder.com/320x180/cccccc/ffffff?text=Demo+Video+1',
        uploadDate: new Date(Date.now() - 86400000), // 昨天
        size: 50 * 1024 * 1024, // 50MB
        duration: 180,
        thumbnail: 'https://via.placeholder.com/320x180/cccccc/ffffff?text=Video+1',
        isIndexing: false,
        isIndexed: true
      },
      {
        id: 'mock-2',
        name: 'demo-video-2.mp4',
        url: 'https://via.placeholder.com/320x180/cccccc/ffffff?text=Demo+Video+2',
        uploadDate: new Date(Date.now() - 172800000), // 前天
        size: 75 * 1024 * 1024, // 75MB
        duration: 300,
        thumbnail: 'https://via.placeholder.com/320x180/cccccc/ffffff?text=Video+2',
        isIndexing: false,
        isIndexed: true
      }
    ];
  }

  // 取得影片列表
  async getVideoList(): Promise<VideoInfo[]> {
    if (config.features.enableRealStorageUpload && this.accountName && this.sasToken) {
      try {
        // 使用 Blob Service SAS URL 來列出容器中的 blobs，包含詳細資訊
        const containerSasUrl = `https://${this.accountName}.blob.core.windows.net/${this.containerName}?${this.sasToken.startsWith('?') ? this.sasToken.substring(1) : this.sasToken}&comp=list&restype=container&include=metadata`;
        
        console.log('正在請求 Azure Storage API:', containerSasUrl.substring(0, 150) + '...');
        
        const response = await fetch(containerSasUrl);
        if (!response.ok) {
          throw new Error(`無法取得影片列表: ${response.status} ${response.statusText}`);
        }

        const xmlText = await response.text();
        console.log('Azure Storage API 回應 (前 500 字元):', xmlText.substring(0, 500) + '...');
        
        // 使用更完整的 XML 解析來提取 blob 資訊
        const videos: VideoInfo[] = [];
        
        // 解析 XML 中的 Blob 元素
        const blobPattern = /<Blob>([\s\S]*?)<\/Blob>/g;
        let blobMatch;
        
        while ((blobMatch = blobPattern.exec(xmlText)) !== null) {
          const blobXml = blobMatch[1];
          
          // 提取 blob 名稱
          const nameMatch = blobXml.match(/<Name>([^<]+)<\/Name>/);
          if (!nameMatch) continue;
          
          const blobName = nameMatch[1];
          
          // 只處理影片檔案
          if (!this.isVideoFile(blobName)) continue;
          
          // 提取檔案大小 - 尋找 Properties 區塊中的 Content-Length
          const propertiesMatch = blobXml.match(/<Properties>([\s\S]*?)<\/Properties>/);
          let size = 0;
          if (propertiesMatch) {
            const propertiesXml = propertiesMatch[1];
            const sizeMatch = propertiesXml.match(/<Content-Length>(\d+)<\/Content-Length>/);
            size = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;
          }
          
          // 提取最後修改時間
          const lastModifiedMatch = blobXml.match(/<Last-Modified>([^<]+)<\/Last-Modified>/);
          const uploadDate = lastModifiedMatch ? new Date(lastModifiedMatch[1]) : new Date();
          
          const publicUrl = `https://${this.accountName}.blob.core.windows.net/${this.containerName}/${blobName}`;
          
          console.log('解析的影片資訊:', {
            blobName,
            size,
            sizeFormatted: this.formatFileSize(size),
            uploadDate: uploadDate.toISOString()
          });
          
          videos.push({
            id: blobName,
            name: this.extractOriginalFileName(blobName),
            url: publicUrl,
            uploadDate,
            size,
            isIndexing: false, // 從存儲中載入的影片默認為已索引完成
            isIndexed: true
          });
        }
        
        // 如果沒有找到任何影片，嘗試舊的解析方式作為備用
        if (videos.length === 0) {
          console.log('使用備用解析方式');
          const blobMatches = xmlText.match(/<Name>([^<]+)<\/Name>/g) || [];
          for (const match of blobMatches) {
            const blobName = match.replace(/<\/?Name>/g, '');
            if (this.isVideoFile(blobName)) {
              const publicUrl = `https://${this.accountName}.blob.core.windows.net/${this.containerName}/${blobName}`;
              
              // 嘗試獲取個別檔案的詳細資訊
              const fileSize = await this.getBlobSize(blobName);
              
              videos.push({
                id: blobName,
                name: this.extractOriginalFileName(blobName),
                url: publicUrl,
                uploadDate: new Date(), // 無法從簡單 API 獲取實際日期
                size: fileSize,
                isIndexing: false, // 從存儲中載入的影片默認為已索引完成
                isIndexed: true
              });
            }
          }
        }
        
        // 按上傳時間排序（最新的在前）
        videos.sort((a, b) => b.uploadDate.getTime() - a.uploadDate.getTime());
        
        console.log('最終影片列表:', videos);
        return videos;
      } catch (error) {
        console.error('取得影片列表失敗:', error);
        // 如果真實 API 失敗，回退到 Mock 資料
        console.log('回退到 Mock 資料模式');
        return this.getMockVideoList();
      }
    } else {
      // 回傳 Mock 資料
      return this.getMockVideoList();
    }
  }

  // 獲取個別 blob 的大小
  private async getBlobSize(blobName: string): Promise<number> {
    try {
      const blobSasUrl = this.createBlobSasUrl(blobName);
      const response = await fetch(blobSasUrl, { method: 'HEAD' });
      
      if (response.ok) {
        const contentLength = response.headers.get('Content-Length');
        return contentLength ? parseInt(contentLength, 10) : 0;
      }
    } catch (error) {
      console.error('獲取檔案大小失敗:', error);
    }
    return 0;
  }

  // 格式化檔案大小
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 刪除影片檔案
  async deleteVideo(videoId: string): Promise<void> {
    console.log('=== 開始刪除影片流程 ===');
    console.log('影片 ID:', videoId);

    try {
      // 先嘗試刪除影片索引
      console.log('步驟 1: 刪除影片索引');
      await this.deleteVideoIndex(videoId);
      console.log('影片索引刪除成功');
    } catch (error) {
      console.warn('影片索引刪除失敗，但繼續刪除檔案:', error);
      // 即使索引刪除失敗，也繼續刪除檔案
    }

    // 再刪除存儲中的檔案
    if (config.features.enableRealStorageUpload && this.accountName && this.sasToken) {
      try {
        console.log('步驟 2: 使用真實 Azure Storage 刪除檔案');
        await this.deleteFromAzure(videoId);
        console.log('=== Azure 檔案刪除完成 ===');
      } catch (error) {
        console.error('=== Azure 檔案刪除失敗 ===', error);
        throw new Error(`檔案刪除失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
      }
    } else {
      console.log('步驟 2: Mock 模式：模擬檔案刪除操作');
      await this.mockDelete(videoId);
    }

    console.log('=== 影片刪除流程完成 ===');
  }

  // 從 Azure Storage 刪除檔案
  private async deleteFromAzure(blobName: string): Promise<void> {
    if (!this.accountName || !this.sasToken || !this.containerName) {
      throw new Error('Azure Storage 配置不完整');
    }

    const blobSasUrl = this.createBlobSasUrl(blobName);

    try {
      console.log('正在從 Azure Storage 刪除檔案...', {
        blobName,
        container: this.containerName,
        url: blobSasUrl.substring(0, 100) + '...'
      });

      const response = await fetch(blobSasUrl, {
        method: 'DELETE',
        headers: {
          'x-ms-blob-type': 'BlockBlob'
        }
      });

      if (!response.ok) {
        // 如果檔案不存在 (404)，視為成功
        if (response.status === 404) {
          console.log('檔案不存在，視為刪除成功');
          return;
        }
        throw new Error(`刪除失敗: ${response.status} ${response.statusText}`);
      }

      console.log('檔案刪除成功');
    } catch (error) {
      console.error('從 Azure Storage 刪除檔案失敗:', error);
      throw new Error(`檔案刪除失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
    }
  }

  // Mock 刪除操作
  private async mockDelete(videoId: string): Promise<void> {
    // 模擬刪除延遲
    await delay(config.mock.delayMs / 2);
    console.log(`Mock: 已刪除影片 ${videoId}`);
  }

  // 調用影片處理 API 進行索引
  async indexVideo(videoName: string): Promise<void> {
    try {
      console.log('=== 開始影片索引處理 ===', videoName);
      
      // 檢查是否啟用真實的影片處理 API
      if (!appConfig.features.enableRealVideoProcessing) {
        console.log('使用 Mock 模式進行影片索引處理');
        await delay(2000); // 模擬 2 秒處理時間
        console.log('=== Mock 影片索引處理完成 ===');
        return;
      }
      
      console.log('API 端點:', appConfig.videoProcessorAPI.endpoint);
      
      const requestBody = {
        video_name: videoName
      };
      
      console.log('請求內容:', requestBody);
      
      const response = await fetch(appConfig.videoProcessorAPI.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        mode: 'cors', // 明確指定 CORS 模式
        body: JSON.stringify(requestBody)
      });

      console.log('API 回應狀態:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API 錯誤回應:', errorText);
        throw new Error(`影片索引處理失敗: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('=== 影片索引處理完成 ===', result);
      
    } catch (error) {
      console.error('影片索引處理失敗:', error);
      
      // 檢查是否是網路錯誤
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('無法連接到影片處理服務，可能是網路問題或 CORS 設定問題');
      }
      
      // 檢查是否是 CORS 錯誤
      if (error instanceof TypeError && error.message.includes('CORS')) {
        throw new Error('跨域請求被阻擋，請檢查伺服器 CORS 設定');
      }
      
      throw new Error(`影片索引處理失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
    }
  }

  // 調用影片處理 API 刪除索引
  async deleteVideoIndex(videoName: string): Promise<void> {
    try {
      console.log('=== 開始刪除影片索引 ===', videoName);
      
      // 檢查是否啟用真實的影片處理 API
      if (!appConfig.features.enableRealVideoProcessing) {
        console.log('使用 Mock 模式進行影片索引刪除');
        await delay(1000); // 模擬 1 秒處理時間
        console.log('=== Mock 影片索引刪除完成 ===');
        return;
      }
      
      console.log('刪除 API 端點:', appConfig.videoProcessorAPI.deleteEndpoint);
      
      const requestBody = {
        video_name: videoName
      };
      
      console.log('刪除請求內容:', requestBody);
      
      const response = await fetch(appConfig.videoProcessorAPI.deleteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        mode: 'cors', // 明確指定 CORS 模式
        body: JSON.stringify(requestBody)
      });

      console.log('刪除 API 回應狀態:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('刪除 API 錯誤回應:', errorText);
        throw new Error(`影片索引刪除失敗: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('=== 影片索引刪除完成 ===', result);
      
    } catch (error) {
      console.error('影片索引刪除失敗:', error);
      
      // 檢查是否是網路錯誤
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('無法連接到影片處理服務，可能是網路問題或 CORS 設定問題');
      }
      
      // 檢查是否是 CORS 錯誤
      if (error instanceof TypeError && error.message.includes('CORS')) {
        throw new Error('跨域請求被阻擋，請檢查伺服器 CORS 設定');
      }
      
      throw new Error(`影片索引刪除失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
    }
  }
}

export const azureStorageService = new AzureStorageService();
