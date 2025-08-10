// 影片資訊介面
export interface VideoInfo {
  id: string;
  name: string;
  url: string;
  uploadDate: Date;
  size: number;
  duration?: number;
  thumbnail?: string;
  isIndexing?: boolean; // 是否正在索引處理中
  isIndexed?: boolean;  // 是否已完成索引處理
}

// 聊天訊息介面
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

// 上傳進度介面
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

// API 錯誤介面
export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

// Azure OpenAI 工具呼叫介面
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// Azure OpenAI 回應介面
export interface OpenAIChoice {
  delta?: {
    content?: string;
    tool_calls?: ToolCall[];
  };
  finish_reason?: string;
}

export interface OpenAIResponse {
  choices: OpenAIChoice[];
}

// 串流事件（支援一般文字與工具調用狀態）
export type StreamEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; status: 'start' | 'end'; name: string; args?: any };

// 轉錄查詢請求介面
export interface TranscriptionQuery {
  query: string;
  videoId: string;
}

// 轉錄查詢回應介面
export interface TranscriptionResponse {
  text: string;
  relevantSegments?: {
    start: number;
    end: number;
    text: string;
    confidence: number;
  }[];
}
