"""
Write File skill — writes content to the outputs directory.
"""

import os
from pathlib import Path

OUTPUTS_DIR = Path(os.environ.get("NEURAL_DATA_DIR", os.path.expanduser("~/neural-agent"))) / "outputs"

SKILL_INFO = {
    "name": "write_file",
    "description": "Write content to a file in the agent's output directory",
    "schema": {"filename": "string", "content": "string"},
    "enabled": True,
}


def run(params: dict) -> str:
    filename = params.get("filename", "")
    content = params.get("content", "")

    if not filename:
        return "Error: No filename provided"
    if not content:
        return "Error: No content provided"

    # Sanitize filename — no path traversal
    safe_name = Path(filename).name
    if not safe_name:
        return "Error: Invalid filename"

    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    filepath = OUTPUTS_DIR / safe_name
    filepath.write_text(content, encoding="utf-8")

    return f"File written: {filepath} ({len(content)} chars)"
