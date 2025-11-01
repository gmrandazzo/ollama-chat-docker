import os
import json
import requests
from typing import List, Dict, Any
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from services.brave_search import perform_brave_search

router = APIRouter()
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")

class Message(BaseModel):
    role: str = Field(..., description="Role of the message sender, e.g. 'user' or 'system'")
    content: str = Field(..., description="Content of the message")

class RagChatRequest(BaseModel):
    model: str = Field(..., description="The language model to use, e.g. 'llama2'")
    userQuery: str = Field(..., description="User's query to be sent for RAG processing")
    messages: List[Message] = Field(..., description="List of message history for context")

@router.post("/rag-chat", response_class=StreamingResponse, summary="Chat with Retrieval-Augmented Generation",
             description="Send a user query with contextual message history, "
                         "uses Brave Search API to augment context, then streams AI response from Ollama.")
async def rag_chat(request: RagChatRequest):
    """
    Handle a RAG chat request.

    - **model**: Language model name to use.
    - **userQuery**: User's query string.
    - **messages**: List of previous messages constituting the conversation history.

    Returns a streaming response with the AI-generated completion, informed by web search.
    """
    try:
        model = request.model
        messages = request.messages
        user_query = request.userQuery

        # Retrieve search context using Brave API
        context_str = perform_brave_search(user_query)
        system_prompt_content = f"""You are a helpful AI assistant. Use the provided context below to answer.
If insufficient, clearly say when you use general knowledge.
--- Context ---
{context_str}
---
"""

        ollama_messages = [{"role": "system", "content": system_prompt_content}] + [m.dict() for m in messages]

        async def generate_ollama_stream():
            try:
                with requests.post(
                    f"{OLLAMA_HOST}/api/chat",
                    json={"model": model, "messages": ollama_messages, "stream": True},
                    stream=True
                ) as resp:
                    resp.raise_for_status()
                    for chunk in resp.iter_content(chunk_size=None):
                        yield chunk
            except Exception as e:
                yield json.dumps({"error": str(e)}).encode("utf-8") + b"\n"

        return StreamingResponse(generate_ollama_stream(), media_type="application/x-ndjson")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")
