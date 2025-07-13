import io, os, time, json, requests
from azure.storage.blob import BlobClient

ai_service_name = os.getenv('AI_FOUNDRY_NAME')
ai_service_subscription_key = os.getenv('AI_SERVICE_SUBSCRIPTION_KEY')


def mstotime(milliseconds):
    hours = milliseconds // 3_600_000
    minutes = (milliseconds % 3_600_000) // 60_000
    seconds = (milliseconds % 60_000) // 1_000
    return f"{int(hours):02}:{int(minutes):02}:{int(seconds):02}"


def get_audio_from_blob(sas_url: str) -> io.BytesIO:
    blob_client = BlobClient.from_blob_url(sas_url)
    download = blob_client.download_blob()
    
    audio_stream = io.BytesIO()
    download.readinto(audio_stream)
    audio_stream.seek(0)
    
    return audio_stream


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
    response = requests.post(url, headers=headers, files=files)
    
    if response.status_code != 200:
        raise Exception(f"Failed to call the service. Status code: {response.status_code}, Message: {response.text}")
    
    print(f"Transcription service call took {time.time() - start_t:.2f} seconds")
    return response.json()


def format_transcription_response(response, video_name):
    segments = []
    for idx, phrase in enumerate(response['phrases']):
        start_time = mstotime(phrase['offsetMilliseconds'])
        end_time = mstotime(phrase['offsetMilliseconds'] + phrase['durationMilliseconds'])
        text = phrase['text']
        segments.append({
            # 'chunk_id': f"{video_name}_{idx}",
            'id': idx,
            'start_time': start_time,
            'end_time': end_time,
            'text': text,
            'video_name': video_name
        })
    return segments