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
    start_time = None
    end_time = None
    text = ""
    cnt = 0
    for phrase in response['phrases']:
        if start_time is None:
            start_time = mstotime(phrase['offsetMilliseconds'])
        text += f'{phrase["text"].strip()}\n\n'
        cnt += 1

        if len(text.split()) > 15 or cnt == 3:
            end_time = mstotime(phrase['offsetMilliseconds'] + phrase['durationMilliseconds'])
            segments.append({
                'chunk_id': str(uuid.uuid4()),
                'id': str(len(segments)),
                'start_time': start_time,
                'end_time': end_time,
                'text': text,
                'video_name': video_name,
                'vector': embed_text(text)
            })
            start_time = None
            text = ""
            cnt = 0

    if len(text) > 0:
        end_time = mstotime(phrase['offsetMilliseconds'] + phrase['durationMilliseconds'])
        segments.append({
            'chunk_id': str(uuid.uuid4()),
            'id': str(len(segments)),
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


from typing import List, Dict, Any
from azure.core.exceptions import HttpResponseError
from azure.search.documents.models import VectorizableTextQuery

def _escape_odata_literal(s: str) -> str:
    # OData 單引號要重複一次：O'Reilly -> 'O''Reilly'
    return s.replace("'", "''")

def query_video_segments_by_video(
    question: str,
    video_name: str,
    top_base: int = 2,
) -> List[Dict[str, Any]]:
    FIELDS = ["chunk_id", "id", "video_name", "text", "start_time", "end_time"]

    vq = VectorizableTextQuery(text=question, k_nearest_neighbors=top_base * 3, fields="vector")

    filter_expr = f"video_name eq '{_escape_odata_literal(video_name)}'"

    results = search_client.search(
        search_text=question,                 
        vector_queries=[vq],
        filter=filter_expr,
        top=top_base,
        select=FIELDS,
        include_total_count=False,
    )

    seeds = [r for r in results]  
    if not seeds:
        return []

    
    neighbor_ids: set[str] = set()
    seed_by_id: dict[str, Dict[str, Any]] = {}  

    for s in seeds:
        seed_by_id[str(s["id"])] = s
        try:
            base = int(str(s["id"]))
            neighbor_ids.add(str(base - 1))
            neighbor_ids.add(str(base + 1))
        except ValueError:
            
            pass

    neighbor_docs_by_id: dict[str, Dict[str, Any]] = {}
    if neighbor_ids:
        id_list = ",".join(sorted(neighbor_ids))
        filter_neighbors = (
            f"video_name eq '{_escape_odata_literal(video_name)}' "
            f"and search.in(id, '{id_list}', ',')"
        )
        neighbor_results = search_client.search(
            search_text="*",    
            filter=filter_neighbors,
            top=len(neighbor_ids),
            select=FIELDS,
        )
        for doc in neighbor_results:
            neighbor_docs_by_id[str(doc["id"])] = doc

    seen_chunk_ids: set[str] = set()
    out: List[Dict[str, Any]] = []

    def _emit(doc):
        cid = doc["chunk_id"]
        if cid not in seen_chunk_ids:
            seen_chunk_ids.add(cid)
            out.append({
                "chunk_id": doc["chunk_id"],
                "id": doc["id"],
                "video_name": doc["video_name"],
                "text": doc["text"],
                "start_time": doc["start_time"],
                "end_time": doc["end_time"],
                "score": doc.get("@search.score", 0),
            })

    for s in seeds:
        try:
            base = int(str(s["id"]))
            prev_id = str(base - 1)
            if prev_id in neighbor_docs_by_id:
                _emit(neighbor_docs_by_id[prev_id])
        except ValueError:
            pass
        _emit(s)
        try:
            base = int(str(s["id"]))
            next_id = str(base + 1)
            if next_id in neighbor_docs_by_id:
                _emit(neighbor_docs_by_id[next_id])
        except ValueError:
            pass

    response = "Here are the transcript segments that related to your query:\n\n"
    prev_id = None
    for chunk in out:
        vid = int(chunk["id"])
        if prev_id is not None and prev_id != vid-1:
            response += "---\n"
        response += f"[{chunk['start_time']} - {chunk['end_time']}]\n{chunk['text'].strip()}\n\n"
        prev_id = vid

    return response