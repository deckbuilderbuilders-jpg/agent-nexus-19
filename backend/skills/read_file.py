"""
Read File skill — reads a local file for analysis.
Restricted to the Nexus data directory for safety.
"""

import os
from pathlib import Path

DATA_DIR = Path(
    os.environ.get("NEXUS_DATA_DIR")
    or os.environ.get("NEURAL_DATA_DIR", os.path.expanduser("~/Nexus"))
)

SKILL_INFO = {
    "name": "read_file",
    "description": "Read a file from the agent's data directory for analysis",
    "schema": {"filepath": "string"},
    "enabled": True,
}


def run(params: dict) -> str:
    filepath = params.get("filepath", "")
    if not filepath:
        return "Error: No filepath provided"

    # Resolve and check it's within DATA_DIR
    target = (DATA_DIR / filepath).resolve()
    if not str(target).startswith(str(DATA_DIR.resolve())):
        return "Error: Access denied — can only read files within the agent data directory"

    if not target.exists():
        return f"Error: File not found: {target}"

    if not target.is_file():
        return f"Error: Not a file: {target}"

    # Size check
    size = target.stat().st_size
    if size > 500_000:
        return f"Error: File too large ({size} bytes). Max 500KB."

    try:
        content = target.read_text(encoding="utf-8", errors="replace")
        return f"File: {target.name} ({len(content)} chars)\n\n{content[:5000]}"
    except Exception as e:
        return f"Error reading file: {e}"
