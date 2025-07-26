import { TranscriptionQuery, TranscriptionResponse } from '../types';
import { delay } from '../utils/helpers';

declare const process: any;

const config = {
  transcriptionAPI: {
    endpoint: process.env.REACT_APP_TRANSCRIPTION_API_ENDPOINT || 'http://localhost:3001/api/transcription',
  },
  features: {
    enableRealTranscriptionAPI: process.env.REACT_APP_ENABLE_REAL_TRANSCRIPTION_API === 'true',
  },
  mock: {
    delayMs: parseInt(process.env.REACT_APP_MOCK_DELAY_MS || '30'),
  },
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

  // Mock 的轉錄回應
  private async mockTranscription(query: TranscriptionQuery): Promise<TranscriptionResponse> {
    await delay(config.mock.delayMs / 2);

    const mockTranscriptions: { [key: string]: string[] } = {
      'mock-1': [
        '大家好，歡迎來到今天的人工智慧講座。',
        '今天我們要討論的主題是機器學習的基礎概念。',
        '首先，讓我們來了解什麼是監督學習。',
        '監督學習是使用標記數據來訓練模型的方法。',
        '接下來我們會探討無監督學習的應用場景。',
        '深度學習是機器學習的一個重要分支。',
        '神經網絡的發展為 AI 帶來了革命性的變化。',
        '數據預處理是機器學習流程中的關鍵步驟。',
        '特徵工程對模型性能有決定性的影響。',
        '最後，讓我們討論模型評估的重要性。'
      ],
      'mock-2': [
        '歡迎觀看這個關於雲端運算的教學影片。',
        'Azure 是微軟提供的雲端服務平台。',
        '我們將學習如何部署應用程式到雲端。',
        '容器化技術讓應用程式部署更加靈活。',
        'Docker 是目前最流行的容器化工具。',
        'Kubernetes 提供了強大的容器編排功能。',
        '微服務架構是現代應用開發的趨勢。',
        'API Gateway 是微服務架構的重要組件。',
        '負載均衡確保了系統的高可用性。',
        '監控和日誌是運維的必備工具。'
      ]
    };

    const videoTranscriptions = mockTranscriptions[query.videoId] || mockTranscriptions['mock-1'];
    
    // 根據查詢找到相關的轉錄片段
    const relevantSegments = videoTranscriptions.filter(segment => 
      segment.toLowerCase().includes(query.query.toLowerCase()) ||
      this.containsRelevantKeywords(segment, query.query)
    );

    let responseText = '';
    if (relevantSegments.length > 0) {
      responseText = relevantSegments.join(' ');
    } else {
      // 如果沒找到完全匹配的，返回一些相關內容
      responseText = videoTranscriptions.slice(0, 3).join(' ');
    }

    return {
      text: responseText,
      relevantSegments: relevantSegments.map((segment, index) => ({
        start: index * 30, // 模擬時間戳
        end: (index + 1) * 30,
        text: segment,
        confidence: 0.8 + Math.random() * 0.2
      }))
    };
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
    if (config.features.enableRealTranscriptionAPI) {
      return this.callRealAPI(query);
    } else {
      return this.mockTranscription(query);
    }
  }

  // 取得完整的轉錄內容
  async getFullTranscription(videoId: string): Promise<TranscriptionResponse> {
    return this.queryTranscription({
      query: '', // 空查詢表示取得全部內容
      videoId
    });
  }
}

export const transcriptionService = new TranscriptionService();
