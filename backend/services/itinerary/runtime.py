import requests
from contextvars import ContextVar

from config import settings
from sqlalchemy.orm import Session

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_core.tools import tool as lc_tool
    from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
    from langchain.agents import create_tool_calling_agent, AgentExecutor
    USE_LANGCHAIN = True
except Exception:
    ChatGoogleGenerativeAI = None
    lc_tool = None
    ChatPromptTemplate = None
    MessagesPlaceholder = None
    create_tool_calling_agent = None
    AgentExecutor = None
    USE_LANGCHAIN = False

try:
    from google import genai
    from google.genai import types as genai_types
    USE_NEW_SDK = True
except ImportError:
    import google.generativeai as genai
    genai_types = None
    USE_NEW_SDK = False

if USE_NEW_SDK:
    client = genai.Client(api_key=settings.gemini_api_key)
else:
    genai.configure(api_key=settings.gemini_api_key)
    client = None

OPENWEATHER_KEY = getattr(settings, "openweather_api_key", "")
GOONG_KEY = getattr(settings, "goong_api_key", "")
DEFAULT_TIMEOUT = 5
GOONG_TIMEOUT = 6

HTTP = requests.Session()
DB_CONTEXT: ContextVar[Session | None] = ContextVar("db_context", default=None)
