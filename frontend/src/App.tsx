import React, { useState } from 'react';
import { Layout, Row, Col, Typography, message, ConfigProvider } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import VideoUpload from './components/VideoUpload';
import VideoList from './components/VideoList';
import ChatInterface from './components/ChatInterface';
import { VideoInfo } from './types';
import 'antd/dist/reset.css';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const App: React.FC = () => {
  const [selectedVideo, setSelectedVideo] = useState<VideoInfo | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 處理影片上傳成功
  const handleUploadSuccess = (video: VideoInfo) => {
    // 清除所有 loading 訊息
    message.destroy();
    message.success(`影片 "${video.name}" 上傳成功！`);
    setRefreshTrigger(prev => prev + 1);
    // 自動選擇剛上傳的影片
    setSelectedVideo(video);
  };

  // 處理影片選擇
  const handleVideoSelect = (video: VideoInfo) => {
    setSelectedVideo(video);
    message.info(`已選擇影片: ${video.name}`);
  };

  // 處理上傳開始
  const handleUploadStart = () => {
    // 不使用 duration: 0 的 loading 訊息，改用普通訊息
    console.log('開始上傳影片...');
  };

  // 處理上傳錯誤
  const handleUploadError = (error: string) => {
    // 清除所有訊息
    message.destroy();
    message.error(`上傳失敗: ${error}`);
  };

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 8,
        },
      }}
    >
      <Layout style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
        {/* 頁面標題 */}
        <Header style={{ 
          backgroundColor: '#fff', 
          padding: '0 24px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <PlayCircleOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
            <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
              影片問答系統
            </Title>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <Text type="secondary">
              上傳影片並使用 AI 進行內容問答
            </Text>
          </div>
        </Header>

        {/* 主要內容 */}
        <Content style={{ 
          padding: '24px', 
          height: 'calc(100vh - 88px)', // 調整為 Header 的實際高度
          overflow: 'hidden'
        }}>
          <Row gutter={[24, 24]} style={{ height: '100%' }}>
            {/* 左側：影片上傳和列表 */}
            <Col xs={24} lg={10} style={{ height: '100%' }}>
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 16,
                height: '100%'
              }}>
                {/* 影片上傳 - 固定高度 */}
                <div style={{ 
                  flexShrink: 0,
                  height: 'auto'
                }}>
                  <VideoUpload
                    onUploadSuccess={handleUploadSuccess}
                    onUploadStart={handleUploadStart}
                    onUploadError={handleUploadError}
                  />
                </div>

                {/* 影片列表 - 填滿剩餘空間 */}
                <div style={{ 
                  flex: 1,
                  minHeight: 0, // 重要：讓 flex 子元素可以縮小
                  overflow: 'hidden'
                }}>
                  <VideoList
                    onVideoSelect={handleVideoSelect}
                    selectedVideoId={selectedVideo?.id}
                    refreshTrigger={refreshTrigger}
                  />
                </div>
              </div>
            </Col>

            {/* 右側：聊天介面 - 填滿整個高度 */}
            <Col xs={24} lg={14} style={{ height: '100%' }}>
              <div style={{ height: '100%' }}>
                <ChatInterface selectedVideo={selectedVideo} />
              </div>
            </Col>
          </Row>
        </Content>
      </Layout>
    </ConfigProvider>
  );
};

export default App;
