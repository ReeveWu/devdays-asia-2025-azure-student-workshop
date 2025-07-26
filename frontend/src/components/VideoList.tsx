import React, { useState, useEffect } from 'react';
import { Card, List, Avatar, Button, Typography, message, Empty, Spin } from 'antd';
import { PlayCircleOutlined, CalendarOutlined, FileOutlined } from '@ant-design/icons';
import { VideoInfo } from '../types';
import { formatFileSize, formatDuration } from '../utils/helpers';
import { azureStorageService } from '../services/azureStorageService';

const { Text } = Typography;

interface VideoListProps {
  onVideoSelect: (video: VideoInfo) => void;
  selectedVideoId?: string;
  refreshTrigger?: number; // 用於觸發重新載入
}

const VideoList: React.FC<VideoListProps> = ({
  onVideoSelect,
  selectedVideoId,
  refreshTrigger
}) => {
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [loading, setLoading] = useState(false);

  // 載入影片列表
  const loadVideos = async () => {
    setLoading(true);
    try {
      const videoList = await azureStorageService.getVideoList();
      setVideos(videoList);
    } catch (error) {
      console.error('載入影片列表失敗:', error);
      message.error('載入影片列表失敗');
    } finally {
      setLoading(false);
    }
  };

  // 初次載入和重新載入
  useEffect(() => {
    loadVideos();
  }, [refreshTrigger]);

  // 格式化上傳日期
  const formatUploadDate = (date: Date) => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '今天';
    if (diffDays === 2) return '昨天';
    if (diffDays <= 7) return `${diffDays - 1} 天前`;
    
    return date.toLocaleDateString('zh-TW');
  };

  if (loading) {
    return (
      <Card title="影片列表">
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">載入影片列表中...</Text>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card 
      title="影片列表" 
      extra={
        <Button onClick={loadVideos} size="small">
          重新載入
        </Button>
      }
      style={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
      bodyStyle={{ 
        flex: 1,
        padding: '16px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {videos.length === 0 ? (
        <Empty
          description="尚未上傳任何影片"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <div style={{ 
          flex: 1,
          overflow: 'auto'
        }}>
          <List
            itemLayout="horizontal"
            dataSource={videos}
            renderItem={(video) => (
              <List.Item
                actions={[
                  <Button
                    key="select"
                    type={selectedVideoId === video.id ? 'primary' : 'default'}
                    icon={<PlayCircleOutlined />}
                    onClick={() => onVideoSelect(video)}
                    size="small"
                  >
                    {selectedVideoId === video.id ? '已選擇' : '選擇'}
                  </Button>
                ]}
                style={{
                  backgroundColor: selectedVideoId === video.id ? '#f6ffed' : 'transparent',
                  padding: '12px 16px',
                  borderRadius: '6px',
                  margin: '4px 0',
                  border: selectedVideoId === video.id ? '1px solid #52c41a' : '1px solid transparent'
                }}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar 
                      src={video.thumbnail} 
                      icon={<PlayCircleOutlined />}
                      size={64}
                      shape="square"
                      style={{
                        flexShrink: 0, // 防止被壓縮
                        width: '64px',
                        height: '64px',
                        minWidth: '64px',
                        minHeight: '64px'
                      }}
                    />
                  }
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Text strong style={{ fontSize: '14px' }}>
                        {video.name}
                      </Text>
                      {selectedVideoId === video.id && (
                        <Text type="success" style={{ fontSize: '12px' }}>
                          ● 當前選擇
                        </Text>
                      )}
                    </div>
                  }
                  description={
                    <div style={{ fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <FileOutlined />
                          <Text type="secondary">{formatFileSize(video.size)}</Text>
                        </span>
                        {video.duration && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <PlayCircleOutlined />
                            <Text type="secondary">{formatDuration(video.duration)}</Text>
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CalendarOutlined />
                        <Text type="secondary">
                          上傳於 {formatUploadDate(video.uploadDate)}
                        </Text>
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      )}
    </Card>
  );
};

export default VideoList;

// 確保此檔案被識別為模組
export {};