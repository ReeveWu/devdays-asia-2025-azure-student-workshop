import React, { useState, useEffect, useRef } from 'react';
import { Card, Input, Button, Avatar, Typography, message, Empty, Spin } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined, CopyOutlined, ReloadOutlined } from '@ant-design/icons';
import { ChatMessage, VideoInfo } from '../types';
import { generateId } from '../utils/helpers';
import { azureOpenAIService } from '../services/azureOpenAIService';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

interface ChatInterfaceProps {
  selectedVideo: VideoInfo | null;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ selectedVideo }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const [toolStatus, setToolStatus] = useState<null | { name: string; args?: any; phase: 'start' | 'end' }>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自動滾動到底部（僅在新訊息時滾動）
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'nearest',
      inline: 'nearest'
    });
  };

  // 只在新訊息完成時滾動，避免串流期間頻繁滾動
  useEffect(() => {
    if (messages.length > 0 && !streamingMessage?.isStreaming) {
      const timer = setTimeout(scrollToBottom, 100);
      return () => clearTimeout(timer);
    }
  }, [messages]);

  // 當開始新的串流訊息時滾動一次
  useEffect(() => {
    if (streamingMessage?.isStreaming && streamingMessage.content === '') {
      const timer = setTimeout(scrollToBottom, 100);
      return () => clearTimeout(timer);
    }
  }, [streamingMessage?.isStreaming]);

  // 清空聊天記錄（當選擇新影片時）
  useEffect(() => {
    if (selectedVideo) {
      setMessages([]);
      setStreamingMessage(null);
    }
  }, [selectedVideo?.id]);

  // 發送訊息
  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading || !selectedVideo) {
      if (!selectedVideo) {
        message.warning('請先選擇一個影片');
      }
      return;
    }

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // 建立串流回應訊息
    const assistantMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    };

    setStreamingMessage(assistantMessage);

    try {
      const stream = azureOpenAIService.askQuestion(
        userMessage.content,
        selectedVideo.id,
        messages
      );

      let fullContent = '';
      let updateCount = 0;
      
    for await (const event of stream) {
        if (event.type === 'text') {
      // 一旦回到文字串流，清除工具狀態（避免與下方 AI 回應中同時顯示）
      setToolStatus(prev => (prev ? null : prev));
          fullContent += event.content;
          updateCount++;

          setStreamingMessage(prev => prev ? {
            ...prev,
            content: fullContent
          } : null);

          if (updateCount % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        } else if (event.type === 'tool_call') {
          // 在 UI 顯示工具調用的狀態與查詢參數
          setToolStatus({ name: event.name, args: event.args, phase: event.status });
        }
      }

      // 串流完成，將訊息加入歷史記錄
      const finalMessage: ChatMessage = {
        ...assistantMessage,
        content: fullContent,
        isStreaming: false
      };

      setMessages(prev => [...prev, finalMessage]);
  setStreamingMessage(null);
  setToolStatus(null);
    } catch (error) {
      console.error('發送訊息失敗:', error);
      message.error('發送訊息失敗，請稍後再試');
  setStreamingMessage(null);
  setToolStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  // 複製訊息內容
  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      message.success('已複製到剪貼板');
    }).catch(() => {
      message.error('複製失敗');
    });
  };

  // 重新發送訊息
  const resendMessage = (content: string) => {
    setInputValue(content);
  };

  // 處理鍵盤事件
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 清空聊天記錄
  const clearChat = () => {
    setMessages([]);
    setStreamingMessage(null);
    setInputValue('');
  };

  // 渲染訊息項目
  const renderMessage = (message: ChatMessage) => {
    const isUser = message.role === 'user';
    
    return (
      <div
        key={message.id}
        style={{
          padding: '12px 0',
          border: 'none',
          borderBottom: 'none'
        }}
      >
        <div style={{ 
          display: 'flex', 
          width: '100%',
          justifyContent: isUser ? 'flex-end' : 'flex-start'
        }}>
          <div style={{
            display: 'flex',
            maxWidth: '80%',
            flexDirection: isUser ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            gap: 12 // 增加間距
          }}>
            <Avatar 
              icon={isUser ? <UserOutlined /> : <RobotOutlined />}
              style={{
                backgroundColor: isUser ? '#007acc' : '#00d4aa',
                color: '#ffffff',
                flexShrink: 0, // 防止被壓縮
                width: '32px',
                height: '32px',
                minWidth: '32px',
                minHeight: '32px'
              }}
              size={32}
            />
            <div style={{
              backgroundColor: isUser ? 'rgba(0, 122, 204, 0.1)' : 'rgba(0, 212, 170, 0.1)',
              padding: '12px 16px',
              borderRadius: '12px',
              border: `1px solid ${isUser ? 'rgba(0, 122, 204, 0.2)' : 'rgba(0, 212, 170, 0.2)'}`,
              position: 'relative',
              backdropFilter: 'blur(10px)'
            }}>
              <Paragraph 
                style={{ 
                  margin: 0,
                  fontSize: '14px',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap', // 保持換行和空格
                  wordBreak: 'break-word' // 長單詞自動換行
                }}
                copyable={{
                  text: message.content,
                  icon: <CopyOutlined />,
                  tooltips: ['複製', '已複製']
                }}
              >
                {message.content}
              </Paragraph>
              <div style={{
                marginTop: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <Text type="secondary" style={{ fontSize: '12px', color: '#888' }}>
                  {message.timestamp.toLocaleTimeString('zh-TW', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
                {isUser && (
                  <Button
                    type="text"
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={() => resendMessage(message.content)}
                    style={{ fontSize: '12px' }}
                  >
                    重新發送
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const allMessages = [...messages];
  if (streamingMessage) {
    allMessages.push(streamingMessage);
  }

  return (
    <Card 
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>影片問答 - {selectedVideo?.name || '未選擇影片'}</span>
          {selectedVideo && messages.length > 0 && (
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={clearChat}
              type="text"
            >
              清空對話
            </Button>
          )}
        </div>
      }
      style={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}
      bodyStyle={{ 
        flex: 1,
        display: 'flex', 
        flexDirection: 'column',
        padding: 0,
        overflow: 'visible'
      }}
    >
      {!selectedVideo ? (
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '40px 24px'
        }}>
          <Empty
            description="請選擇一個影片開始問答"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </div>
      ) : (
        <>
          {/* 訊息列表 */}
          <div style={{ 
            flex: 1, 
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '0 24px',
            minHeight: 0, // 允許 flex 子項目縮小
            scrollBehavior: 'smooth'
          }}>
            {allMessages.length === 0 ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                padding: '40px 0'
              }}>
                <Empty
                  description="開始提問吧！例如：「影片的主要內容是什麼？」"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              </div>
            ) : (
              <div style={{ padding: '16px 0' }}>
                {allMessages.map(renderMessage)}
              </div>
            )}
            {toolStatus && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-start',
                margin: '0 0 12px 0',
                padding: '0 24px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  backgroundColor: 'rgba(255, 215, 0, 0.08)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 215, 0, 0.25)'
                }}>
                  <Spin size="small" />
                  <Text type="secondary" style={{ fontSize: '13px' }}>
                    工具 {toolStatus.name} {toolStatus.phase === 'start' ? '正在準備…' : '已啟動，執行中…'}
                    {toolStatus?.args?.query ? `（查詢：${toolStatus.args.query}）` : ''}
                  </Text>
                </div>
              </div>
            )}
            {streamingMessage?.isStreaming && !toolStatus && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-start',
                marginBottom: 16,
                padding: '0 24px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  backgroundColor: 'rgba(0, 212, 170, 0.1)',
                  borderRadius: '8px',
                  border: '1px solid rgba(0, 212, 170, 0.2)',
                  backdropFilter: 'blur(10px)'
                }}>
                  <Spin size="small" />
                  <Text type="secondary" style={{ fontSize: '13px' }}>
                    AI 正在回應中...
                  </Text>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 輸入區域 */}
          <div style={{ 
            padding: '16px 24px',
            borderTop: '1px solid rgba(70, 70, 90, 0.4)',
            backgroundColor: 'rgba(20, 20, 30, 0.8)'
          }}>
            <div style={{ display: 'flex', gap: 8, paddingTop: 3 }}>
              <TextArea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`向 ${selectedVideo?.name || '影片'} 提問...`}
                autoSize={{ minRows: 1, maxRows: 4 }}
                disabled={isLoading}
                style={{ flex: 1 }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={sendMessage}
                loading={isLoading}
                disabled={!inputValue.trim() || isLoading}
                style={{ alignSelf: 'flex-end' }}
              >
                發送
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
};

export default ChatInterface;

// 確保此檔案被識別為模組
export {};
