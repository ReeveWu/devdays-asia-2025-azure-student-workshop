# devdays-asia-2025-azure-student-workshop

## Project Overview

This repository contains the code and resources for the DevDays Asia 2025 student workshop, focusing on building AI applications using Azure services. The workshop covers various topics, including Azure OpenAI, Azure Cognitive Search, and more.

## Azure Pre-requisites

- Subscription
- AI foundry project
- Search Service (Free or Standard tier)
- Azure OpenAI (with `text-embedding-3-large` model deployed)
- Storage account (with a container named `videos`)
- Function App (Flex Consumption plan with Python runtime)

## System Architecture (Indexing Pipeline)

![System Architecture](./asset/indexing_pipeline.png)

## Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone git@github.com:ReeveWu/devdays-asia-2025-azure-student-workshop.git
   cd devdays-asia-2025-student-workshop
   ```
2. **Create a Python virtual environment**:
   ```bash
    python -m venv .venv
    source .venv/bin/activate  # On Windows use: .venv\Scripts\activate
   ```

## Create Parsing Function App

- Navigate to the `parsing_function_app` directory:
  ```bash
  cd parsing_function_app
  ```
- Set up the environment variables in Azure Function App (Refer to `.env.template`):

  - `AI_FOUNDRY_NAME`: Name of the AI Foundry project.
  - `AI_SERVICE_SUBSCRIPTION_KEY`: Subscription key for the AI service.

- Deploy the Function App (e.g., using Azure CLI or Azure VS Code extension).

## Create Indexing Pipeline

- Navigate to the `create_indexing_pipeline` directory:
  ```bash
  cd create_indexing_pipeline
  ```
- Install the required packages:
  ```bash
  pip install -r requirements.txt
  ```
- Create a `.env` file based on the `.env.template` and fill in the required values:
  ```bash
  cp .env.template .env
  ```
- Ensure you have the necessary Azure credentials set up in the `.env` file.
- Run the Jupyter notebook `create_aisearch.ipynb` to create the indexing pipeline.

## Next Steps

- Upload videos to the `videos` container in your Azure Storage account.
- Trigger the indexing pipeline to process the videos and create searchable content by running the AI Search Indexer.
