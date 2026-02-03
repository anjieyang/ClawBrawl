#!/usr/bin/env python3
"""
测试单个模型，打印详细信息
"""

import asyncio
from openai import AsyncOpenAI
from .config import config


async def test_model_detailed(model: str, reasoning_effort: str = None):
    """详细测试单个模型"""
    client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)
    
    print(f"\n{'='*60}")
    print(f"Testing: {model}")
    print(f"Reasoning effort: {reasoning_effort or 'N/A'}")
    
    # 检测是否是 reasoning 模型
    is_reasoning_model = any(
        model.startswith(prefix)
        for prefix in ["gpt-5", "o3", "o4"]
    )
    
    print(f"Is reasoning model: {is_reasoning_model}")
    
    # 构建 API 参数
    api_kwargs = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a trading bot. Always respond in JSON format."},
            {"role": "user", "content": 'Decide long or short. Respond with JSON: {"direction": "long" or "short", "reason": "your reason", "confidence": 50-100}'},
        ],
    }
    
    # 只对非 reasoning 模型添加 response_format
    if not is_reasoning_model:
        api_kwargs["response_format"] = {"type": "json_object"}
        api_kwargs["temperature"] = 0.7
        api_kwargs["max_tokens"] = 200
    else:
        api_kwargs["max_completion_tokens"] = 4000  # 增大 token 限制
        if reasoning_effort:
            api_kwargs["reasoning_effort"] = reasoning_effort
    
    print(f"API kwargs: {list(api_kwargs.keys())}")
    
    try:
        response = await client.chat.completions.create(**api_kwargs)
        
        print(f"\nResponse object keys: {dir(response)[:10]}...")
        print(f"Choices count: {len(response.choices)}")
        
        if response.choices:
            choice = response.choices[0]
            print(f"Choice finish_reason: {choice.finish_reason}")
            print(f"Message role: {choice.message.role}")
            print(f"Message content type: {type(choice.message.content)}")
            print(f"Message content length: {len(choice.message.content) if choice.message.content else 0}")
            print(f"Message content: {choice.message.content[:200] if choice.message.content else 'EMPTY'}")
        
        print("\n✅ API call succeeded")
        
    except Exception as e:
        print(f"\n❌ Error: {type(e).__name__}: {e}")


async def main():
    # 测试有问题的模型
    models_to_test = [
        ("gpt-5-nano", None),
        ("gpt-5-mini", None),
        ("gpt-5", "high"),
        ("gpt-4.1-mini", None),  # 对照组
    ]
    
    for model, reasoning in models_to_test:
        await test_model_detailed(model, reasoning)


if __name__ == "__main__":
    asyncio.run(main())
