# devdays-asia-2025-azure-student-workshop

Build a video Q&A experience on Azure: upload videos to Blob Storage, auto-transcribe with Azure AI Services (Speech), chunk and embed with Azure OpenAI, index into Azure AI Search (vector + keyword), and query via an Azure Functions backend. A React frontend consumes the APIs. This guide focuses on the backend; detailed frontend setup will be added later.

## Architecture

![Indexing Pipeline](./asset/architecture.png)

- Storage: Raw videos live in a Blob container named `videos`.
- Function App (Python):
   - /api/index_video — fetches a blob, submits it to fast transcription, chunks transcript, embeds, and indexes into AI Search.
   - /api/delete_video — removes all indexed chunks for a given video.
   - /api/query_video — retrieval over the indexed chunks for a specific video and returns stitched context.
- Azure AI Services (Speech): Fast transcription API.
- Azure OpenAI: Embeddings for vector search.
- Azure AI Search: Vector index with HNSW + Azure OpenAI vectorizer.

## Repository layout

- backend/
   - function_app/ — Azure Functions (HTTP triggers, Python)
   - create_index/ — Script to create/update the AI Search index
   - functionapp.sh — Deploys function app and sets app settings + CORS
   - storage.sh — Configures Blob public access and CORS
   - index.sh — Exports env vars from YAML and creates the Search index
   - config.template.yaml — Copy to config.yaml and fill in your values
- frontend/ — React app (consumes the backend APIs; details later)
- asset/ — Architecture diagram

## Azure resources required

- Azure subscription and resource group
- Azure Storage account with a container named `videos`
- Azure AI Services (Speech) resource (for transcription)
- Azure OpenAI resource with an embeddings deployment
   - Model: text-embedding-3-large (3072 dims) or compatible
- Azure AI Search service (Free or higher), with vector search enabled
- Azure Functions app (Python) on a supported plan (e.g., Flex Consumption)

## Configure the project (backend)

1) Create your configuration file from the template and edit values:

```bash
cd backend
cp config.template.yaml config.yaml
```

Key fields in `backend/config.yaml` map to runtime environment variables used by the code:

- openAI: endpoint, apiKey, embeddingModelName, embeddingDeploymentName, embeddingDimensions
- aiService: name (the AI Services/Speech resource name), subscriptionKey
- searchService: name, clientKey, indexName
- storage: accountName, blobContainerName, connectionString
- functionApp: name — used by the deploy script

Notes
- Do not commit secrets (api keys, connection strings). The template is safe to commit; your `config.yaml` is not.
- Ensure the embeddingDimensions matches the embedding model (3072 for text-embedding-3-large).

## Provision and configure (scripts)

All scripts read from `backend/config.yaml` and use Azure CLI under the hood. Make sure you are logged in to the correct subscription with Azure CLI before running them.

1) Create or update the Azure AI Search index

```bash
bash ./index.sh
```

What it does
- Exports environment variables from `config.yaml`.
- Installs Python deps for the index script.
- Creates/updates the index with fields: `chunk_id` (key), `id`, `video_name`, `text`, `start_time`, `end_time`, and `vector` (dims per your config).

2) Deploy the Azure Functions backend and set app settings

```bash
bash ./functionapp.sh
```

What it does
- Sets application settings for the function app (OpenAI, Search, Storage, Speech keys and endpoints).
- Zips and deploys `backend/function_app` code.
- Configures permissive CORS for demo purposes. For production, restrict origins explicitly.

3) Configure Storage access and CORS for the `videos` container

```bash
bash ./storage.sh
```

What it does
- Enables public blob access on the storage account.
- Sets container access level and CORS for basic browser access. For production, prefer signed URLs or identities.


## API reference (backend)

Base URL: https://<your-function-app>.azurewebsites.net

1) Index a video
- POST /api/index_video
- Body: { "video_name": "How to remix with Sora.mp4" }
- Behavior: Downloads from Blob, sends to transcription, chunks and embeds, uploads chunks to AI Search.
- Response: { "status": "Video indexed successfully" }

2) Delete a video’s indexed chunks
- POST /api/delete_video
- Body: { "video_name": "How to remix with Sora.mp4" }
- Response: { "status": "Documents deleted successfully" }

3) Query a specific video’s transcript
- POST /api/query_video
- Body: { "query": "What are the steps?", "videoId": "How to remix with Sora.mp4" }
- Response: { "text": "Here are the transcript segments..." }

Example requests (replace placeholders)

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
   -d '{"video_name": "<video_name>"}'
```

## Frontend

The React app lives in `frontend/` and consumes the three backend endpoints listed above. Detailed setup and environment variables for the frontend will be provided later.


## License

This workshop code is provided for educational and demonstration purposes. A formal license may be added to the repository; until then, verify terms of use for any incorporated services and dependencies before production use.


