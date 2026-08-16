"""
Unit tests for Rental Tracker Pipeline.
Tests spatial calculations, scraper JSON-LD parsing, aggregator floorplan logic, and CLI commands.
"""

import os
import json
import tempfile
import pytest
from datetime import datetime, timezone

from pipeline.enricher import haversine_distance_miles, calculate_nearest_hazard, estimate_commute_minutes
from pipeline.scraper import extract_json_ld, parse_listing_page
from pipeline.aggregator import CampaignAggregator, save_json, load_json
from pipeline.models import Listing, GeoLocation, Annotation

def test_haversine_distance():
    # Distance between San Jose City Hall (37.3382, -121.8863) and Intel SC2 (37.3888, -121.9644)
    # Approx 5.6 - 5.8 miles
    dist = haversine_distance_miles(37.3382, -121.8863, 37.3888, -121.9644)
    assert 5.0 <= dist <= 6.5

def test_calculate_nearest_hazard():
    hazards = [
        {"name": "Site A", "lat": 37.4000, "lng": -122.0000},
        {"name": "Site B", "lat": 37.5000, "lng": -122.1000}
    ]
    # Point very close to Site A
    dist, nearest = calculate_nearest_hazard(37.4010, -122.0010, hazards)
    assert nearest is not None
    assert nearest["name"] == "Site A"
    assert dist < 0.5

def test_commute_estimation():
    # Est commute for a 5 mile trip
    est = estimate_commute_minutes(37.3382, -121.8863, 37.3888, -121.9644)
    assert "avg_min" in est
    assert "range" in est
    assert est["avg_min"] > 10
    assert "-" in est["range"]

def test_json_ld_extraction():
    html_sample = """
    <!DOCTYPE html>
    <html>
    <head>
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "ApartmentComplex",
        "name": "The Grand Residences",
        "description": "Luxury units in Silicon Valley",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "100 Innovation Way",
          "addressLocality": "Sunnyvale",
          "addressRegion": "CA",
          "postalCode": "94086"
        },
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": 37.3750,
          "longitude": -122.0300
        }
      }
      </script>
    </head>
    <body>
      <p>1 bed 1 bath for $3,200/mo. Washer & dryer in home. Air conditioning.</p>
    </body>
    </html>
    """
    parsed = parse_listing_page("https://example.com/listing/1", html=html_sample)
    assert parsed["property_name"] == "The Grand Residences"
    assert parsed["street_address"] == "100 Innovation Way"
    assert parsed["city"] == "Sunnyvale"
    assert parsed["zip"] == "94086"
    assert parsed["location"] == {"lat": 37.3750, "lng": -122.0300}
    assert parsed["amenities"]["laundry"] == "in-unit"
    assert parsed["amenities"]["cooling"] == "A/C"

def test_aggregator_workflow():
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create minimal campaign structure
        camp_dir = os.path.join(tmpdir, "test-camp")
        os.makedirs(os.path.join(camp_dir, "raw"), exist_ok=True)
        os.makedirs(os.path.join(camp_dir, "reference"), exist_ok=True)
        
        save_json(os.path.join(camp_dir, "campaign.json"), {
            "id": "test-camp",
            "title": "Test Campaign",
            "map": {"default_center": [37.3688, -121.996]}
        })
        save_json(os.path.join(camp_dir, "reference", "destinations.json"), [
            {"id": "work", "name": "Work", "lat": 37.3888, "lng": -121.9644}
        ])
        save_json(os.path.join(camp_dir, "reference", "hazards.json"), [
            {"name": "Hazard 1", "lat": 37.3800, "lng": -122.0000}
        ])
        save_json(os.path.join(camp_dir, "listings.json"), [])
        save_json(os.path.join(camp_dir, "annotations.json"), {})

        agg = CampaignAggregator(camp_dir)
        raw_payload = {
            "property_name": "Silicon Palms",
            "street_address": "500 Palm Dr",
            "city": "Santa Clara",
            "zip": "95054",
            "rent_min": 2850,
            "rent_max": 3100,
            "bedrooms": 1.0,
            "bathrooms": 1.0,
            "sqft": 710,
            "location": {"lat": 37.3900, "lng": -121.9700}
        }
        
        added = agg.ingest_scraped_listing(raw_payload)
        assert added["id"] == "prop_1"
        assert added["property_name"] == "Silicon Palms"
        assert added["rent_display"] == "$2,850 - $3,100"
        assert "work" in added["commute"]
        assert "superfund_mi" in added["hazard_proximity"]

        # Check that annotations record was initialized
        annotations = agg.load_annotations()
        assert "prop_1" in annotations
        assert annotations["prop_1"]["visit_status"] == "unvisited"

        # Attempt to ingest exact duplicate
        dup_attempt = agg.ingest_scraped_listing(raw_payload)
        assert dup_attempt["id"] == "prop_1"
        assert dup_attempt.get("_is_duplicate") is True
        assert len(agg.load_listings()) == 1  # Still 1 listing!
