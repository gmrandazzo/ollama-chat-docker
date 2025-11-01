import pytest
from services.brave_search import perform_brave_search

def test_brave_search_returns_string(monkeypatch):
    # Mock requests.get
    def mock_get(*args, **kwargs):
        class MockResponse:
            def raise_for_status(self): pass
            def json(self):
                return {
                    "web": {
                        "results": [
                            {"snippet": "Mocked result one."},
                            {"snippet": "Mocked result two."}
                        ]
                    }
                }
        return MockResponse()
    
    import services.brave_search as bs
    monkeypatch.setattr(bs.requests, "get", mock_get)

    result = perform_brave_search("test query")
    assert isinstance(result, str)
    assert "Mocked result one" in result
    assert "Mocked result two" in result

def test_brave_search_handles_error(monkeypatch):
    def mock_get(*args, **kwargs):
        raise Exception("Network error")
    import services.brave_search as bs
    monkeypatch.setattr(bs.requests, "get", mock_get)

    result = perform_brave_search("test error case")
    assert "Error" in result or "error" in result


