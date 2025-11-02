import os
import requests
import logging
from typing import List

BRAVE_API_KEY = os.getenv("BRAVE_API_KEY")

def perform_brave_search(query: str, count: int = 10) -> str:
    if not BRAVE_API_KEY:
        logging.error("BRAVE_API_KEY not set. Returning fallback text.")
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
        if "web" in data and "results" in data["web"]:
            snippets: List[str] = []
            for i, res in enumerate(data["web"]["results"]):
                snippet = res.get("description")
                if snippet:
                    snippets.append(f"Source {i+1}: {snippet}")
            
                extra_snippet = res.get("extra_snippet")
                if extra_snippet:
                    snippets.append(f"Source {i+1}: {extra_snippet}")
            print(snippets)
            return "\n\n".join(snippets) if snippets else "No results found from Brave."
        return "No search results found."
    except requests.RequestException as e:
        logging.error(f"Error during Brave search: {e}")
        return "Error fetching results from Brave API."
