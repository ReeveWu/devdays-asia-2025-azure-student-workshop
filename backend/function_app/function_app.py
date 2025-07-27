import azure.functions as func
import json
import logging
import utils

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

@app.route(route="index_video")
def index_video(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Received a request to index video.')
    try:
        req_body = req.get_json()
        video_name = req_body.get("video_name", "")
        if not video_name:
            return func.HttpResponse(
                "Missing 'video_name' in request body.",
                status_code=400
            )

        audio_stream = utils.get_blob_from_connection_string(video_name)
        response = utils.call_fast_transcription_service_test(audio_stream)
        segments = utils.format_transcription_response(response, video_name)
        utils.insert_index_documents(segments)

        return func.HttpResponse(
            body=json.dumps({"status": "Video indexed successfully"}),
            mimetype="application/json",
            status_code=200
        )
    
    except Exception as e:
        logging.error(f"Error indexing video: {str(e)}")
        return func.HttpResponse(
            str(e),
            status_code=500
        )


@app.route(route="delete_video")
def delete_video(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Received a request to delete video documents.')
    try:
        req_body = req.get_json()
        target_name = req_body.get("video_name", "")
        if not target_name:
            return func.HttpResponse(
                "Missing 'video_name' in request body.",
                status_code=400
            )
        
        utils.delete_documents_by_video_name(target_name)
        return func.HttpResponse(
            body=json.dumps({"status": "Documents deleted successfully"}),
            mimetype="application/json",
            status_code=200
        )
    except Exception as e:
        logging.error(f"Error deleting video documents: {str(e)}")
        return func.HttpResponse(
            str(e),
            status_code=500
        )