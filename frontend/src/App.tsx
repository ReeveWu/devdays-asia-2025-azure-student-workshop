import React, { useState } from 'react';
import { Layout, Row, Col, Typography, message, ConfigProvider, theme } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import VideoUpload from './components/VideoUpload';
import VideoList from './components/VideoList';
import ChatInterface from './components/ChatInterface';
import { VideoInfo } from './types';
import { azureStorageService } from './services/azureStorageService';
import 'antd/dist/reset.css';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const App: React.FC = () => {
  const [selectedVideo, setSelectedVideo] = useState<VideoInfo | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [pendingVideos, setPendingVideos] = useState<VideoInfo[]>([]); // 正在處理中的影片

  // 處理影片上傳成功
  const handleUploadSuccess = async (video: VideoInfo) => {
    // 清除所有 loading 訊息
    message.destroy();
    message.success(`影片 "${video.name}" 上傳成功！`);
    
    // 設置影片為索引中狀態並添加到待處理列表
    const videoWithIndexing = { 
      ...video, 
      isIndexing: true, 
      isIndexed: false 
    };
    
    // 添加到待處理影片列表
    setPendingVideos(prev => [...prev, videoWithIndexing]);
    
    // 開始索引處理
    try {
      console.log('開始影片索引處理...');
      message.info(`正在處理影片 "${video.name}"，請稍候...`);
      
      // 調用索引 API
      await azureStorageService.indexVideo(video.name);
      
      message.success(`影片 "${video.name}" 處理完成！現在可以選擇使用。`);
      
      // 從待處理列表中移除，並觸發重新載入以顯示已索引的影片
      setPendingVideos(prev => prev.filter(v => v.id !== video.id));
      setRefreshTrigger(prev => prev + 1);
      
    } catch (error) {
      console.error('影片索引處理失敗:', error);
      const errorMessage = error instanceof Error ? error.message : '索引處理失敗';
      message.error(`影片處理失敗: ${errorMessage}`);
      
      // 索引失敗時，將影片標記為可選擇（降級處理）
      setPendingVideos(prev => 
        prev.map(v => 
          v.id === video.id 
            ? { ...v, isIndexing: false, isIndexed: true }
            : v
        )
      );
      
      // 延遲後移除並觸發重新載入
      setTimeout(() => {
        setPendingVideos(prev => prev.filter(v => v.id !== video.id));
        setRefreshTrigger(prev => prev + 1);
      }, 2000);
    }
  };

  // 處理影片選擇
  const handleVideoSelect = (video: VideoInfo) => {
    setSelectedVideo(video);
    message.info(`已選擇影片: ${video.name}`);
  };

  // 處理影片刪除
  const handleVideoDelete = (videoId: string) => {
    // 如果刪除的是當前選中的影片，清除選擇
    if (selectedVideo?.id === videoId) {
      setSelectedVideo(null);
      message.info('已清除當前選擇的影片');
    }
  };

  // 處理影片索引狀態更新
  const handleVideoIndexingUpdate = (videoId: string, isIndexing: boolean, isIndexed: boolean) => {
    // 如果當前選中的影片正在索引中，清除選擇
    if (selectedVideo?.id === videoId && isIndexing) {
      setSelectedVideo(null);
    }
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
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#00ffff',
          borderRadius: 8,
          colorBgContainer: '#1a1a1a',
          colorBgElevated: '#1a1a1a',
          colorBgLayout: '#0a0a0a',
          colorText: '#ffffff',
          colorTextBase: '#ffffff',
          colorBorder: '#333333',
          colorBorderSecondary: '#555555',
        },
      }}
    >
      <Layout style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
        {/* 頁面標題 */}
        <Header style={{ 
          backgroundColor: 'rgba(20, 20, 30, 0.9)', 
          padding: '0 24px',
          borderBottom: '1px solid rgba(70, 70, 90, 0.6)',
          display: 'flex',
          alignItems: 'center',
          boxShadow: '0 2px 15px rgba(0,0,0,0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <PlayCircleOutlined style={{ 
              fontSize: '24px', 
              color: '#00d4aa',
              filter: 'drop-shadow(0 0 8px rgba(0, 212, 170, 0.5))',
              animation: 'iconGlow 3s ease-in-out infinite'
            }} />
            <Title level={3} style={{ 
              margin: 0, 
              color: '#ffffff'
            }}>
              影片問答系統
            </Title>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <Text type="secondary" style={{ color: '#bbb' }}>
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
                gap: 3,
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
                    onVideoDelete={handleVideoDelete}
                    onVideoIndexingUpdate={handleVideoIndexingUpdate}
                    pendingVideos={pendingVideos}
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
