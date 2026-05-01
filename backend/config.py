from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    gemini_api_key: str = ""
    secret_key: str = "secret"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    admin_emails: str = ""

    # Tool API keys (để trống = dùng mock data)
    openweather_api_key: str = ""
    goong_api_key: str = ""
    exchangerate_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_fallback_model: str = "gemini-2.5-flash-lite"

    class Config:
        env_file = ".env"

settings = Settings()
