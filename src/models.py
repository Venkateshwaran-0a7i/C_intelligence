"""
Pydantic models for the product extraction JSON schema.
Every extracted field carries a value and a confidence level.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ConfidenceField(BaseModel):
    """A single extracted field with an associated confidence score."""
    value: str = "Not Available"
    confidence: str = "Low"  # High | Medium | Low


class ProductExtractionResult(BaseModel):
    """Full extraction result matching the required JSON output schema."""

    # ── Product Identity ────────────────────────────────────────────────────
    product_name: ConfidenceField = Field(default_factory=ConfidenceField)
    brand: ConfidenceField = Field(default_factory=ConfidenceField)
    category: ConfidenceField = Field(default_factory=ConfidenceField)
    subcategory: ConfidenceField = Field(default_factory=ConfidenceField)
    variant: ConfidenceField = Field(default_factory=ConfidenceField)
    sku: ConfidenceField = Field(default_factory=ConfidenceField)
    package_type: ConfidenceField = Field(default_factory=ConfidenceField)

    # ── Packaging ───────────────────────────────────────────────────────────
    net_quantity: ConfidenceField = Field(default_factory=ConfidenceField)
    grammage: ConfidenceField = Field(default_factory=ConfidenceField)
    serving_size: ConfidenceField = Field(default_factory=ConfidenceField)

    # ── Claims ──────────────────────────────────────────────────────────────
    front_claims: List[str] = Field(default_factory=list)
    back_claims: List[str] = Field(default_factory=list)

    # ── Content ─────────────────────────────────────────────────────────────
    ingredients: List[str] = Field(default_factory=list)
    allergens: List[str] = Field(default_factory=list)

    # ── Nutrition ───────────────────────────────────────────────────────────
    nutrition: Dict[str, Any] = Field(default_factory=dict)

    # ── Manufacturer ────────────────────────────────────────────────────────
    manufacturer: Dict[str, Any] = Field(default_factory=dict)

    # ── Manufacturing ───────────────────────────────────────────────────────
    manufacturing_information: Dict[str, Any] = Field(default_factory=dict)

    # ── Instructions ────────────────────────────────────────────────────────
    storage_instructions: str = "Not Available"
    preparation_instructions: str = "Not Available"
    usage_instructions: str = "Not Available"

    # ── Certifications / Warnings ───────────────────────────────────────────
    certifications: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)

    # ── Package Contents ────────────────────────────────────────────────────
    package_contents: List[str] = Field(default_factory=list)

    # ── Commercial ──────────────────────────────────────────────────────────
    barcode: str = "Not Available"
    mrp: str = "Not Available"

    # ── Summary ─────────────────────────────────────────────────────────────
    summary: str = ""
