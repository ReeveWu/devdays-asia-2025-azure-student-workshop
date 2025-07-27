from azure.search.documents import SearchClient
from azure.core.credentials import AzureKeyCredential
from azure.search.documents.models import Vector
from openai import AzureOpenAI

# === Configuration ===
search_service_name = "aisearch-sc"
index_name = "vidio-index"
search_api_key = "YOUR_SEARCH_API_KEY"
search_endpoint = f"https://{search_service_name}.search.windows.net"

# Azure OpenAI embedding and chatting model
openai_api_key = "YOUR_OPENAI_API_KEY"
embedding_endpoint = "https://azureoai-sc.openai.azure.com/openai/deployments/text-embedding-3-large/embeddings?api-version=2023-05-15"
embedding_model = "text-embedding-3-large"
embedding_version = "2023-05-15"
chat_endpoint = "https://azureoai-sc.openai.azure.com/openai/deployments/gpt-4.1-mini/chat/completions?api-version=2025-01-01-preview"
chat_model = "gpt-4.1-mini"
chat_version = "2025-01-01-preview"

# === Initialize clients ===
search_client = SearchClient(endpoint=search_endpoint, index_name=index_name, credential=AzureKeyCredential(search_api_key))
embedding_client = AzureOpenAI(api_version=embedding_version, endpoint=embedding_endpoint, credential=AzureKeyCredential(openai_api_key))
chat_client = AzureOpenAI(api_version=chat_version, azure_endpoint=chat_endpoint, api_key=openai_api_key)


# === Helper: Get embedding for query ===
def get_query_embedding(query):
    response = embedding_client.embeddings.create(
        input=query,
        model=embedding_model
    )
    return response.data[0].embedding


# === Main RAG Function ===
def ask_with_rag(question, top_k=5):
    print(f"User Question: {question}")
    
    # Step 1: Embed the question
    query_vector = get_query_embedding(question)

    # Step 2: Hybrid search (vector + keyword)
    results = search_client.search(
        search_text=question,  # still used in hybrid search
        vectors=[
            Vector(
                value=query_vector,
                k=top_k,
                fields="vector"
            )
        ],
        top=top_k,
        vector_search_options={"profile": "vector-profile"},
        query_type="semantic",
        semantic_configuration_name="semantic-config",
    )

    # Step 3: Extract top-k context
    context_chunks = []
    for result in results:
        video = result.get("video_name", "Unknown video")
        start = result.get("start_time", "??")
        end = result.get("end_time", "??")
        text = result.get("text", "")
        context_chunks.append(f"[{video} | {start} - {end}]\n{text}")

    context = "\n\n".join(context_chunks)

    # Step 4: Prompt LLM
    prompt = f"""
                You are an AI assistant helping answer questions from video transcriptions.

                Use the following video segments to answer the user's question.

                Context:
                {context}

                Question:
                {question}

                Answer:
            """

    # Step 5: Generate answer using LLM
    response = chat_client.chat.completions.create(
        model=chat_model,
        messages=[
            {"role": "user", "content": prompt}
        ],
        temperature=0.3
    )

    return response.choices[0].message.content


# === Run example ===
if __name__ == "__main__":
    question = "What are the symptoms of anthracnose disease in strawberries?"
    answer = ask_with_rag(question)
    print("Generated Answer:\n", answer)
