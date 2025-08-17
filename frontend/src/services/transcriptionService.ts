import { TranscriptionQuery, TranscriptionResponse } from '../types';

declare const process: any;

const config = {
  transcriptionAPI: {
    endpoint: process.env.REACT_APP_VIDEO_PROCESSOR_QUERY_ENDPOINT,
  },
  // 已移除 mock 與開發模式，僅保留真實 API 設定
};

class TranscriptionService {
  // 真實的轉錄 API 呼叫
  private async callRealAPI(query: TranscriptionQuery): Promise<TranscriptionResponse> {
    try {
      const response = await fetch(config.transcriptionAPI.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(query)
      });

      if (!response.ok) {
        throw new Error(`轉錄 API 錯誤: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('轉錄 API 呼叫失敗:', error);
      throw error;
    }
  }

  // 查詢影片轉錄
  async queryTranscription(query: TranscriptionQuery): Promise<TranscriptionResponse> {
  return this.callRealAPI(query);
  }

  // 取得完整的轉錄內容
  async getFullTranscription(videoId: string): Promise<TranscriptionResponse> {
    return this.queryTranscription({
      query: '',
      videoId
    });
  }
}

export const transcriptionService = new TranscriptionService();
