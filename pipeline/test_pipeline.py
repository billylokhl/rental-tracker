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

def test_rent_fallback_regex():
    """Comma-formatted rents must match the fallback; truncated prefixes of larger numbers must not."""
    html = "<html><body><p>1 bed 1 bath. Rent: $2,500/mo. Sold nearby for $1000000.</p></body></html>"
    parsed = parse_listing_page("https://example.com/listing/2", html=html)
    assert parsed["rent_min"] == 2500
    assert parsed["rent_max"] == 2500

def test_parse_bedrooms():
    from pipeline.aggregator import parse_bedrooms
    assert parse_bedrooms(0) == 0.0        # studio stays 0
    assert parse_bedrooms("2") == 2.0
    assert parse_bedrooms(None) == 1.0     # missing defaults
    assert parse_bedrooms("") == 1.0
    assert parse_bedrooms("Studio") == 1.0 # unparseable falls back instead of crashing

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

def test_refresh_protection():
    with tempfile.TemporaryDirectory() as tmpdir:
        camp_dir = os.path.join(tmpdir, "test-camp")
        os.makedirs(os.path.join(camp_dir, "raw"), exist_ok=True)
        os.makedirs(os.path.join(camp_dir, "reference"), exist_ok=True)

        save_json(os.path.join(camp_dir, "campaign.json"), {"id": "test-camp", "title": "Test", "map": {}})
        save_json(os.path.join(camp_dir, "reference", "destinations.json"), [])
        save_json(os.path.join(camp_dir, "reference", "hazards.json"), [])
        
        # Initial listing with manual override in annotations
        save_json(os.path.join(camp_dir, "listings.json"), [{
            "id": "prop_1",
            "title": "500 Palm Dr (Unit 101)",
            "property_name": "Silicon Palms",
            "street_address": "500 Palm Dr",
            "city": "Santa Clara",
            "zip": "95054",
            "rent_min": 2500,
            "rent_max": 2500,
            "rent_display": "$2,500",
            "sqft": 700,
            "available_date": "Sep 1",
            "url": "https://example.com/listing/1"
        }])
        
        # User manually edited rent to $2,500
        save_json(os.path.join(camp_dir, "annotations.json"), {
            "prop_1": {
                "custom_overrides": {
                    "rent_min": 2500,
                    "rent_display": "$2,500"
                }
            }
        })

        agg = CampaignAggregator(camp_dir)

        # Upstream returns new price $3,200
        mock_raw = {
            "url": "https://example.com/listing/1",
            "rent_min": 3200,
            "rent_max": 3200,
            "available_date": "Available Now",
            "sqft": 750
        }

        # Run the REAL refresh path with the scraper mocked out
        from unittest.mock import patch
        with patch("pipeline.scraper.parse_listing_page", return_value=mock_raw):
            agg.refresh_all_listings()

        item = agg.load_listings()[0]
        assert item["rent_min"] == 2500  # Protected!
        assert item["available_date"] == "Available Now"  # Updated!
        assert item["sqft"] == 750  # Updated (not overridden)

def test_studio_not_duplicate_of_one_bed():
    """A studio (0 bedrooms) at the same address as a 1-bed must not be treated as a duplicate."""
    with tempfile.TemporaryDirectory() as tmpdir:
        camp_dir = os.path.join(tmpdir, "test-camp")
        os.makedirs(os.path.join(camp_dir, "raw"), exist_ok=True)
        os.makedirs(os.path.join(camp_dir, "reference"), exist_ok=True)
        save_json(os.path.join(camp_dir, "campaign.json"), {"id": "test-camp", "title": "Test", "map": {}})
        save_json(os.path.join(camp_dir, "reference", "destinations.json"), [])
        save_json(os.path.join(camp_dir, "reference", "hazards.json"), [])
        save_json(os.path.join(camp_dir, "listings.json"), [])
        save_json(os.path.join(camp_dir, "annotations.json"), {})

        agg = CampaignAggregator(camp_dir)
        one_bed = {
            "property_name": "Main St Flats",
            "street_address": "100 Main St",
            "city": "San Jose",
            "rent_min": 2800,
            "bedrooms": 1.0,
            "location": {"lat": 37.33, "lng": -121.88}
        }
        studio = dict(one_bed, bedrooms=0, rent_min=2400)

        first = agg.ingest_scraped_listing(one_bed)
        second = agg.ingest_scraped_listing(studio)
        assert second["id"] != first["id"]
        assert second.get("_is_duplicate") is not True
        assert len(agg.load_listings()) == 2

def test_data_validator():
    from pipeline.validator import validate_url, validate_geo_bounds, validate_campaign_dataset

    # 1. URL validation tests
    assert validate_url("https://www.zillow.com/homedetails/1101-S-Main-St-APT-419-Milpitas-CA-95035/82963912_zpid/")[0] is True
    assert validate_url("https://www.zillow.com/apartments/san-jose-ca/the-standard-(ca)/CkBhfG/")[0] is True
    assert validate_url("https://www.zillow.com/homes/1101+S+Main+St_rb/")[0] is False  # Generic search stub
    assert validate_url("")[0] is False

    # 2. Geographic bounding box tests (South Bay)
    # Valid Milpitas coordinates
    assert validate_geo_bounds(37.4141, -121.9028)[0] is True
    # Invalid Astoria, NY coordinates (Cross-state redirect protection)
    is_valid, err_msg = validate_geo_bounds(40.7648, -73.9235)
    assert is_valid is False
    assert "Latitude 40.7648 is out of campaign bounds" in err_msg

    # 3. Duplicate address + unit detection
    mock_listings = [
        {
            "id": "prop_1",
            "street_address": "1101 S Main St",
            "city": "Milpitas",
            "unit_number": "419",
            "url": "https://www.zillow.com/homedetails/1101-S-Main-St-APT-419-Milpitas-CA-95035/82963912_zpid/",
            "location": {"lat": 37.4141, "lng": -121.9028}
        },
        {
            "id": "prop_2",
            "street_address": "1101 S Main St",
            "city": "Milpitas",
            "unit_number": "419",  # Duplicate unit!
            "url": "https://www.zillow.com/homedetails/1101-S-Main-St-APT-419-Milpitas-CA-95035/82963912_zpid/",
            "location": {"lat": 37.4141, "lng": -121.9028}
        }
    ]
    is_dataset_valid, errors = validate_campaign_dataset(mock_listings)
    assert is_dataset_valid is False
    assert any("Duplicate listing detected" in e for e in errors)


def test_rent_display_sanitization():
    with tempfile.TemporaryDirectory() as tmpdir:
        camp_dir = os.path.join(tmpdir, "campaigns", "test-camp")
        os.makedirs(os.path.join(camp_dir, "reference"), exist_ok=True)
        save_json(os.path.join(camp_dir, "campaign.json"), {"id": "test-camp", "title": "Test", "map": {}})
        save_json(os.path.join(camp_dir, "reference", "destinations.json"), [])
        save_json(os.path.join(camp_dir, "reference", "hazards.json"), [])
        save_json(os.path.join(camp_dir, "listings.json"), [])
        save_json(os.path.join(camp_dir, "annotations.json"), {})

        agg = CampaignAggregator(camp_dir)
        
        # Test 1: Corrupted prefix ',950'
        item1 = agg.enrich_listing({
            "id": "prop_1",
            "rent_min": 2950,
            "rent_max": 2950,
            "rent_display": ",950",
            "location": {"lat": 37.33, "lng": -121.88}
        })
        assert item1["rent_display"] == "$2,950"

        # Test 2: Missing dollar sign '3019'
        item2 = agg.enrich_listing({
            "id": "prop_2",
            "rent_min": 3019,
            "rent_max": 3019,
            "rent_display": "3019",
            "location": {"lat": 37.33, "lng": -121.88}
        })
        assert item2["rent_display"] == "$3,019"

        # Test 3: Range
        item3 = agg.enrich_listing({
            "id": "prop_3",
            "rent_min": 3000,
            "rent_max": 3500,
            "rent_display": "",
            "location": {"lat": 37.33, "lng": -121.88}
        })
        assert item3["rent_display"] == "$3,000 - $3,500"

def test_multi_unit_refresh_protection():
    """Verify that multi-unit properties (like Epic) do not have their studio/2bd bedroom/sqft/rent overwritten by building-level scrapes."""
    with tempfile.TemporaryDirectory() as tmpdir:
        camp_dir = os.path.join(tmpdir, "campaigns", "test-camp")
        os.makedirs(os.path.join(camp_dir, "raw"), exist_ok=True)
        os.makedirs(os.path.join(camp_dir, "reference"), exist_ok=True)
        save_json(os.path.join(camp_dir, "campaign.json"), {"id": "test-camp", "title": "Test", "map": {}})
        save_json(os.path.join(camp_dir, "reference", "destinations.json"), [])
        save_json(os.path.join(camp_dir, "reference", "hazards.json"), [])
        
        # 1 Studio unit (565 sqft, $3,017) and 1 2-Bed unit (1044 sqft, $4,139) sharing the same building URL
        url = "https://www.zillow.com/apartments/san-jose-ca/epic/5Xn9bZ/"
        listings = [
            {
                "id": "prop_10",
                "title": "Epic (Studio, Unit 1-360)",
                "unit_number": "Unit 1-360",
                "bedrooms": 0,
                "bathrooms": 1.0,
                "sqft": 565,
                "rent_min": 3017,
                "rent_display": "$3,017",
                "url": url
            },
            {
                "id": "prop_17",
                "title": "Epic (2 Bed, Unit 2-213)",
                "unit_number": "Unit 2-213",
                "bedrooms": 2.0,
                "bathrooms": 2.0,
                "sqft": 1044,
                "rent_min": 4139,
                "rent_display": "$4,139",
                "url": url
            }
        ]
        save_json(os.path.join(camp_dir, "listings.json"), listings)
        save_json(os.path.join(camp_dir, "annotations.json"), {})

        agg = CampaignAggregator(camp_dir)

        # Mock top-level building scrape that returns default 1bd/1ba $3,200
        mock_raw_scrape = {
            "url": url,
            "property_name": "Epic",
            "bedrooms": 1.0,
            "bathrooms": 1.0,
            "sqft": 739,
            "rent_min": 3200,
            "units": []  # No unit match returned
        }
        
        # Mock scraper output in refresh
        agg.scraper_fetch = lambda u: mock_raw_scrape
        
        # Run refresh
        from unittest.mock import patch
        with patch("pipeline.scraper.parse_listing_page", return_value=mock_raw_scrape):
            stats = agg.refresh_all_listings()

        refreshed = agg.load_listings()
        unit_studio = next(l for l in refreshed if l["id"] == "prop_10")
        unit_2bed = next(l for l in refreshed if l["id"] == "prop_17")

        # Studio must remain 0 bedrooms, 565 sqft, $3,017
        assert unit_studio["bedrooms"] == 0
        assert unit_studio["sqft"] == 565
        assert unit_studio["rent_min"] == 3017

        # 2-Bed must remain 2.0 bedrooms, 1044 sqft, $4,139
        assert unit_2bed["bedrooms"] == 2.0
        assert unit_2bed["sqft"] == 1044
        assert unit_2bed["rent_min"] == 4139

