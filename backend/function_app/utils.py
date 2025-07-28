import io, os, time, json, requests
from azure.storage.blob import BlobServiceClient
import logging
import uuid
from openai import AzureOpenAI
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient

ai_service_name = os.getenv('AI_FOUNDRY_NAME')
ai_service_subscription_key = os.getenv('AI_SERVICE_SUBSCRIPTION_KEY')
storage_connection_string = os.getenv('STORAGE_CONNECTION_STRING')
blob_container_name = os.getenv('BLOB_CONTAINER_NAME')

openai_client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_version="2024-10-21",
    azure_deployment=os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME")
)
blob_service_client = BlobServiceClient.from_connection_string(storage_connection_string)
search_client = SearchClient(
    endpoint=f"https://{os.getenv('SEARCH_SERVICE_NAME')}.search.windows.net",
    index_name=os.getenv("SEARCH_SERVICE_INDEX_NAME"),
    credential=AzureKeyCredential(os.getenv("SEARCH_SERVICE_CLIENT_KEY"))
)

def mstotime(milliseconds):
    hours = milliseconds // 3_600_000
    minutes = (milliseconds % 3_600_000) // 60_000
    seconds = (milliseconds % 60_000) // 1_000
    return f"{int(hours):02}:{int(minutes):02}:{int(seconds):02}"


def get_blob_from_connection_string(blob_name: str) -> io.BytesIO:
    blob_client = blob_service_client.get_blob_client(
        container=blob_container_name,
        blob=blob_name
    )
    downloader = blob_client.download_blob()
    stream = io.BytesIO()
    downloader.readinto(stream)

    stream.seek(0)
    return stream


def call_fast_transcription_service_test(audio: io.BytesIO):
    start_t = time.time()
    url = f'https://{ai_service_name}.cognitiveservices.azure.com/speechtotext/transcriptions:transcribe?api-version=2024-11-15'
    
    headers = {
        'Accept': 'application/json',
        'Ocp-Apim-Subscription-Key': ai_service_subscription_key,
    }
    definition = {
        "locales": ["en-US", "zh-CN"],
        "profanityFilterMode": "Masked"
    }
    files = {
        'audio': audio,
        'definition': (None, json.dumps(definition), 'application/json'),
    }
    logging.info(f"Calling transcription service at {url} with headers: {headers} and files: {files.keys()}")
    response = requests.post(url, headers=headers, files=files)
    
    if response.status_code != 200:
        raise Exception(f"Failed to call the service. Status code: {response.status_code}, Message: {response.text}")
    
    logging.info(f"Transcription service call took {time.time() - start_t:.2f} seconds")
    return response.json()


def embed_text(text: str):
    response = openai_client.embeddings.create(
        input=text,
        model=os.getenv("AZURE_OPENAI_EMBEDDING_MODEL_NAME"),
    )
    embeddings = response.data[0].embedding
    return embeddings


def format_transcription_response(response, video_name):
    segments = []
    for idx, phrase in enumerate(response['phrases']):
        start_time = mstotime(phrase['offsetMilliseconds'])
        end_time = mstotime(phrase['offsetMilliseconds'] + phrase['durationMilliseconds'])
        text = phrase['text']
        segments.append({
            'chunk_id': str(uuid.uuid4()),
            'id': str(idx),
            'start_time': start_time,
            'end_time': end_time,
            'text': text,
            'video_name': video_name,
            'vector': embed_text(text)
        })
    return segments


def insert_index_documents(segments):
    results = search_client.upload_documents(documents=segments)
    logging.info(f"Uploaded {len(results)} documents to the index.")
    
    return results

def delete_documents_by_video_name(video_name: str):
    filter_expr = f"video_name eq '{video_name}'"
    results = search_client.search(search_text="*", filter=filter_expr, select=["chunk_id"], top=10000)

    ids_to_delete = [doc["chunk_id"] for doc in results]
    
    if ids_to_delete:
        result = search_client.delete_documents(documents=[{"chunk_id": doc_id} for doc_id in ids_to_delete])
        logging.info(f"Requested deletion of {len(result)} documents.")
    else:
        logging.info("No documents found to delete.")


def query_video_segments(question: str, top_k: int = 5):
    embedding = embed_text(question)

    results = search_client.search(
        search_text=question,
        vectors=[{
            "value": embedding,
            "fields": "vector",
            "k": top_k
        }],
        top=top_k,
        query_type="semantic",
        semantic_configuration_name="semantic-config",
        vector_search_options={"profile": "vector-profile"},
    )

    context_chunks = []
    for result in results:
        chunk = {
            "video_name": result.get("video_name"),
            "start_time": result.get("start_time"),
            "end_time": result.get("end_time"),
            "text": result.get("text"),
        }
        context_chunks.append(chunk)

    return context_chunks
