"""
Enrichment engine: Geocoding, commute estimation, and spatial hazard proximity calculations.
"""

import math
import json
import os
import urllib.request
import urllib.parse
from typing import Dict, List, Optional, Tuple, Any

def haversine_distance_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two points in miles."""
    R = 3958.8  # Earth radius in miles
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

def calculate_nearest_hazard(origin_lat: float, origin_lng: float, hazards: List[Dict]) -> Tuple[Optional[float], Optional[Dict]]:
    """Finds the nearest hazard and distance in miles."""
    if not hazards or not origin_lat or not origin_lng:
        return None, None
    
    min_dist = float("inf")
    nearest_hazard = None
    
    for h in hazards:
        h_lat = h.get("lat")
        h_lng = h.get("lng")
        if h_lat is not None and h_lng is not None:
            d = haversine_distance_miles(origin_lat, origin_lng, h_lat, h_lng)
            if d < min_dist:
                min_dist = d
                nearest_hazard = h
                
    if min_dist != float("inf"):
        return min_dist, nearest_hazard
    return None, None

def estimate_commute_minutes(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> Dict[str, Any]:
    """
    Estimates driving commute during peak hours based on straight-line distance,
    urban road topology factor (1.35x), and Bay Area peak traffic speed (~22-28 mph).
    If a GOOGLE_MAPS_API_KEY is present in env, can call the Google Routes API.
    """
    dist_miles = haversine_distance_miles(origin_lat, origin_lng, dest_lat, dest_lng)
    
    # Check if Google Maps API key is configured
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if api_key:
        try:
            url = f"https://maps.googleapis.com/maps/api/distancematrix/json?origins={origin_lat},{origin_lng}&destinations={dest_lat},{dest_lng}&departure_time=now&traffic_model=best_guess&key={api_key}"
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                element = data["rows"][0]["elements"][0]
                if element.get("status") == "OK":
                    duration_in_traffic_sec = element.get("duration_in_traffic", {}).get("value", element["duration"]["value"])
                    avg_m = round(duration_in_traffic_sec / 60)
                    low_m = max(5, round(avg_m * 0.75))
                    high_m = round(avg_m * 1.45)
                    return {
                        "avg_min": avg_m,
                        "range": f"{low_m}-{high_m}"
                    }
        except Exception:
            pass  # Fall back to heuristic estimator
            
    # Empirical Bay Area rush hour travel model
    driving_dist = dist_miles * 1.35
    # Average rush-hour urban speed ~ 22mph, plus 3 min fixed traffic light delay
    avg_mins = round((driving_dist / 22.0) * 60 + 3)
    avg_mins = max(5, avg_mins)
    
    low_bound = max(4, round(avg_mins * 0.7))
    high_bound = round(avg_mins * 1.5)
    
    return {
        "avg_min": avg_mins,
        "range": f"{low_bound}-{high_bound}"
    }

def geocode_address(address: str) -> Optional[Tuple[float, float]]:
    """
    Geocodes an address using OpenStreetMap Nominatim (free, zero API key required)
    with fallback to Google Geocoding API if key configured.
    """
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if api_key:
        try:
            params = urllib.parse.urlencode({"address": address, "key": api_key})
            url = f"https://maps.googleapis.com/maps/api/geocode/json?{params}"
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("status") == "OK" and data.get("results"):
                    loc = data["results"][0]["geometry"]["location"]
                    return float(loc["lat"]), float(loc["lng"])
        except Exception:
            pass
            
    try:
        # Nominatim free fallback
        params = urllib.parse.urlencode({"q": address, "format": "json", "limit": 1})
        url = f"https://nominatim.openstreetmap.org/search?{params}"
        req = urllib.request.Request(url, headers={"User-Agent": "RentalTrackerRelocationBot/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data and len(data) > 0:
                return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception:
        pass
        
    return None
