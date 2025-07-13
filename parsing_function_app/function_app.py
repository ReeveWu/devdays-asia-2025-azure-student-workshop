import azure.functions as func
import json
import logging
import utils

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

@app.route(route="parse_video")
def parse_video(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Received a request to parse video.')
    inputs = {}
    results = []
    try:
        req_body = req.get_json()
        if "values" in req_body:
            for value in req_body["values"]:
                record_id = value["recordId"]
                payload = value.get("data", {})
                logging.info(f"Processing record ID: {record_id} with payload: {payload}")
                if payload != {}:
                    inputs[record_id] = {
                        "name": payload.get("name", ""),
                        "content_type": payload.get("content_type", ""),
                        "blob_sas_url": f"{payload.get('blob_url', '')}{payload.get('sas_token', '')}",
                    }
                                
    except Exception as e:
        return func.HttpResponse(
            str(e),
            status_code=400
        )

    if inputs:
        for record_id, data in inputs.items():
            # Simulate processing the input data
            video_name = data['name']
            blob_sas_url = data['blob_sas_url']
            logging.info(f"Processing video: {video_name} with SAS URL: {blob_sas_url}")
            audio_stream = utils.get_audio_from_blob(blob_sas_url)
            response = utils.call_fast_transcription_service_test(audio_stream)
            segments = utils.format_transcription_response(response, video_name)
            # segments = [
            #     {
            #         'id': 0,
            #         'start_time': '00:02:40',
            #         'end_time': '00:32:00',
            #         'text': 'How do you create more capacity?',
            #         'video_name': 'test.mp4'
            #     },
            #     {
            #         'id': 1,
            #         'start_time': '00:37:20',
            #         'end_time': '01:56:00',
            #         'text': 'How do you allow our financial advisors to have better conversations and more of them?',
            #         'video_name': 'test.mp4'
            #     },
            #     {
            #         'id': 2,
            #         'start_time': '01:59:20',
            #         'end_time': '03:08:00',
            #         'text': 'What this technology does is it makes you as smart as the smartest person.',
            #         'video_name': 'test.mp4'
            #     }
            # ]
            result = {
                "recordId": record_id,
                "data": {
                    "segments": segments,
                }
            }
            results.append(result)
    
    return func.HttpResponse(
            body=json.dumps({"values": results}), 
            mimetype="application/json",
            status_code=200
        )