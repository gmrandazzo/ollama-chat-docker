import os
import requests

BRAVE_API_KEY = os.getenv("BRAVE_API_KEY")

def perform_brave_search(query: str, count: int = 10):
    if not BRAVE_API_KEY:
        print("BRAVE_API_KEY not set. Returning fallback text.")
        return "No internet search results available."

    try:
        headers = {"X-Subscription-Token": BRAVE_API_KEY}
        params = {"q": query, "limit": count}
        response = requests.get(
            "https://api.search.brave.com/res/v1/web/search",
            headers=headers,
            params=params
        )
        response.raise_for_status()
        data = response.json()
        print(data)
        if "web" in data and "results" in data["web"]:
            snippets = []
            for i, res in enumerate(data["web"]["results"]):
                snippet = res.get("snippet")
                if snippet:
                    snippets.append(f"Source {i+1}: {snippet}")
            return "\n\n".join(snippets) if snippets else "No results found from Brave."
        return "No search results found."
    except requests.RequestException as e:
        print(f"Error during Brave search: {e}")
        return "Error fetching results from Brave API."

