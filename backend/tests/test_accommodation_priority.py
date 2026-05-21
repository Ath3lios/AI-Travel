import unittest
from unittest.mock import Mock, patch

from services.itinerary import fallbacks
from services.itinerary.runtime import DB_CONTEXT


class AccommodationPriorityTests(unittest.TestCase):
    def tearDown(self):
        DB_CONTEXT.set(None)

    def test_augment_accommodation_prefers_goong_over_catalog_db(self):
        token = DB_CONTEXT.set(object())
        try:
            db_lookup = Mock(side_effect=AssertionError("DB should not be used when Goong has hotel results"))
            goong_result = {
                "places": [
                    {
                        "name": "Fresh Goong Hotel",
                        "address": "Da Nang Beach",
                        "lat": 16.1,
                        "lng": 108.2,
                    }
                ]
            }

            with patch.object(fallbacks, "get_top_places_from_goong", return_value=goong_result):
                with patch.object(fallbacks, "get_top_places_from_db", db_lookup):
                    itinerary = fallbacks.augment_accommodation_suggestions(
                        {"accommodation": []},
                        "Da Nang",
                        "3000000",
                    )

            self.assertEqual(itinerary["accommodation"][0]["name"], "Fresh Goong Hotel")
            db_lookup.assert_not_called()
        finally:
            DB_CONTEXT.reset(token)


if __name__ == "__main__":
    unittest.main()
