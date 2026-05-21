import unittest
from unittest.mock import patch

from services.itinerary import agents


class AgentModelRetryTests(unittest.TestCase):
    def test_retryable_primary_failure_retries_same_model_before_fallback(self):
        calls = []

        def runner(_system_prompt, _user_prompt, model_name):
            calls.append(model_name)
            if len(calls) == 1:
                raise RuntimeError("503 Service Unavailable")
            return {"days": [{"day": 1, "schedule": []}]}

        with patch.object(agents, "model_list", return_value=("primary", "fallback")):
            result = agents.run_with_model_retries("system", "user", runner, "Test")

        self.assertEqual(result["days"][0]["day"], 1)
        self.assertEqual(calls, ["primary", "primary"])

    def test_fallback_model_gets_two_attempts_after_primary_fails_twice(self):
        calls = []

        def runner(_system_prompt, _user_prompt, model_name):
            calls.append(model_name)
            if calls != ["primary", "primary", "fallback", "fallback"]:
                raise RuntimeError("503 Service Unavailable")
            return {"days": [{"day": 2, "schedule": []}]}

        with patch.object(agents, "model_list", return_value=("primary", "fallback")):
            result = agents.run_with_model_retries("system", "user", runner, "Test")

        self.assertEqual(result["days"][0]["day"], 2)
        self.assertEqual(calls, ["primary", "primary", "fallback", "fallback"])

    def test_raises_last_error_after_both_models_fail_twice(self):
        calls = []

        def runner(_system_prompt, _user_prompt, model_name):
            calls.append(model_name)
            raise RuntimeError(f"503 Service Unavailable from {model_name}")

        with patch.object(agents, "model_list", return_value=("primary", "fallback")):
            with self.assertRaisesRegex(RuntimeError, "fallback"):
                agents.run_with_model_retries("system", "user", runner, "Test")

        self.assertEqual(calls, ["primary", "primary", "fallback", "fallback"])

    def test_non_retryable_programming_error_is_not_retried(self):
        calls = []

        def runner(_system_prompt, _user_prompt, model_name):
            calls.append(model_name)
            raise TypeError("bad call signature")

        with patch.object(agents, "model_list", return_value=("primary", "fallback")):
            with self.assertRaisesRegex(TypeError, "bad call signature"):
                agents.run_with_model_retries("system", "user", runner, "Test")

        self.assertEqual(calls, ["primary"])


if __name__ == "__main__":
    unittest.main()
