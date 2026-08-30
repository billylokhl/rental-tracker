"""
Campaign context: loads the active campaign and provides region bounds, state
hints, and geocoding parameters to every pipeline module from a single source.
"""

import json
import os
from typing import Any, Dict, Optional

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAMPAIGNS_DIR = os.path.join(BASE_DIR, "campaigns")
ACTIVE_CAMPAIGN_FILE = os.path.join(BASE_DIR, "active_campaign.json")


def get_active_campaign_id() -> str:
    """Reads the active campaign id from the committed config file."""
    if os.path.exists(ACTIVE_CAMPAIGN_FILE):
        with open(ACTIVE_CAMPAIGN_FILE, "r") as f:
            data = json.load(f)
        return data.get("active_campaign", "")
    return ""


class CampaignContext:
    """Immutable view of a campaign's configuration, threaded through the pipeline."""

    def __init__(self, campaign_dir: str):
        config_path = os.path.join(campaign_dir, "campaign.json")
        if not os.path.exists(config_path):
            raise FileNotFoundError(f"Campaign config not found: {config_path}")
        with open(config_path, "r") as f:
            self._config: Dict[str, Any] = json.load(f)
        self.campaign_dir = campaign_dir
        self.id = self._config.get("id", "")

    @property
    def region_bounds(self) -> Dict[str, Any]:
        """The canonical geographic boundary for this campaign.

        Falls back to a center±0.5° box derived from the map center when
        ``region_bounds`` is absent (backward compat with older configs).
        """
        explicit = self._config.get("region_bounds")
        if explicit:
            return explicit
        center = self._config.get("map", {}).get("default_center", [37.3688, -121.996])
        return {
            "min_lat": center[0] - 0.5,
            "max_lat": center[0] + 0.5,
            "min_lng": center[1] - 0.5,
            "max_lng": center[1] + 0.5,
            "allowed_states": ["CA", "California"],
            "default_state": "CA",
            "default_region": "",
        }

    @property
    def nominatim_viewbox(self) -> Optional[str]:
        return self.region_bounds.get("nominatim_viewbox")

    @property
    def default_state(self) -> str:
        return self.region_bounds.get("default_state", "CA")

    @property
    def default_region(self) -> str:
        return self.region_bounds.get("default_region", "")

    @property
    def allowed_states(self):
        return self.region_bounds.get("allowed_states", ["CA", "California"])

    @property
    def geo_bbox(self) -> Dict[str, Any]:
        """Returns the bounds dict in the format validate_geo_bounds expects."""
        rb = self.region_bounds
        return {
            "min_lat": rb["min_lat"],
            "max_lat": rb["max_lat"],
            "min_lng": rb["min_lng"],
            "max_lng": rb["max_lng"],
            "allowed_states": self.allowed_states,
        }

    @property
    def map_center(self):
        return self._config.get("map", {}).get("default_center", [37.3688, -121.996])

    @property
    def config(self) -> Dict[str, Any]:
        return self._config

    @classmethod
    def from_active(cls) -> "CampaignContext":
        """Loads the campaign marked as active in active_campaign.json."""
        cid = get_active_campaign_id()
        if not cid:
            raise RuntimeError(
                "No active campaign configured. "
                "Set one in active_campaign.json or pass --campaign explicitly."
            )
        cdir = os.path.join(CAMPAIGNS_DIR, cid)
        if not os.path.exists(cdir):
            raise FileNotFoundError(f"Active campaign '{cid}' not found at {cdir}")
        return cls(cdir)

    @classmethod
    def for_campaign(cls, campaign_name: str) -> "CampaignContext":
        """Loads a named campaign by slug."""
        cdir = os.path.join(CAMPAIGNS_DIR, campaign_name)
        if not os.path.exists(cdir):
            raise FileNotFoundError(f"Campaign '{campaign_name}' not found at {cdir}")
        return cls(cdir)
