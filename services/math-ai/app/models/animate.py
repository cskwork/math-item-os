"""Manim animation pipeline request/response models."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class AnimateRequest(BaseModel):
    """Animation generation request."""

    latex: str = Field(..., description="LaTeX math expression to animate")
    animation_style: Literal["step_by_step", "transform", "graph"] = Field(
        ..., description="Animation style"
    )
    duration_hint: int | None = Field(
        None, description="Desired duration in seconds"
    )


class AnimateResponse(BaseModel):
    """Animation generation response."""

    success: bool = Field(..., description="Whether animation generation succeeded")
    manim_code: str | None = Field(None, description="Generated Manim Python code")
    summary: str | None = Field(None, description="Text summary of the animation")
    error: str | None = Field(None, description="Error message on failure")
