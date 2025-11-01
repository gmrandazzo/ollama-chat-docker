import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_rag_chat_missing_fields():
    payload = {"model": "llama2"}  # incomplete
    response = client.post("/api/rag-chat", json=payload)
    assert response.status_code == 400
    assert "Missing" in response.json()["detail"]

def test_rag_chat_valid(monkeypatch):
    from services import brave_search

    monkeypatch.setattr(brave_search, "perform_brave_search", lambda query: "Mocked search context.")

    def mock_post(url, json=None, stream=False):
        class MockResponse:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def raise_for_status(self): pass
            def iter_content(self, chunk_size=None):
                yield b'{"message": "Mock response"}\n'
        return MockResponse()

    import requests
    monkeypatch.setattr(requests, "post", mock_post)

    payload = {
        "model": "llama2",
        "userQuery": "What is AI?",
        "messages": [{"role": "user", "content": "Explain AI"}]
    }

    response = client.post("/api/rag-chat", json=payload)
    assert response.status_code == 200
    assert "application/x-ndjson" in response.headers["content-type"]

