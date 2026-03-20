"""
Base skill interface. All skills in this directory must expose:
- SKILL_INFO: dict with name, description, schema, enabled
- run(params: dict) -> str: execute the skill
"""

from abc import ABC, abstractmethod


class Skill(ABC):
    """Base class for skills. Subclasses should implement run()."""

    name: str = ""
    description: str = ""
    schema: dict = {}

    @abstractmethod
    def run(self, params: dict) -> str:
        """Execute the skill and return a result string."""
        pass
