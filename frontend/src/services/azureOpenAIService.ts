import { ChatMessage, TranscriptionQuery, TranscriptionResponse } from '../types';
import { generateId, delay, safeJsonParse } from '../utils/helpers';

declare const process: any;

const config = {
  azureOpenAI: {
    endpoint: process.env.REACT_APP_AZURE_OPENAI_ENDPOINT || '',
    apiKey: process.env.REACT_APP_AZURE_OPENAI_API_KEY || '',
    deploymentName: process.env.REACT_APP_AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o',
    apiVersion: process.env.REACT_APP_AZURE_OPENAI_API_VERSION || '2024-10-21',
  },
  features: {
    enableRealOpenAI: process.env.REACT_APP_ENABLE_REAL_OPENAI === 'true',
  },
  mock: {
    delayMs: parseInt(process.env.REACT_APP_MOCK_DELAY_MS || '30'),
    streamingDelayMs: parseInt(process.env.REACT_APP_STREAMING_DELAY_MS || '20'),
  },
};

class AzureOpenAIService {
  private readonly tools = [
    {
      type: 'function',
      function: {
        name: 'query_video_transcription',
        description: '根據用戶問題查詢相關的影片轉錄內容',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '用戶的問題或查詢關鍵字'
            }
          },
          required: ['query']
        }
      }
    }
  ];

  // 呼叫轉錄 API
  private async callTranscriptionAPI(query: string, videoId: string): Promise<string> {
    console.log('🔧 [工具調用] 開始調用轉錄 API:', { query, videoId });
    
    try {
      // 動態導入以避免循環依賴問題
      const { transcriptionService } = await import('./transcriptionService');
      
      console.log('📡 [工具調用] 發送轉錄查詢請求...');
      const response = await transcriptionService.queryTranscription({
        query,
        videoId
      });
      
      console.log('✅ [工具調用] 轉錄 API 回應成功:', {
        responseLength: response.text.length,
        responsePreview: response.text.substring(0, 100) + '...'
      });
      
      return response.text;
    } catch (error) {
      console.error('❌ [工具調用] 轉錄 API 呼叫失敗:', error);
      const fallbackMessage = `無法取得與 "${query}" 相關的影片內容。`;
      console.log('🔄 [工具調用] 使用錯誤回退訊息:', fallbackMessage);
      return fallbackMessage;
    }
  }

  // 真實的 Azure OpenAI API 呼叫
  private async *streamFromAzureOpenAI(
    messages: any[],
    videoId: string
  ): AsyncGenerator<string> {
    console.log('🚀 [LLM] 開始 Azure OpenAI 串流請求');
    console.log('📋 [LLM] 請求配置:', {
      endpoint: config.azureOpenAI.endpoint,
      deployment: config.azureOpenAI.deploymentName,
      messagesCount: messages.length,
      videoId,
      hasTools: this.tools.length > 0
    });
    
    const url = `${config.azureOpenAI.endpoint}/openai/deployments/${config.azureOpenAI.deploymentName}/chat/completions?api-version=${config.azureOpenAI.apiVersion}`;
    
    const requestBody = {
      messages,
      tools: this.tools,
      tool_choice: 'auto',
      stream: true,
      temperature: 0.7,
      max_tokens: 1000
    };

    console.log('🎯 [LLM] 發送請求到:', url);
    console.log('📤 [LLM] 請求主體:', {
      ...requestBody,
      messages: `${messages.length} 則訊息`
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': config.azureOpenAI.apiKey
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        console.error('❌ [LLM] Azure OpenAI API 請求失敗:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url
        });
        throw new Error(`Azure OpenAI API 錯誤: ${response.status}`);
      }

      console.log('✅ [LLM] API 回應成功，開始處理串流');

      const reader = response.body?.getReader();
      if (!reader) {
        console.error('❌ [LLM] 無法取得串流讀取器');
        throw new Error('無法讀取回應串流');
      }

      console.log('📡 [LLM] 開始讀取串流資料...');

      const decoder = new TextDecoder();
      let buffer = '';
      let toolCallId = '';
      let toolCallName = '';
      let toolCallArgs = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const choice = parsed.choices?.[0];
              if (!choice) continue;

              const delta = choice.delta;

              // 處理工具呼叫
              if (delta.tool_calls) {
                const toolCall = delta.tool_calls[0];
                if (toolCall.id) {
                  toolCallId = toolCall.id;
                  console.log('🔄 [LLM] 檢測到工具調用開始，ID:', toolCallId);
                }
                if (toolCall.function?.name) {
                  toolCallName = toolCall.function.name;
                  console.log('🛠️ [LLM] 工具名稱:', toolCallName);
                }
                if (toolCall.function?.arguments) {
                  toolCallArgs += toolCall.function.arguments;
                  console.log('📝 [LLM] 累積工具參數:', toolCall.function.arguments);
                }
              }

              // 如果工具呼叫完成，執行工具並繼續對話
              if (choice.finish_reason === 'tool_calls' && toolCallName === 'query_video_transcription') {
                console.log('🎯 [LLM] 工具調用完成，準備執行工具');
                console.log('📋 [LLM] 完整工具參數:', toolCallArgs);
                
                const args = safeJsonParse(toolCallArgs, {});
                console.log('🔍 [LLM] 解析後的參數:', args);
                
                const transcriptionResult = await this.callTranscriptionAPI(args.query || '', videoId);
                
                console.log('🔗 [LLM] 準備繼續對話，加入工具結果');
                console.log('💬 [LLM] 工具結果預覽:', transcriptionResult.substring(0, 150) + '...');

                // 繼續對話，加入工具結果
                const newMessages = [
                  ...messages,
                  {
                    role: 'assistant',
                    tool_calls: [{
                      id: toolCallId,
                      type: 'function',
                      function: {
                        name: toolCallName,
                        arguments: toolCallArgs
                      }
                    }]
                  },
                  {
                    role: 'tool',
                    tool_call_id: toolCallId,
                    content: transcriptionResult
                  }
                ];

                console.log('🔄 [LLM] 開始遞迴調用，繼續生成最終回應');
                // 遞迴呼叫以取得最終回應
                yield* this.streamFromAzureOpenAI(newMessages, videoId);
                return;
              }

              // 處理一般內容
              if (delta.content) {
                // 只在內容較多時才記錄，避免過多日誌
                if (delta.content.length > 5) {
                  console.log('📝 [LLM] 接收內容片段:', delta.content.substring(0, 50) + '...');
                }
                yield delta.content;
              }
            } catch (e) {
              console.error('❌ [LLM] 解析 SSE 資料失敗:', e);
              console.error('🔍 [LLM] 原始資料:', line);
            }
          }
        }
      }
    } catch (error) {
      console.error('💥 [LLM] Azure OpenAI API 呼叫失敗:', error);
      console.log('🔄 [LLM] 返回錯誤訊息給用戶');
      yield `抱歉，處理您的問題時發生錯誤。請稍後再試。`;
    }
  }

  // Mock 的串流回應
  private async *mockStream(question: string): AsyncGenerator<string> {
    console.log('🎭 [Mock] 使用 Mock 模式回應問題:', question);
    
    const mockResponses = [
      '根據影片內容，主角在第十分鐘時正在討論關於人工智慧的發展趨勢。',
      '影片中提到了機器學習的三個主要類型：監督學習、無監督學習和強化學習。',
      '在影片的這個部分，講者強調了數據品質對 AI 模型訓練的重要性。',
      '主角解釋了深度學習與傳統機器學習的差異，特別是在特徵提取方面。',
      '影片內容顯示，這項技術將在未來五年內對多個行業產生重大影響。'
    ];

    const response = mockResponses[Math.floor(Math.random() * mockResponses.length)];
    console.log('📝 [Mock] 選中的回應:', response);
    console.log('⏱️ [Mock] 開始串流，延遲:', config.mock.streamingDelayMs + 'ms');
    
    const chars = response.split('');

    for (const char of chars) {
      await delay(config.mock.streamingDelayMs); // 使用配置的延遲時間
      yield char;
    }
    
    console.log('✅ [Mock] 串流完成');
  }

  // 發送問題並取得串流回應
  async *askQuestion(
    question: string,
    videoId: string,
    chatHistory: ChatMessage[] = []
  ): AsyncGenerator<string> {
    console.log('🎤 [主程序] 用戶提問:', question);
    console.log('🎬 [主程序] 影片 ID:', videoId);
    console.log('💬 [主程序] 聊天歷史長度:', chatHistory.length);
    console.log('⚙️ [主程序] 使用真實 OpenAI:', config.features.enableRealOpenAI);
    console.log('🔑 [主程序] 有 API Key:', !!config.azureOpenAI.apiKey);
    
    const systemMessage = {
      role: 'system',
      content: '你是一個專業的影片內容分析助手。你可以根據用戶的問題，使用提供的工具查詢相關的影片轉錄內容，然後給出準確且有幫助的回答。請用繁體中文回應。'
    };

    const messages = [
      systemMessage,
      ...chatHistory
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => ({
          role: msg.role,
          content: msg.content
        })),
      {
        role: 'user',
        content: question
      }
    ];

    console.log('📋 [主程序] 準備發送的訊息數量:', messages.length);

    if (config.features.enableRealOpenAI && config.azureOpenAI.apiKey) {
      console.log('🌐 [主程序] 使用真實 Azure OpenAI 服務');
      yield* this.streamFromAzureOpenAI(messages, videoId);
    } else {
      console.log('🎭 [主程序] 使用 Mock 服務');
      yield* this.mockStream(question);
    }
    
    console.log('🏁 [主程序] 問答流程結束');
  }
}

export const azureOpenAIService = new AzureOpenAIService();
