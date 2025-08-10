import os
from azure.core.credentials import AzureKeyCredential
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import (
    SearchIndex,
    SearchField,
    SearchFieldDataType,
    VectorSearch,
    VectorSearchProfile,
    HnswAlgorithmConfiguration,
    AzureOpenAIVectorizer,
    AzureOpenAIVectorizerParameters,
)

search_endpoint = f'https://{os.getenv("SEARCH_SERVICE_NAME")}.search.windows.net'
search_client_key = os.getenv("SEARCH_CLIENT_KEY")
azure_openai_resource_url = os.getenv("AZURE_OPENAI_RESOURCE_URL")
azure_openai_api_key = os.getenv("AZURE_OPENAI_API_KEY")
azure_openai_embedding_model_name = os.getenv("AZURE_OPENAI_EMBEDDING_MODEL_NAME")
azure_openai_embedding_deployment_name  = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME")
azure_openai_embedding_dimensions = int(os.getenv("AZURE_OPENAI_EMBEDDING_DIMENSIONS", 3072))
index_name = os.getenv("SEARCH_INDEX_NAME")

index_client = SearchIndexClient(
    endpoint=search_endpoint,
    credential=AzureKeyCredential(search_client_key)
)

fields = [
    SearchField(name="chunk_id", type=SearchFieldDataType.String, key=True, filterable=True, analyzer_name="keyword"),
    SearchField(name="id", type=SearchFieldDataType.String, searchable=True, sortable=True, filterable=True),
    SearchField(name="video_name", type=SearchFieldDataType.String, searchable=True, filterable=True),
    SearchField(name="text", type=SearchFieldDataType.String, searchable=True),
    SearchField(name="start_time", type=SearchFieldDataType.String, filterable=True, sortable=True),
    SearchField(name="end_time", type=SearchFieldDataType.String, filterable=True, sortable=True),
    SearchField(
        name="vector",
        type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
        searchable=True,
        vector_search_dimensions=azure_openai_embedding_dimensions,
        vector_search_profile_name="vector-profile"
    )
]
vector_search = VectorSearch(
    profiles=[
        VectorSearchProfile(
            name="vector-profile", 
            algorithm_configuration_name="hnsw-config",
            vectorizer_name="azure-openai-vectorizer",
        )
    ],
    algorithms=[
        HnswAlgorithmConfiguration(name="hnsw-config")
    ],
    vectorizers=[
        AzureOpenAIVectorizer(
            vectorizer_name="azure-openai-vectorizer",
            parameters=AzureOpenAIVectorizerParameters(
                resource_url=azure_openai_resource_url,
                deployment_name=azure_openai_embedding_deployment_name,
                model_name=azure_openai_embedding_model_name,
                api_key=azure_openai_api_key,
            )
        )
    ]
)

index = SearchIndex(name=index_name, fields=fields, vector_search=vector_search)
index_client.create_or_update_index(index)
print("✅ Index with vector field created")