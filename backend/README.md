# MyChat Backend (FastAPI + Brave + Ollama)

A lightweight Retrieval-Augmented Generation (RAG) backend that integrates Brave Search API for internet retrieval and Ollama for local LLM inference.  
Built with FastAPI for easy deployment and modularity.

---

## Features
- FastAPI endpoint `/api/rag-chat` for chat-based RAG.
- Integrates Brave Search API for contextual retrieval.
- Streams model responses from Ollama.
- Modular code structure with clear separation of services and endpoints.
- Simple `.env` configuration.
