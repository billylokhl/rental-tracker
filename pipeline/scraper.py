"""
Resilient multi-strategy rental listing scraper for Zillow and apartment listing pages.
Extracts JSON-LD, Next.js __NEXT_DATA__, and DOM metadata.
"""

import json
import re
import urllib.request
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

def fetch_url_html(url: str) -> str:
    """Fetches raw HTML from a listing URL with realistic browser headers."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "max-age=0",
        "Upgrade-Insecure-Requests": "1"
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=12) as resp:
        return resp.read().decode("utf-8", errors="ignore")

def extract_json_ld(html: str) -> List[Dict[str, Any]]:
    """Extracts all application/ld+json blocks from the HTML."""
    matches = re.findall(r'<script[^>]*type=[\'"]application/ld\+json[\'"][^>]*>(.*?)</script>', html, re.DOTALL | re.IGNORECASE)
    results = []
    for m in matches:
        try:
            data = json.loads(m.strip())
            if isinstance(data, list):
                results.extend(data)
            elif isinstance(data, dict):
                results.append(data)
        except Exception:
            continue
    return results

def extract_next_data(html: str) -> Optional[Dict[str, Any]]:
    """Extracts Next.js __NEXT_DATA__ payload if present."""
    match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL | re.IGNORECASE)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except Exception:
            pass
    return None

def parse_listing_page(url: str, html: Optional[str] = None) -> Dict[str, Any]:
    """
    Parses a rental listing URL or raw HTML into structured property data.
    """
    if not html:
        try:
            html = fetch_url_html(url)
        except Exception as e:
            return {
                "error": f"Failed to fetch URL: {str(e)}",
                "url": url,
                "scraped_at": datetime.now(timezone.utc).isoformat()
            }

    json_lds = extract_json_ld(html)
    next_data = extract_next_data(html)

    property_name = ""
    street_address = ""
    city = ""
    state = "CA"
    zip_code = ""
    rent_min = None
    rent_max = None
    bedrooms = 1.0
    bathrooms = 1.0
    sqft = None
    description = ""
    photos = []
    units = []
    
    # 1. Parse JSON-LD if available
    for item in json_lds:
        item_type = item.get("@type", "")
        if item_type in ["ApartmentComplex", "Residence", "SingleFamilyResidence", "Apartment", "RealEstateListing"]:
            property_name = item.get("name", property_name)
            description = item.get("description", description)
            if "image" in item:
                imgs = item["image"]
                if isinstance(imgs, list):
                    photos.extend(imgs)
                elif isinstance(imgs, str):
                    photos.append(imgs)
            
            addr = item.get("address", {})
            if isinstance(addr, dict):
                street_address = addr.get("streetAddress", street_address)
                city = addr.get("addressLocality", city)
                state = addr.get("addressRegion", state)
                zip_code = addr.get("postalCode", zip_code)
                
            geo = item.get("geo", {})
            lat = geo.get("latitude")
            lng = geo.get("longitude")

    # 2. Extract from Title or Meta if missing
    if not street_address or not property_name:
        title_match = re.search(r"<title>(.*?)</title>", html, re.IGNORECASE)
        if title_match:
            t = title_match.group(1).split("|")[0].split(" - ")[0].strip()
            if not property_name:
                property_name = t
            if not street_address:
                street_address = t

    # 3. Rent extraction fallback
    if rent_min is None:
        rent_matches = re.findall(r"\$([1-9][0-9]{2,3}(?:,[0-9]{3})?)\s*(?:/mo|-|\+)?", html)
        if rent_matches:
            rents = [int(r.replace(",", "")) for r in rent_matches if 1000 <= int(r.replace(",", "")) <= 15000]
            if rents:
                rent_min = min(rents)
                rent_max = max(rents)

    # 4. Amenities heuristic extraction from HTML
    text_lower = html.lower()
    in_unit_laundry = ("in-unit" in text_lower or "washer & dryer in home" in text_lower or "in-home washer" in text_lower or "w/d in unit" in text_lower)
    has_ac = ("air conditioning" in text_lower or "a/c" in text_lower or "central air" in text_lower or "cooling" in text_lower)
    has_dishwasher = "dishwasher" in text_lower
    has_microwave = "microwave" in text_lower
    has_refrigerator = "refrigerator" in text_lower
    has_oven = ("oven" in text_lower or "range" in text_lower)
    pets_allowed = ("pets allowed" in text_lower or "dogs allowed" in text_lower or "cats allowed" in text_lower or "pet friendly" in text_lower)

    return {
        "url": url,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "property_name": property_name or "Apartment Community",
        "street_address": street_address,
        "city": city,
        "state": state,
        "zip": zip_code,
        "rent_min": rent_min,
        "rent_max": rent_max,
        "bedrooms": bedrooms,
        "bathrooms": bathrooms,
        "sqft": sqft,
        "photos": photos[:5],
        "amenities": {
            "laundry": "in-unit" if in_unit_laundry else "shared",
            "cooling": "A/C" if has_ac else "",
            "appliances": {
                "dishwasher": has_dishwasher,
                "microwave": has_microwave,
                "oven": has_oven,
                "refrigerator": has_refrigerator
            }
        },
        "pets": {
            "allowed": pets_allowed
        },
        "units": units,
        "raw_json_ld_count": len(json_lds)
    }
