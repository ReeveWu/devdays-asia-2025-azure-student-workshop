import React, { useState, useEffect } from 'react';
import { Card, List, Avatar, Button, Typography, message, Empty, Spin, Popconfirm } from 'antd';
import { PlayCircleOutlined, CalendarOutlined, FileOutlined, DeleteOutlined, LoadingOutlined } from '@ant-design/icons';
import { VideoInfo } from '../types';
import { formatFileSize, formatDuration } from '../utils/helpers';
import { azureStorageService } from '../services/azureStorageService';

const { Text } = Typography;

interface VideoListProps {
  onVideoSelect: (video: VideoInfo) => void;
  selectedVideoId?: string;
  refreshTrigger?: number; // 用於觸發重新載入
  onVideoDelete?: (videoId: string) => void; // 刪除影片後的回調
  onVideoIndexingUpdate?: (videoId: string, isIndexing: boolean, isIndexed: boolean) => void; // 索引狀態更新回調
  pendingVideos?: VideoInfo[]; // 正在處理中的影片
}

const VideoList: React.FC<VideoListProps> = ({
  onVideoSelect,
  selectedVideoId,
  refreshTrigger,
  onVideoDelete,
  onVideoIndexingUpdate,
  pendingVideos = []
}) => {
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);

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

  // 刪除影片
  const handleDeleteVideo = async (video: VideoInfo) => {
    setDeletingVideoId(video.id);
    
    try {
      console.log('開始刪除影片:', video.name);
      await azureStorageService.deleteVideo(video.id);
      
      message.success(`影片 "${video.name}" 刪除成功`);
      
      // 從本地列表中移除影片
      setVideos(prevVideos => prevVideos.filter(v => v.id !== video.id));
      
      // 如果刪除的是當前選中的影片，通知父組件
      if (selectedVideoId === video.id) {
        onVideoDelete?.(video.id);
      }
      
    } catch (error) {
      console.error('刪除影片失敗:', error);
      const errorMessage = error instanceof Error ? error.message : '刪除失敗';
      message.error(`刪除影片失敗: ${errorMessage}`);
    } finally {
      setDeletingVideoId(null);
    }
  };

  // 更新影片索引狀態
  const updateVideoIndexingStatus = (videoId: string, isIndexing: boolean, isIndexed: boolean) => {
    setVideos(prevVideos => 
      prevVideos.map(video => 
        video.id === videoId 
          ? { ...video, isIndexing, isIndexed }
          : video
      )
    );
    onVideoIndexingUpdate?.(videoId, isIndexing, isIndexed);
  };

  // 渲染選擇按鈕
  const renderSelectButton = (video: VideoInfo) => {
    if (video.isIndexing) {
      return (
        <Button
          key="indexing"
          icon={<LoadingOutlined />}
          disabled
          size="small"
        >
          處理中
        </Button>
      );
    }

    if (!video.isIndexed) {
      return (
        <Button
          key="waiting"
          disabled
          size="small"
        >
          等待處理
        </Button>
      );
    }

    return (
      <Button
        key="select"
        type={selectedVideoId === video.id ? 'primary' : 'default'}
        icon={<PlayCircleOutlined />}
        onClick={() => onVideoSelect(video)}
        size="small"
      >
        {selectedVideoId === video.id ? '已選擇' : '選擇'}
      </Button>
    );
  };

  // 合併待處理影片和已載入影片
  const allVideos = React.useMemo(() => {
    // 過濾掉已載入影片中與待處理影片重複的項目
    const loadedVideosFiltered = videos.filter(
      video => !pendingVideos.some(pending => pending.id === video.id)
    );
    
    // 合併並按上傳時間排序
    const combined = [...pendingVideos, ...loadedVideosFiltered];
    return combined.sort((a, b) => b.uploadDate.getTime() - a.uploadDate.getTime());
  }, [videos, pendingVideos]);

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
      {allVideos.length === 0 ? (
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
            dataSource={allVideos}
            renderItem={(video) => (
              <List.Item
                actions={[
                  renderSelectButton(video),
                  <Popconfirm
                    key="delete"
                    title="確認刪除"
                    description={`確定要刪除影片 "${video.name}" 嗎？此操作無法復原。`}
                    onConfirm={() => handleDeleteVideo(video)}
                    okText="確定刪除"
                    cancelText="取消"
                    okType="danger"
                    disabled={video.isIndexing} // 處理中時禁用刪除
                  >
                    <Button
                      icon={<DeleteOutlined />}
                      loading={deletingVideoId === video.id}
                      disabled={deletingVideoId === video.id || video.isIndexing} // 處理中時禁用刪除
                      danger
                      size="small"
                      title={video.isIndexing ? '影片處理中，無法刪除' : '刪除影片'}
                    >
                      刪除
                    </Button>
                  </Popconfirm>
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