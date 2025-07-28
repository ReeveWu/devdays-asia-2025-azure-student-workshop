import React, { useState, useRef } from 'react';
import { Upload, Button, Progress, message, Card, Typography } from 'antd';
import { InboxOutlined, DeleteOutlined } from '@ant-design/icons';
import { VideoInfo, UploadProgress } from '../types';
import { validateVideoFile, formatFileSize } from '../utils/helpers';
import { azureStorageService } from '../services/azureStorageService';

const { Dragger } = Upload;
const { Text } = Typography;

interface VideoUploadProps {
  onUploadSuccess: (video: VideoInfo) => void;
  onUploadStart?: () => void;
  onUploadError?: (error: string) => void;
}

const VideoUpload: React.FC<VideoUploadProps> = ({
  onUploadSuccess,
  onUploadStart,
  onUploadError
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 處理檔案選擇
  const handleFileSelect = (file: File) => {
    const validation = validateVideoFile(file);
    if (!validation.isValid) {
      message.error(validation.error);
      return false;
    }

    setSelectedFile(file);
    message.success(`已選擇檔案: ${file.name}`);
    return false; // 阻止 antd 的默認上傳行為
  };

  // 開始上傳
  const startUpload = async () => {
    if (!selectedFile) {
      message.warning('請先選擇影片檔案');
      return;
    }

    setUploading(true);
    setProgress({ loaded: 0, total: selectedFile.size, percentage: 0 });
    onUploadStart?.();

    try {
      console.log('開始上傳影片檔案:', selectedFile.name);
      
      const videoInfo = await azureStorageService.uploadVideo(
        selectedFile,
        (uploadProgress) => {
          console.log('收到上傳進度:', uploadProgress);
          setProgress(uploadProgress);
        }
      );

      console.log('上傳完成，影片資訊:', videoInfo);
      
      // 先設置上傳狀態為 false，讓進度條變為成功狀態
      setUploading(false);
      
      // 等待一小段時間讓用戶看到成功狀態
      setTimeout(() => {
        onUploadSuccess(videoInfo);
        
        // 清理狀態
        setSelectedFile(null);
        setProgress(null);
      }, 1000);
      
    } catch (error) {
      console.error('上傳失敗:', error);
      const errorMessage = error instanceof Error ? error.message : '上傳失敗';
      message.error(errorMessage);
      onUploadError?.(errorMessage);
      
      // 發生錯誤時立即重置狀態
      setUploading(false);
      setProgress(null);
    }
  };

  // 清除選擇的檔案
  const clearSelectedFile = () => {
    setSelectedFile(null);
    setProgress(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card title="影片上傳" style={{ marginBottom: 6, position: 'relative' }}>
      <div style={{ marginBottom: 16, paddingTop: 3 }}>
        <Dragger
          name="video"
          multiple={false}
          beforeUpload={handleFileSelect}
          showUploadList={false}
          disabled={uploading}
          accept="video/*"
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">
            點擊或拖拽影片檔案到此區域上傳
          </p>
          <p className="ant-upload-hint">
            支援 MP4、MOV、AVI、MKV、WebM 格式，檔案大小不超過 100MB
          </p>
        </Dragger>
      </div>

      {selectedFile && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Text strong>{selectedFile.name}</Text>
              <br />
              <Text type="secondary">{formatFileSize(selectedFile.size)}</Text>
            </div>
            <Button
              icon={<DeleteOutlined />}
              onClick={clearSelectedFile}
              disabled={uploading}
              danger
              size="small"
            >
              移除
            </Button>
          </div>
        </Card>
      )}

      {progress && (
        <div style={{ marginBottom: 16 }}>
          <Progress
            percent={Math.round(progress.percentage)}
            status={uploading ? 'active' : 'success'}
            showInfo
          />
          <Text type="secondary">
            {formatFileSize(progress.loaded)} / {formatFileSize(progress.total)}
          </Text>
        </div>
      )}

      <Button
        type="primary"
        onClick={startUpload}
        loading={uploading}
        disabled={!selectedFile || uploading}
        size="large"
        block
      >
        {uploading ? '上傳中...' : '開始上傳'}
      </Button>
    </Card>
  );
};

export default VideoUpload;
