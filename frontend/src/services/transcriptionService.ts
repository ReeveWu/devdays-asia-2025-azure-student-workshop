import { TranscriptionQuery, TranscriptionResponse } from '../types';

declare const process: any;

const config = {
  transcriptionAPI: {
    endpoint: process.env.REACT_APP_TRANSCRIPTION_API_ENDPOINT || 'http://localhost:3001/api/transcription',
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


  // 簡單的關鍵字匹配邏輯
  private containsRelevantKeywords(text: string, query: string): boolean {
    const queryKeywords = query.toLowerCase().split(/\s+/);
    const textLower = text.toLowerCase();
    
    return queryKeywords.some(keyword => {
      if (keyword.length < 2) return false;
      
      // 檢查完全匹配
      if (textLower.includes(keyword)) return true;
      
      // 檢查相關術語
      const relatedTerms: { [key: string]: string[] } = {
        'ai': ['人工智慧', '機器學習', '深度學習'],
        '人工智慧': ['ai', '機器學習', '深度學習', '神經網絡'],
        '機器學習': ['ai', '人工智慧', '深度學習', '監督學習', '無監督學習'],
        '雲端': ['azure', 'cloud', '容器', 'docker'],
        'azure': ['雲端', '微軟', '容器', 'kubernetes'],
        '開始': ['第一', '首先', '開頭', '介紹'],
        '結束': ['最後', '結論', '總結', '結尾']
      };
      
      const related = relatedTerms[keyword] || [];
      return related.some(term => textLower.includes(term));
    });
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
