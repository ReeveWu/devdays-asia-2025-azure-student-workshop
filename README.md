# devdays-asia-2025-azure-student-workshop

## Introduction

This project aims to build a video Q&A experience on Azure. Users can upload videos to Blob Storage, which are then auto-transcribed using Azure AI Services (Speech). The transcriptions are chunked and embedded with Azure OpenAI, indexed into Azure AI Search (supporting both vector and keyword search), and queried via an Azure Functions backend. A React frontend will consume the APIs provided by the backend.

## Architecture

![Indexing Pipeline](./asset/architecture.png)

**Components**

* **Storage**: Raw videos in Blob container `videos`
* **Function App (Python)**:
  * `POST /api/index_video` — Transcribe, chunk, embed, index
  * `POST /api/delete_video` — Remove indexed chunks
  * `POST /api/query_video` — Retrieve transcript context
* **Azure AI Services (Speech)** — Fast transcription
* **Azure OpenAI** — Embeddings for vector search
* **Azure AI Search** — Vector index (HNSW + Azure OpenAI vectorizer)

---

## Repository Layout

```plaintext
backend/
  ├─ function_app/         # Azure Functions (HTTP triggers, Python)
  ├─ create_index/         # Script to create/update AI Search index
  ├─ functionapp.sh        # Deploys function app, sets settings + CORS
  ├─ storage.sh            # Configures Blob public access + CORS
  ├─ index.sh              # Loads env vars, creates Search index
  ├─ config.template.yaml  # Copy to config.yaml & fill values
frontend/                  # React app (frontend; details later)
asset/                     # Architecture diagram
```

---

## Azure Resources Required

| Resource                            | Purpose                 | Notes                                       |
| ----------------------------------- | ----------------------- | ------------------------------------------- |
| Azure Subscription & Resource Group | All services            | —                                           |
| Azure Storage Account               | Store videos            | Container name: `videos`                    |
| Azure AI Services (Speech)          | Transcription           | Fast transcription API                      |
| Azure OpenAI                        | Embedding generation    | Model: `text-embedding-3-large` (3072 dims) |
| Azure AI Search                     | Vector + keyword search | Free tier or higher                         |
| Azure Functions App (Python)        | Backend APIs            | Plan: Flex Consumption or above             |

---

## Configure Backend

1. **Create config file from template**

```bash
cd backend
cp config.template.yaml config.yaml
```

2. **Key fields in `config.yaml`**
  These map to **runtime environment variables**:

  - `openAI`: endpoint, apiKey, embeddingModelName, embeddingDeploymentName, embeddingDimensions
  - `aiService`: name (the AI Services/Speech resource name), subscriptionKey
  - `searchService`: name, clientKey, indexName
  - `storage`: accountName, blobContainerName, connectionString
  - `functionApp`: name — used by the deploy script

> * **Never commit secrets** (`apiKey`, connection strings).
> * Ensure `embeddingDimensions` matches the model (`3072` for `text-embedding-3-large`).

---

## Provision & Configure (Scripts)

> All scripts use **Azure CLI** and `backend/config.yaml`.
> Make sure you are logged into the correct subscription.

### Create/Update Azure AI Search Index

```bash
bash ./index.sh
```

**What it does**:

* Loads env vars from `config.yaml`
* Installs Python dependencies for indexing
* Creates/updates index fields:
  `chunk_id` (key), `id`, `video_name`, `text`, `start_time`, `end_time`, `vector`

---

### Deploy Azure Functions Backend

```bash
bash ./functionapp.sh
```

**What it does**:

* Sets application settings (keys, endpoints)
* Zips & deploys `backend/function_app`
* Configures permissive CORS *(restrict in production)*

---

### Configure Storage Access + CORS

```bash
bash ./storage.sh
```

**What it does**:

* Enables public blob access
* Sets container access & CORS *(for demo; use signed URLs in production)*

---

## API Reference

**Base URL**: `https://<your-function-app>.azurewebsites.net`

| Method | Endpoint            | Purpose                                  |
| ------ | ------------------- | ---------------------------------------- |
| `POST` | `/api/index_video`  | Index a video (transcribe, embed, index) |
| `POST` | `/api/delete_video` | Delete a video’s indexed chunks          |
| `POST` | `/api/query_video`  | Query a video’s transcript               |

**Example Requests**

```bash
# Index
curl -sS -X POST \
  "$FUNCTION_BASE/api/index_video" \
  -H 'Content-Type: application/json' \
  -d '{"video_name":"<video_name>"}'

# Query
curl -sS -X POST \
  "$FUNCTION_BASE/api/query_video" \
  -H 'Content-Type: application/json' \
  -d '{"query":"<query>","videoId":"<video_name>"}'

# Delete
curl -sS -X POST \
  "$FUNCTION_BASE/api/delete_video" \
  -H 'Content-Type: application/json' \
  -d '{"video_name":"<video_name>"}'
```

---

## Frontend

The **React app** in `frontend/` consumes these APIs.
Setup & env variables will be documented later.

---

## License

This workshop code is for **educational/demo** purposes.
A formal license may be added later — check terms for all dependencies before production.