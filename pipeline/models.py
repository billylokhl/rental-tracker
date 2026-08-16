"""
Data schemas and domain models for Rental Tracker.
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone

@dataclass
class GeoLocation:
    lat: float
    lng: float

@dataclass
class UnitItem:
    unit_id: str
    bedrooms: float
    bathrooms: float
    sqft: Optional[int]
    rent: Optional[int]
    available_date: Optional[str] = None
    price_basis: Optional[str] = None

@dataclass
class CommuteEstimate:
    avg_min: Optional[int] = None
    range: Optional[str] = None

@dataclass
class Appliances:
    dishwasher: bool = False
    microwave: bool = False
    oven: bool = False
    refrigerator: bool = False

@dataclass
class UtilitiesIncluded:
    water: bool = False
    garbage: bool = False
    electricity: bool = False
    gas: bool = False
    internet: bool = False
    gardening: bool = False

@dataclass
class Amenities:
    laundry: str = "unspecified"
    laundry_note: str = ""
    parking: str = "unspecified"
    heating: str = ""
    cooling: str = ""
    fenced_yard: bool = False
    appliances: Appliances = field(default_factory=Appliances)
    utilities_included: UtilitiesIncluded = field(default_factory=UtilitiesIncluded)

@dataclass
class PetPolicy:
    allowed: bool = False
    note: str = ""
    deposit: str = ""
    monthly_fee: str = ""

@dataclass
class ApplicationInfo:
    method: str = ""
    fee: str = ""

@dataclass
class Listing:
    id: str
    title: str
    property_name: str
    street_address: str
    city: str
    zip: str
    source: str
    type: str
    status: str
    rent_display: str
    rent_min: Optional[int]
    rent_max: Optional[int]
    bedrooms: float
    bathrooms: float
    sqft: Optional[int]
    lease_length: str
    location: GeoLocation
    commute: Dict[str, CommuteEstimate] = field(default_factory=dict)
    hazard_proximity: Dict[str, Optional[float]] = field(default_factory=dict)
    amenities: Amenities = field(default_factory=Amenities)
    pets: PetPolicy = field(default_factory=PetPolicy)
    application: ApplicationInfo = field(default_factory=ApplicationInfo)
    units: List[UnitItem] = field(default_factory=list)
    available_date: Optional[str] = "Available Now"
    deposit: Optional[str] = ""
    unit_number: Optional[str] = ""
    parent_id: Optional[str] = None
    url: Optional[str] = None
    photos: List[str] = field(default_factory=list)
    cover_photo: Optional[str] = ""
    media_album_url: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class Annotation:
    rating: str = ""
    visit_status: str = "unvisited" # unvisited, interested, scheduled, visited, applied, rejected
    highlights: str = ""
    lowlights: str = ""
    user_notes: str = ""
    media_album_url: str = ""
    custom_tags: List[str] = field(default_factory=list)
    custom_overrides: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
