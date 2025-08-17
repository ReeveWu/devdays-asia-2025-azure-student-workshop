import { VideoInfo, UploadProgress } from '../types';

declare const process: any;

const cfg = {
  accountName: process.env.REACT_APP_AZURE_STORAGE_ACCOUNT_NAME || '',
  containerName: process.env.REACT_APP_AZURE_STORAGE_CONTAINER_NAME || 'videos',
  sasToken: (process.env.REACT_APP_AZURE_STORAGE_SAS_TOKEN || '').replace(/"/g, ''),
};

class AzureStorageService {
  private accountName = cfg.accountName;
  private containerName = cfg.containerName;
  private sasToken = cfg.sasToken;

  private ensureConfig() {
    if (!this.accountName || !this.containerName || !this.sasToken) {
      throw new Error('Azure Storage 配置不完整');
    }
  }

  private cleanSas(): string {
    return this.sasToken.startsWith('?') ? this.sasToken.substring(1) : this.sasToken;
  }

  private blobUrl(blobName: string): string {
    return `https://${this.accountName}.blob.core.windows.net/${this.containerName}/${encodeURIComponent(blobName)}?${this.cleanSas()}`;
  }

  private publicUrl(blobName: string): string {
    return `https://${this.accountName}.blob.core.windows.net/${this.containerName}/${encodeURIComponent(blobName)}`;
  }

  private async blobExists(blobName: string): Promise<boolean> {
    try {
      const res = await fetch(this.blobUrl(blobName), { method: 'HEAD' });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  private async uploadViaXHR(file: File, onProgress?: (p: UploadProgress) => void): Promise<string> {
    this.ensureConfig();
    const blobName = file.name;

    if (await this.blobExists(blobName)) {
      throw new Error(`檔案名稱 "${file.name}" 已存在，請重新命名檔案或選擇其他檔案`);
    }

    const url = this.blobUrl(blobName);
    return await new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress({ loaded: e.loaded, total: e.total, percentage: Math.round((e.loaded / e.total) * 100) });
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.({ loaded: file.size, total: file.size, percentage: 100 });
          resolve(this.publicUrl(blobName));
        } else {
          reject(new Error(`上傳失敗: ${xhr.status} ${xhr.statusText}`));
        }
      };
      xhr.onerror = () => reject(new Error('網路錯誤，上傳失敗'));
      xhr.onabort = () => reject(new Error('上傳被中止'));
      xhr.ontimeout = () => reject(new Error('上傳超時'));
      xhr.open('PUT', url);
      xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.timeout = 300000;
      xhr.send(file);
    });
  }

  async uploadVideo(file: File, onProgress?: (progress: UploadProgress) => void): Promise<VideoInfo> {
    const publicUrl = await this.uploadViaXHR(file, onProgress);
    return { id: file.name, name: file.name, url: publicUrl, uploadDate: new Date(), size: file.size, isIndexing: false, isIndexed: false };
  }

  private isVideoFile(name: string): boolean {
    const exts = ['.mp4', '.avi', '.mov', '.webm', '.mkv', '.m4v'];
    const lower = name.toLowerCase();
    return exts.some(ext => lower.endsWith(ext));
  }

  private async getBlobSize(blobName: string): Promise<number> {
    try {
      const res = await fetch(this.blobUrl(blobName), { method: 'HEAD' });
      if (res.ok) {
        const len = res.headers.get('Content-Length');
        return len ? parseInt(len, 10) : 0;
      }
    } catch {}
    return 0;
  }

  async getVideoList(): Promise<VideoInfo[]> {
    this.ensureConfig();
    const listUrl = `https://${this.accountName}.blob.core.windows.net/${this.containerName}?${this.cleanSas()}&comp=list&restype=container&include=metadata`;
    const res = await fetch(listUrl);
    if (!res.ok) throw new Error(`無法取得影片列表: ${res.status} ${res.statusText}`);
    const xml = await res.text();
    const videos: VideoInfo[] = [];
    const blobPattern = /<Blob>([\s\S]*?)<\/Blob>/g;
    let m: RegExpExecArray | null;
    while ((m = blobPattern.exec(xml)) !== null) {
      const block = m[1];
      const nameMatch = block.match(/<Name>([^<]+)<\/Name>/);
      if (!nameMatch) continue;
      const blobName = nameMatch[1];
      if (!this.isVideoFile(blobName)) continue;
      const props = block.match(/<Properties>([\s\S]*?)<\/Properties>/);
      let size = 0;
      if (props) {
        const pxml = props[1];
        const sizeMatch = pxml.match(/<Content-Length>(\d+)<\/Content-Length>/);
        size = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;
      }
      const lastMod = block.match(/<Last-Modified>([^<]+)<\/Last-Modified>/);
      const uploadDate = lastMod ? new Date(lastMod[1]) : new Date();
      videos.push({ id: blobName, name: blobName, url: this.publicUrl(blobName), uploadDate, size, isIndexing: false, isIndexed: true });
    }
    if (videos.length === 0) {
      const names = xml.match(/<Name>([^<]+)<\/Name>/g) || [];
      for (const n of names) {
        const blobName = n.replace(/<\/?Name>/g, '');
        if (!this.isVideoFile(blobName)) continue;
        const size = await this.getBlobSize(blobName);
        videos.push({ id: blobName, name: blobName, url: this.publicUrl(blobName), uploadDate: new Date(), size, isIndexing: false, isIndexed: true });
      }
    }
    videos.sort((a, b) => b.uploadDate.getTime() - a.uploadDate.getTime());
    return videos;
  }

  private async deleteFromAzure(blobName: string): Promise<void> {
    const res = await fetch(this.blobUrl(blobName), { method: 'DELETE', headers: { 'x-ms-blob-type': 'BlockBlob' } });
    if (!res.ok && res.status !== 404) throw new Error(`刪除失敗: ${res.status} ${res.statusText}`);
  }

  async deleteVideo(videoId: string): Promise<void> {
    try { await this.deleteVideoIndex(videoId); } catch {}
    await this.deleteFromAzure(videoId);
  }

  async indexVideo(videoName: string): Promise<void> {
    const endpoint = process.env.REACT_APP_VIDEO_PROCESSOR_ENDPOINT;
    if (!endpoint) {
      throw new Error('REACT_APP_VIDEO_PROCESSOR_ENDPOINT is not defined');
    }
    const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, mode: 'cors', body: JSON.stringify({ video_name: videoName }) });
    if (!r.ok) { const t = await r.text(); throw new Error(`影片索引處理失敗: ${r.status} ${r.statusText} - ${t}`); }
    await r.json();
  }

  async deleteVideoIndex(videoName: string): Promise<void> {
    const deleteEndpoint = process.env.REACT_APP_VIDEO_PROCESSOR_DELETE_ENDPOINT;
    if (!deleteEndpoint) {
      throw new Error('REACT_APP_VIDEO_PROCESSOR_DELETE_ENDPOINT is not defined');
    }
    const r = await fetch(deleteEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, mode: 'cors', body: JSON.stringify({ video_name: videoName }) });
    if (!r.ok) { const t = await r.text(); throw new Error(`影片索引刪除失敗: ${r.status} ${r.statusText} - ${t}`); }
    await r.json();
  }
}

export const azureStorageService = new AzureStorageService();
