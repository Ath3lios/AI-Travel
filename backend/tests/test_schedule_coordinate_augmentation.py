import unittest
from unittest.mock import patch

from services.itinerary.fallbacks import augment_schedule_coordinates


class ScheduleCoordinateAugmentationTests(unittest.TestCase):
    def test_prefers_geocoded_coordinates_before_offline_fallback(self):
        itinerary = {
            "days": [
                {
                    "day": 1,
                    "schedule": [
                        {
                            "place": "Bun cha muc",
                            "address": "Bai Chay, Ha Long, Quang Ninh",
                            "lat": 0.0,
                            "lng": 0.0,
                        },
                    ],
                }
            ]
        }

        with patch(
            "services.itinerary.fallbacks.forward_geocode",
            return_value={
                "results": [
                    {
                        "formatted_address": "Bai Chay, Ha Long, Quang Ninh",
                        "lat": 20.96012,
                        "lng": 107.04731,
                    }
                ]
            },
        ) as geocode:
            result = augment_schedule_coordinates(itinerary, "Quang Ninh")

        item = result["days"][0]["schedule"][0]
        self.assertEqual(item["lat"], 20.96012)
        self.assertEqual(item["lng"], 107.04731)
        self.assertEqual(item["coordinate_source"], "geocode")
        geocode.assert_called_once()

    def test_adds_offline_coordinates_when_geocode_fails(self):
        itinerary = {
            "days": [
                {
                    "day": 1,
                    "schedule": [
                        {"place": "Unknown place", "address": "Ha Long", "lat": 0.0, "lng": 0.0},
                    ],
                }
            ]
        }

        with patch("services.itinerary.fallbacks.forward_geocode", side_effect=RuntimeError("no api key")):
            result = augment_schedule_coordinates(itinerary, "Ha Long")

        item = result["days"][0]["schedule"][0]
        self.assertNotEqual(item["lat"], 0.0)
        self.assertNotEqual(item["lng"], 0.0)
        self.assertEqual(item["coordinate_source"], "offline_fallback")

    def test_keeps_existing_valid_coordinates(self):
        itinerary = {
            "days": [
                {
                    "day": 1,
                    "schedule": [
                        {"place": "Known place", "lat": 20.91, "lng": 107.18},
                    ],
                }
            ]
        }

        result = augment_schedule_coordinates(itinerary, "Ha Long")
        item = result["days"][0]["schedule"][0]

        self.assertEqual(item["lat"], 20.91)
        self.assertEqual(item["lng"], 107.18)
        self.assertNotIn("coordinate_source", item)


if __name__ == "__main__":
    unittest.main()
