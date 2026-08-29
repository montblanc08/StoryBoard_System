"""
AI & Automation Provider Contract Engine for FrameForge OS.
Master Specification V1.0 Implementation Ready.
Default status: Fully disabled, 0 network dependencies, contract-only interface.
"""
from __future__ import annotations

import abc
import uuid
from typing import Any


class BaseAIProvider(abc.ABC):
    """Abstract Provider Interface for future automation extensions."""

    @property
    @abc.abstractmethod
    def name(self) -> str:
        """Unique provider identifier."""
        pass

    @property
    @abc.abstractmethod
    def supported_capabilities(self) -> list[str]:
        """List of supported capabilities (e.g. screenplay_breakdown, voice_alignment)."""
        pass

    @abc.abstractmethod
    async def execute_job(
        self,
        capability: str,
        parameters: dict[str, Any],
        input_asset_ids: list[str] | None = None
    ) -> dict[str, Any]:
        """Execute capability job and return standard contract output."""
        pass

    @abc.abstractmethod
    async def cancel_job(self, job_id: str) -> bool:
        """Cancel running job."""
        pass


class MockAIProvider(BaseAIProvider):
    """Mock Provider implementation for contract testing and zero-dependency offline environments."""

    @property
    def name(self) -> str:
        return "mock-provider-offline"

    @property
    def supported_capabilities(self) -> list[str]:
        return [
            "screenplay_breakdown",
            "voice_alignment",
            "speech_to_text",
            "image_search",
            "storyboard_generation",
            "image_edit",
            "video_previsualization",
            "copyright_scan"
        ]

    async def execute_job(
        self,
        capability: str,
        parameters: dict[str, Any],
        input_asset_ids: list[str] | None = None
    ) -> dict[str, Any]:
        if capability not in self.supported_capabilities:
            raise ValueError(f"Capability '{capability}' not supported by {self.name}")

        job_id = str(uuid.uuid4())

        # Return mock results according to capability schema
        if capability == "screenplay_breakdown":
            mock_shots = [
                {"number": "001", "name": "开篇全景", "description": "城市天际线航拍", "method": "live"},
                {"number": "002", "name": "大堂中景", "description": "客户走入大厅", "method": "live"}
            ]
            return {
                "job_id": job_id,
                "status": "completed",
                "progress": 1.0,
                "result": {"extracted_shots": mock_shots}
            }

        if capability == "voice_alignment":
            return {
                "job_id": job_id,
                "status": "completed",
                "progress": 1.0,
                "result": {"aligned_duration_frames": 150, "drift_ms": 0}
            }

        return {
            "job_id": job_id,
            "status": "completed",
            "progress": 1.0,
            "result": {"message": f"Capability {capability} executed in mock offline mode."}
        }

    async def cancel_job(self, job_id: str) -> bool:
        return True


class AIProviderRegistry:
    """Central registry for AI capability providers. Defaults to AI disabled."""

    def __init__(self):
        self._providers: dict[str, BaseAIProvider] = {}
        self._is_enabled = False  # Disabled by default per spec

    def register(self, provider: BaseAIProvider) -> None:
        self._providers[provider.name] = provider

    def get(self, name: str) -> BaseAIProvider | None:
        return self._providers.get(name)

    @property
    def is_enabled(self) -> bool:
        return self._is_enabled

    def enable(self) -> None:
        self._is_enabled = True

    def disable(self) -> None:
        self._is_enabled = False


# Global Registry Instance
provider_registry = AIProviderRegistry()
provider_registry.register(MockAIProvider())
