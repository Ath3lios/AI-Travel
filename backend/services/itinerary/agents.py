import json
import re

from config import settings

from .providers import get_exchange_rate, get_top_places, get_weather_forecast, json_response
from .runtime import (
    AgentExecutor,
    ChatGoogleGenerativeAI,
    ChatPromptTemplate,
    MessagesPlaceholder,
    USE_LANGCHAIN,
    USE_NEW_SDK,
    client,
    create_tool_calling_agent,
    genai,
    genai_types,
    lc_tool,
)

TOOL_MAP = {
    "get_weather_forecast": get_weather_forecast,
    "get_top_places": get_top_places,
    "get_exchange_rate": get_exchange_rate,
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
        "description": "Tìm địa điểm nổi bật qua Goong Maps. Trả về tên, địa chỉ, rating và tọa độ lat/lng để hiển thị bản đồ.",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {"type": "string"},
                "category": {"type": "string", "enum": ["restaurant", "attraction", "hotel", "cafe", "shopping"]},
                "limit": {"type": "integer"},
            },
            "required": ["city", "category"],
        },
    },
    {
        "name": "get_exchange_rate",
        "description": "Lấy tỷ giá hối đoái. Dùng khi điểm đến dùng ngoại tệ.",
        "parameters": {
            "type": "object",
            "properties": {"from_currency": {"type": "string"}, "to_currency": {"type": "string"}},
            "required": ["from_currency", "to_currency"],
        },
    },
]


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
    raw = re.sub(r"^```json\s*", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"^```\s*", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)
    raw = raw.strip()
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    return json.loads(match.group(0) if match else raw)


def run_agent_langchain(system_prompt: str, user_prompt: str) -> dict:
    tools = get_langchain_tools()
    if not tools:
        raise RuntimeError("LangChain chưa sẵn sàng hoặc thiếu tools.")

    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=settings.gemini_api_key,
        temperature=0.7,
    )
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{input}"),
        MessagesPlaceholder("agent_scratchpad"),
    ])
    agent = create_tool_calling_agent(llm, tools, prompt)
    executor = AgentExecutor(agent=agent, tools=tools, verbose=False, max_iterations=10)
    result = executor.invoke({"input": user_prompt})
    return parse_json((result or {}).get("output", ""))


def run_agent_new_sdk(system_prompt: str, user_prompt: str) -> dict:
    tools = [genai_types.Tool(function_declarations=[genai_types.FunctionDeclaration(**item) for item in TOOL_DECLARATIONS])]
    config = genai_types.GenerateContentConfig(system_instruction=system_prompt, tools=tools, temperature=0.7)
    messages = [genai_types.Content(role="user", parts=[genai_types.Part(text=user_prompt)])]

    for _ in range(10):
        response = client.models.generate_content(model="gemini-2.5-flash", contents=messages, config=config)
        parts = response.candidates[0].content.parts
        messages.append(genai_types.Content(role="model", parts=parts))

        tool_calls = [part for part in parts if hasattr(part, "function_call") and part.function_call]
        if not tool_calls:
            raw = "\n".join(part.text for part in parts if hasattr(part, "text") and part.text).strip()
            return parse_json(raw)

        results = []
        for part in tool_calls:
            fc = part.function_call
            results.append(genai_types.Part(function_response=genai_types.FunctionResponse(name=fc.name, response={"result": execute_tool(fc.name, dict(fc.args))})))
        messages.append(genai_types.Content(role="user", parts=results))

    raise RuntimeError("Agent vượt quá 10 vòng lặp")


def run_agent_old_sdk(system_prompt: str, user_prompt: str) -> dict:
    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        system_instruction=system_prompt,
        tools=[{"function_declarations": TOOL_DECLARATIONS}],
    )
    chat = model.start_chat()
    response = chat.send_message(user_prompt)

    for _ in range(10):
        tool_calls = [part.function_call for part in response.parts if hasattr(part, "function_call") and part.function_call.name]
        if not tool_calls:
            return parse_json((response.text or "").strip())
        response = chat.send_message([
            genai.protos.Part(function_response=genai.protos.FunctionResponse(
                name=fc.name,
                response={"result": execute_tool(fc.name, dict(fc.args))},
            ))
            for fc in tool_calls
        ])

    raise RuntimeError("Agent vượt quá 10 vòng lặp")
