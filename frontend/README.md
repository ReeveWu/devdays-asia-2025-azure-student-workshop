# 影片問答系統

一個基於 React 和 Azure 服務的影片上傳與內容問答平台，讓使用者可以上傳影片到 Azure Blob Storage，並使用 Azure OpenAI 與影片內容進行互動式問答。

## 功能特色

### 🎬 影片上傳

- 支援 MP4、MOV、AVI、MKV、WebM 格式
- 拖放式上傳介面
- 即時上傳進度顯示
- 檔案大小驗證（最大 100MB）
- Azure Blob Storage 整合

### 💬 智慧問答

- 基於 Azure OpenAI 的自然語言處理
- 串流式回應，即時顯示
- 多輪對話支援
- 工具呼叫功能，查詢影片轉錄內容
- 聊天歷史記錄

### 📋 影片管理

- 影片列表顯示
- 影片選擇和預覽
- 上傳日期和檔案資訊
- 縮圖顯示

## 技術架構

### 前端技術

- **React 18** - 現代化的用戶介面框架
- **TypeScript** - 型別安全的 JavaScript 超集
- **Ant Design** - 企業級 UI 設計語言
- **Vite/Create React App** - 現代化的建置工具

### Azure 服務整合

- **Azure Blob Storage** - 影片檔案儲存
- **Azure OpenAI** - 智慧問答服務
- **自訂轉錄 API** - 影片內容分析

### 開發模式支援

- **可配置的 Mock 模式** - 無需真實 Azure 服務即可開發測試
- **環境變數配置** - 彈性的部署配置
- **開發友善的錯誤處理** - 完整的錯誤提示和處理

## 快速開始

### 1. 安裝相依套件

```bash
npm install
```

### 2. 環境配置

複製環境變數範例檔案：

```bash
cp .env.example .env
```

編輯 `.env` 檔案，配置您的 Azure 服務資訊：

```env
# Azure Blob Storage 配置
REACT_APP_AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=your-storage-account-name;AccountKey=your-account-key;EndpointSuffix=core.windows.net
REACT_APP_AZURE_STORAGE_CONTAINER_NAME=videos

# Azure OpenAI 配置
REACT_APP_AZURE_OPENAI_ENDPOINT=https://your-openai-resource.openai.azure.com/
REACT_APP_AZURE_OPENAI_API_KEY=your-api-key
REACT_APP_AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
REACT_APP_AZURE_OPENAI_API_VERSION=2024-10-21

# 轉錄 API 配置
REACT_APP_TRANSCRIPTION_API_ENDPOINT=http://localhost:3001/api/transcription

# 開發模式配置 (true/false)
REACT_APP_ENABLE_REAL_STORAGE_UPLOAD=false
REACT_APP_ENABLE_REAL_OPENAI=false
REACT_APP_ENABLE_REAL_TRANSCRIPTION_API=false

# Mock 資料配置
REACT_APP_MOCK_DELAY_MS=1000
```

### 3. 啟動開發伺服器

```bash
npm start
```

應用程式將在 [http://localhost:3000](http://localhost:3000) 上運行。

## 開發模式配置

此應用程式支援三種模式的配置，可以獨立開啟或關閉：

### 影片上傳模式

- `REACT_APP_ENABLE_REAL_STORAGE_UPLOAD=true` - 使用真實的 Azure Blob Storage
- `REACT_APP_ENABLE_REAL_STORAGE_UPLOAD=false` - 使用模擬上傳（檔案存在瀏覽器中）

### AI 問答模式

- `REACT_APP_ENABLE_REAL_OPENAI=true` - 使用真實的 Azure OpenAI API
- `REACT_APP_ENABLE_REAL_OPENAI=false` - 使用模擬的 AI 回應

### 轉錄 API 模式

- `REACT_APP_ENABLE_REAL_TRANSCRIPTION_API=true` - 調用真實的轉錄 API
- `REACT_APP_ENABLE_REAL_TRANSCRIPTION_API=false` - 使用模擬的轉錄資料

## 使用說明

### 1. 上傳影片

1. 在首頁點擊上傳區域或拖拽影片檔案
2. 選擇支援格式的影片檔案（MP4、MOV、AVI、MKV、WebM）
3. 點擊「開始上傳」按鈕
4. 等待上傳完成

### 2. 選擇影片

1. 在影片列表中查看已上傳的影片
2. 點擊「選擇」按鈕選擇要問答的影片
3. 被選中的影片會以綠色邊框標示

### 3. 開始問答

1. 在右側聊天介面中輸入問題
2. 例如：「影片的主要內容是什麼？」
3. 點擊「發送」或按 Enter 鍵
4. AI 會即時回應並顯示相關答案

### 4. 多輪對話

- 系統會保留對話歷史
- 可以基於之前的對話繼續提問
- 支援複製訊息內容
- 可以重新發送之前的問題

## 建置和部署

### 開發建置

```bash
npm run build
```

### 生產環境部署

1. 確保所有環境變數都已正確設定
2. 將 `REACT_APP_ENABLE_REAL_*` 設為 `true`
3. 建置應用程式：`npm run build`
4. 將 `build` 資料夾部署到您的網頁伺服器

## Azure 服務設定

### Azure Blob Storage

1. 建立 Azure Storage Account
2. 建立容器（例如：`videos`）
3. 取得 Storage Account 的 Connection String
   - 在 Azure Portal 中進入 Storage Account
   - 選擇「Access keys」
   - 複製 Connection string
4. 將 Connection String 填入環境變數 `REACT_APP_AZURE_STORAGE_CONNECTION_STRING`

### Azure OpenAI

1. 建立 Azure OpenAI 資源
2. 部署 GPT-4 模型
3. 取得 API 金鑰和端點
4. 將相關資訊填入環境變數

### 轉錄 API

您需要實作一個轉錄 API，接收以下格式的請求：

```typescript
interface TranscriptionQuery {
  query: string; // 使用者的問題
  videoId: string; // 影片 ID
}

interface TranscriptionResponse {
  text: string; // 相關的轉錄內容
  relevantSegments?: Array<{
    start: number;
    end: number;
    text: string;
    confidence: number;
  }>;
}
```

## 專案結構

```
src/
├── components/          # React 組件
│   ├── VideoUpload.tsx     # 影片上傳組件
│   ├── VideoList.tsx       # 影片列表組件
│   └── ChatInterface.tsx   # 聊天介面組件
├── services/           # 服務層
│   ├── azureStorageService.ts    # Azure Storage 服務
│   ├── azureOpenAIService.ts     # Azure OpenAI 服務
│   └── transcriptionService.ts  # 轉錄服務
├── types/              # TypeScript 型別定義
│   └── index.ts
├── utils/              # 工具函數
│   ├── config.ts
│   └── helpers.ts
├── App.tsx             # 主應用程式組件
├── index.tsx           # 應用程式入口點
└── index.css           # 全域樣式
```

## 故障排除

### 常見問題

1. **上傳失敗**

   - 檢查檔案格式是否支援
   - 確認檔案大小不超過 100MB
   - 驗證 Azure Storage 配置

2. **AI 回應異常**

   - 檢查 Azure OpenAI API 金鑰
   - 確認模型部署狀態
   - 查看瀏覽器控制台錯誤訊息

3. **轉錄查詢失敗**
   - 確認轉錄 API 端點可訪問
   - 檢查 API 請求格式
   - 驗證影片 ID 正確性

### 除錯模式

在開發模式下，應用程式會在瀏覽器控制台顯示詳細的除錯資訊，包括：

- API 呼叫狀態
- 錯誤訊息詳情
- 服務配置資訊

## 授權

此專案僅供開發和學習使用。

## 支援

如有問題，請檢查：

1. 環境變數配置是否正確
2. Azure 服務是否正常運作
3. 網路連線是否穩定
4. 瀏覽器控制台的錯誤訊息
