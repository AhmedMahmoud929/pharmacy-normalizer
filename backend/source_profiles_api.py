"""Source profile API — teach, test, and manage discovery sources."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from tools.discovery.extractors.registry import extract_product, search_products
from tools.discovery.platform_detect import (
    default_extract_config,
    default_search_config,
    detect_platform,
    domain_from_url,
    infer_search_config,
    suggest_dom_elements,
)
from tools.discovery.html_fetcher import fetch_html
from tools.source_profiles_repo import (
    delete_profile,
    get_profile,
    list_profiles,
    update_test_status,
    upsert_profile,
)

router = APIRouter(prefix="/api/sources", tags=["sources"])


class PreviewRequest(BaseModel):
    url: str


class ProfileSaveRequest(BaseModel):
    domain: str
    display_name: Optional[str] = None
    platform: Optional[str] = None
    enabled: bool = True
    priority: int = 100
    search_config: Optional[Dict[str, Any]] = None
    extract_config: Optional[Dict[str, Any]] = None
    sample_url: Optional[str] = None
    created_by: Optional[str] = None


class TestRequest(BaseModel):
    url: str
    query: Optional[str] = None


def _domain_from_body(url: str) -> str:
    parsed = urlparse(url if url.startswith("http") else f"https://{url}")
    host = (parsed.netloc or "").lower()
    if host.startswith("www."):
        host = host[4:]
    if not host:
        raise HTTPException(status_code=400, detail="Invalid URL")
    return host


@router.get("/profiles")
async def get_profiles(enabled_only: bool = False):
    return {"profiles": list_profiles(enabled_only=enabled_only)}


@router.get("/profiles/{domain}")
async def get_profile_by_domain(domain: str):
    profile = get_profile(domain)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.post("/profiles/preview")
async def preview_profile(req: PreviewRequest):
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    domain = domain_from_url(url)
    html = fetch_html(url if url.startswith("http") else f"https://{url}")
    platform = detect_platform(html, url)
    search_config = infer_search_config(html, url, domain, platform)
    extract_config = default_extract_config(platform)
    available_elements = suggest_dom_elements(html)

    extracted_preview = None
    try:
        profile = {
            "domain": domain,
            "platform": platform,
            "search_config": search_config,
            "extract_config": extract_config,
        }
        product = extract_product(url, profile)
        extracted_preview = product.to_dict()
    except Exception as exc:
        extracted_preview = {"error": str(exc)}

    return {
        "domain": domain,
        "platform": platform,
        "suggested_search_config": search_config,
        "suggested_extract_config": extract_config,
        "available_elements": available_elements,
        "extracted_preview": extracted_preview,
    }


@router.post("/profiles")
async def save_profile(req: ProfileSaveRequest):
    if not req.domain:
        raise HTTPException(status_code=400, detail="domain is required")
    if req.domain == "chefaa.com" and req.platform and req.platform != "chefaa":
        raise HTTPException(status_code=400, detail="Cannot change Chefaa built-in platform")

    existing = get_profile(req.domain)
    profile = {
        "domain": req.domain,
        "display_name": req.display_name or req.domain,
        "platform": req.platform or (existing or {}).get("platform") or "custom",
        "enabled": req.enabled,
        "priority": req.priority,
        "search_config": req.search_config or (existing or {}).get("search_config") or {},
        "extract_config": req.extract_config or (existing or {}).get("extract_config") or {},
        "sample_url": req.sample_url or (existing or {}).get("sample_url"),
        "created_by": req.created_by or (existing or {}).get("created_by"),
    }
    saved = upsert_profile(profile)
    return saved


@router.put("/profiles/{domain}")
async def update_profile(domain: str, req: ProfileSaveRequest):
    req.domain = domain
    return await save_profile(req)


@router.delete("/profiles/{domain}")
async def remove_profile(domain: str):
    if domain == "chefaa.com":
        raise HTTPException(status_code=400, detail="Cannot delete built-in Chefaa profile")
    ok = delete_profile(domain)
    if not ok:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"deleted": True, "domain": domain}


@router.post("/profiles/{domain}/test")
async def test_profile(domain: str, req: TestRequest):
    profile = get_profile(domain)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    try:
        if req.query:
            candidates = search_products(req.query, profile)
            preview = {
                "search_query": req.query,
                "candidates": [
                    {
                        "title": c.title,
                        "url": c.url,
                        "price": c.price,
                        "image_url": c.image_url,
                    }
                    for c in candidates[:10]
                ],
            }
            update_test_status(domain, "ok_search")
            return {"status": "ok", "mode": "search", "result": preview}

        product = extract_product(url, profile)
        update_test_status(domain, "ok_extract")
        return {"status": "ok", "mode": "extract", "result": product.to_dict()}
    except Exception as exc:
        update_test_status(domain, f"error: {exc}")
        raise HTTPException(status_code=422, detail=str(exc))
