"""
Web Search skill — uses DuckDuckGo HTML search (no API key needed).
Falls back to a simple urllib approach if duckduckgo-search isn't installed.
"""

import urllib.request
import urllib.parse
import re

SKILL_INFO = {
    "name": "web_search",
    "description": "Search the web for current information using DuckDuckGo",
    "schema": {"query": "string"},
    "enabled": True,
}


def run(params: dict) -> str:
    query = params.get("query", "")
    if not query:
        return "Error: No query provided"

    try:
        # Try duckduckgo-search library first
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=5))
        if not results:
            return "No results found."
        output = []
        for r in results:
            output.append(f"**{r.get('title', 'Untitled')}**\n{r.get('body', '')}\nURL: {r.get('href', '')}")
        return "\n\n".join(output)
    except ImportError:
        pass

    # Fallback: scrape DuckDuckGo HTML
    try:
        encoded = urllib.parse.urlencode({"q": query})
        url = f"https://html.duckduckgo.com/html/?{encoded}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", errors="replace")

        # Extract result snippets
        snippets = re.findall(r'class="result__snippet">(.*?)</a>', html, re.DOTALL)
        titles = re.findall(r'class="result__a"[^>]*>(.*?)</a>', html, re.DOTALL)

        if not snippets:
            return "No results found."

        output = []
        for i, (title, snippet) in enumerate(zip(titles[:5], snippets[:5])):
            clean_title = re.sub(r'<[^>]+>', '', title).strip()
            clean_snippet = re.sub(r'<[^>]+>', '', snippet).strip()
            output.append(f"**{clean_title}**\n{clean_snippet}")
        return "\n\n".join(output)
    except Exception as e:
        return f"Search failed: {e}"
