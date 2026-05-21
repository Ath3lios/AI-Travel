import unittest
from unittest.mock import Mock, patch

from services.itinerary import providers
from services.itinerary.runtime import DB_CONTEXT


class ProviderPlacePriorityTests(unittest.TestCase):
    def tearDown(self):
        DB_CONTEXT.set(None)

    def test_get_top_places_prefers_goong_over_catalog_db_when_goong_has_places(self):
        token = DB_CONTEXT.set(object())
        try:
            goong_result = {
                "city": "Da Nang",
                "category": "attraction",
                "places": [{"name": "Fresh Goong Place", "address": "Da Nang"}],
                "source": "goong",
            }
            db_lookup = Mock(side_effect=AssertionError("DB should not be used when Goong has results"))

            with patch.object(providers, "get_top_places_from_goong", return_value=goong_result):
                with patch.object(providers, "get_top_places_from_db", db_lookup):
                    result = providers.get_top_places("Da Nang", "attraction", 5)

            self.assertEqual(result, goong_result)
            db_lookup.assert_not_called()
        finally:
            DB_CONTEXT.reset(token)

    def test_get_top_places_uses_catalog_db_when_goong_has_no_places(self):
        token = DB_CONTEXT.set(object())
        try:
            calls = []

            def fake_goong(city, category, limit):
                calls.append("goong")
                return {"city": city, "category": category, "places": [], "source": "goong"}

            def fake_db(_db, _city, _category, _limit):
                calls.append("db")
                return [{"name": "Catalog Backup Place", "address": "Da Nang"}]

            with patch.object(providers, "get_top_places_from_goong", side_effect=fake_goong):
                with patch.object(providers, "get_top_places_from_db", side_effect=fake_db):
                    result = providers.get_top_places("Da Nang", "attraction", 5)

            self.assertEqual(calls, ["goong", "db"])
            self.assertEqual(result["source"], "catalog_db")
            self.assertEqual(result["places"][0]["name"], "Catalog Backup Place")
        finally:
            DB_CONTEXT.reset(token)


if __name__ == "__main__":
    unittest.main()
