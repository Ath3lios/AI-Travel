import json
import re

from config import settings

from .providers import get_exchange_rate, get_top_places, get_weather_forecast, json_response
from .runtime import (
    AgentExecutor,
    ChatGoogleGenerativeAI,
    ChatPromptTemplate,
    MessagesPlaceholder,
    GEMINI_MODELS,
    USE_LANGCHAIN,
    USE_NEW_SDK,
    client,
    create_tool_calling_agent,
    genai,
    genai_types,
    lc_tool,
)

RETRYABLE_MODEL_ERROR_TOKENS = (
    "500",
    "502",
    "503",
    "504",
    "429",
    "403",
    "quota",
    "resource_exhausted",
    "rate limit",
    "rate_limit",
    "too many requests",
    "permission_denied",
    "permission denied",
    "forbidden",
    "model not found",
    "not found for api version",
    "timeout",
    "deadline exceeded",
    "connection reset",
    "connection aborted",
    "connection error",
    "temporarily unavailable",
    "unavailable",
    "service unavailable",
    "overloaded",
    "internal error",
    "jsondecodeerror",
    "expecting value",
    "empty output",
    "empty itinerary",
)

TOOL_MAP = {
    "get_weather_forecast": get_weather_forecast,
    "get_top_places":       get_top_places,
    "get_exchange_rate":    get_exchange_rate,
}

TOOL_DECLARATIONS = [
    {
        "name": "get_weather_forecast",
        "description": "Lấy dự báo thời tiết cho một thành phố trong N ngày.",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "Tên thành phố, ví dụ: 'Da Nang'"},
                "days": {"type": "integer", "description": "Số ngày dự báo (tối đa 7)"},
            },
            "required": ["city", "days"],
        },
    },
    {
        "name": "get_top_places",
        "description": (
            "Tìm địa điểm nổi bật qua Goong Maps. "
            "Trả về tên, địa chỉ, rating và tọa độ lat/lng để hiển thị bản đồ."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "city":     {"type": "string"},
                "category": {"type": "string",
                             "enum": ["restaurant", "attraction", "hotel", "cafe", "shopping"]},
                "limit":    {"type": "integer"},
            },
            "required": ["city", "category"],
        },
    },
    {
        "name": "get_exchange_rate",
        "description": "Lấy tỷ giá hối đoái. Dùng khi điểm đến dùng ngoại tệ.",
        "parameters": {
            "type": "object",
            "properties": {
                "from_currency": {"type": "string"},
                "to_currency":   {"type": "string"},
            },
            "required": ["from_currency", "to_currency"],
        },
    },
]


def is_model_access_error(error: Exception) -> bool:
    return is_retryable_model_error(error)


def is_retryable_model_error(error: Exception) -> bool:
    if isinstance(error, (TypeError, AttributeError, ImportError, ModuleNotFoundError)):
        return False
    text = repr(error).lower()
    return any(token in text for token in RETRYABLE_MODEL_ERROR_TOKENS)


def model_list() -> tuple[str, ...]:
    return GEMINI_MODELS or ("gemini-2.5-flash", "gemini-2.5-flash-lite")


def run_with_model_retries(system_prompt: str, user_prompt: str, runner, runner_label: str) -> dict:
    last_error = None
    for model_name in model_list():
        for attempt in range(1, 3):
            try:
                print(f"Gemini {runner_label} model: {model_name} attempt {attempt}/2")
                return runner(system_prompt, user_prompt, model_name)
            except Exception as err:
                last_error = err
                print(f"Gemini {runner_label} model failed ({model_name} attempt {attempt}/2):", repr(err))
                if not is_retryable_model_error(err):
                    raise
    raise last_error or RuntimeError(f"All Gemini {runner_label} models failed")


def execute_tool(name: str, args: dict) -> str:
    fn = TOOL_MAP.get(name)
    if not fn:
        return json_response({"error": f"Unknown tool: {name}"})
    try:
        return json_response(fn(**args), ensure_ascii=False)
    except Exception as e:
        return json_response({"error": str(e)})


def get_langchain_tools():
    if not USE_LANGCHAIN:
        return []

    @lc_tool("get_weather_forecast", description="Lấy dự báo thời tiết cho một thành phố trong N ngày.")
    def lc_weather(city: str, days: int):
        return get_weather_forecast(city=city, days=days)

    @lc_tool("get_top_places", description="Tìm địa điểm qua Goong Maps. Trả về tên, địa chỉ, rating và tọa độ lat/lng.")
    def lc_places(city: str, category: str, limit: int = 5):
        return get_top_places(city=city, category=category, limit=limit)

    @lc_tool("get_exchange_rate", description="Lấy tỷ giá hối đoái giữa hai loại tiền.")
    def lc_rate(from_currency: str, to_currency: str):
        return get_exchange_rate(from_currency=from_currency, to_currency=to_currency)

    return [lc_weather, lc_places, lc_rate]


def parse_json(raw: str) -> dict:
    # Bóc tất cả dạng code fence
    raw = re.sub(r"```json\s*", "", raw)
    raw = re.sub(r"```\s*", "", raw)
    raw = raw.strip()

    # Tìm outermost JSON object: { đầu tiên → } cuối cùng
    # rfind tránh cắt sai với JSON lồng sâu nhiều cấp
    start = raw.find("{")
    end   = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        raw = raw[start : end + 1]

    return json.loads(raw)


def run_agent_langchain_once(system_prompt: str, user_prompt: str, model_name: str) -> dict:
    tools = get_langchain_tools()
    if not tools:
        raise RuntimeError("LangChain chưa sẵn sàng hoặc thiếu tools.")

    llm = ChatGoogleGenerativeAI(
        model=model_name,
        google_api_key=settings.gemini_api_key,
        temperature=0.7,
    )
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{input}"),
        MessagesPlaceholder("agent_scratchpad"),
    ])
    agent    = create_tool_calling_agent(llm, tools, prompt)
    executor = AgentExecutor(agent=agent, tools=tools, verbose=False, max_iterations=10)
    result   = executor.invoke({"input": user_prompt})
    return parse_json((result or {}).get("output", ""))


def run_agent_langchain(system_prompt: str, user_prompt: str) -> dict:
    return run_with_model_retries(system_prompt, user_prompt, run_agent_langchain_once, "LangChain")


def run_agent_new_sdk_once(system_prompt: str, user_prompt: str, model_name: str) -> dict:
    tools  = [genai_types.Tool(function_declarations=[
        genai_types.FunctionDeclaration(**t) for t in TOOL_DECLARATIONS
    ])]
    config   = genai_types.GenerateContentConfig(
        system_instruction=system_prompt, tools=tools, temperature=0.7)
    messages = [genai_types.Content(role="user",
                parts=[genai_types.Part(text=user_prompt)])]

    for _ in range(10):
        response = client.models.generate_content(
            model=model_name, contents=messages, config=config)
        parts = response.candidates[0].content.parts
        messages.append(genai_types.Content(role="model", parts=parts))

        # Chỉ tính function_call hợp lệ (name không rỗng)
        tool_calls = [
            p for p in parts
            if hasattr(p, "function_call")
            and p.function_call
            and getattr(p.function_call, "name", None)
        ]
        if not tool_calls:
            text_parts = [
                p.text.strip()
                for p in parts
                if getattr(p, "text", None) and p.text.strip()
            ]
            return parse_json("\n".join(text_parts))

        results = []
        for p in tool_calls:
            fc = p.function_call
            results.append(genai_types.Part(
                function_response=genai_types.FunctionResponse(
                    name=fc.name,
                    response={"result": execute_tool(fc.name, dict(fc.args))},
                )
            ))
        messages.append(genai_types.Content(role="user", parts=results))

    raise RuntimeError("Agent vượt quá 10 vòng lặp")


def run_agent_new_sdk(system_prompt: str, user_prompt: str) -> dict:
    return run_with_model_retries(system_prompt, user_prompt, run_agent_new_sdk_once, "SDK")


def run_agent_old_sdk_once(system_prompt: str, user_prompt: str, model_name: str) -> dict:
    model = genai.GenerativeModel(
        model_name=model_name,
        system_instruction=system_prompt,
        tools=[{"function_declarations": TOOL_DECLARATIONS}],
    )
    chat     = model.start_chat()
    response = chat.send_message(user_prompt)

    for _ in range(10):
        # Check an toàn: function_call phải tồn tại và có name
        tool_calls = [
            p.function_call
            for p in response.parts
            if hasattr(p, "function_call")
            and p.function_call
            and getattr(p.function_call, "name", None)
        ]
        if not tool_calls:
            text = "".join(
                p.text for p in response.parts
                if hasattr(p, "text") and p.text
            ).strip()
            return parse_json(text)

        response = chat.send_message([
            genai.protos.Part(
                function_response=genai.protos.FunctionResponse(
                    name=fc.name,
                    response={"result": execute_tool(fc.name, dict(fc.args))},
                )
            )
            for fc in tool_calls
        ])

    raise RuntimeError("Agent vượt quá 10 vòng lặp")


def run_agent_old_sdk(system_prompt: str, user_prompt: str) -> dict:
    return run_with_model_retries(system_prompt, user_prompt, run_agent_old_sdk_once, "old SDK")
