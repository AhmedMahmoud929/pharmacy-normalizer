"""Shared types for discovery extractors."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class UnifiedProduct:
    title_en: str
    title_ar: str = ""
    price: Optional[float] = None
    image_url: str = ""
    images: List[str] = field(default_factory=list)
    barcode: str = ""
    source_url: str = ""
    source_domain: str = ""
    brand: str = ""
    slug: str = ""
    raw: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title_en": self.title_en,
            "title_ar": self.title_ar,
            "price": self.price,
            "image_url": self.image_url,
            "images": self.images,
            "barcode": self.barcode,
            "source_url": self.source_url,
            "source_domain": self.source_domain,
            "brand": self.brand,
            "slug": self.slug,
            "raw": self.raw,
        }


@dataclass
class SearchCandidate:
    title: str
    url: str
    price: Optional[float] = None
    image_url: str = ""
    raw: Dict[str, Any] = field(default_factory=dict)
