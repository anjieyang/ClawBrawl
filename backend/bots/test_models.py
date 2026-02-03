#!/usr/bin/env python3
"""
测试所有模型配置是否能正常调用
"""

import asyncio
import json
from openai import AsyncOpenAI

from .config import config
from .personalities import PERSONALITIES, ModelConfig

# 收集所有唯一的模型配置
def get_unique_model_configs() -> list[tuple[str, ModelConfig]]:
    """获取所有唯一的模型配置"""
    seen = set()
    configs = []
    
    for p in PERSONALITIES:
        cfg = p.model_config
        # 创建唯一标识
        key = (cfg.model, cfg.reasoning_effort, cfg.temperature)
        if key not in seen:
            seen.add(key)
            configs.append((p.name, cfg))
    
    return configs


async def test_model(name: str, cfg: ModelConfig) -> tuple[bool, str]:
    """测试单个模型配置"""
    client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)
    
    # 检测是否是 reasoning 模型
    is_reasoning_model = any(
        cfg.model.startswith(prefix)
        for prefix in ["gpt-5", "o3", "o4"]
    )
    
    # 构建 API 参数
    api_kwargs = {
        "model": cfg.model,
        "messages": [
            {"role": "system", "content": "You are a test bot. Respond with JSON."},
            {"role": "user", "content": 'Respond with: {"test": "ok", "direction": "long", "reason": "test reason", "confidence": 50}'},
        ],
        "response_format": {"type": "json_object"},
    }
    
    if is_reasoning_model:
        api_kwargs["max_completion_tokens"] = cfg.max_tokens  # 使用配置的值 (4000)
        if cfg.reasoning_effort:
            api_kwargs["reasoning_effort"] = cfg.reasoning_effort
    else:
        api_kwargs["temperature"] = cfg.temperature
        api_kwargs["max_tokens"] = 300  # 非 reasoning 模型不需要那么多
    
    try:
        response = await client.chat.completions.create(**api_kwargs)
        content = response.choices[0].message.content
        result = json.loads(content)
        
        # 验证返回内容
        if "direction" in result and "reason" in result:
            return True, f"OK - {result.get('reason', '')[:30]}"
        else:
            return False, f"Missing fields: {content[:50]}"
            
    except Exception as e:
        return False, str(e)[:100]


async def run_all_tests():
    """运行所有测试"""
    print("🧪 Testing all model configurations...")
    print("=" * 70)
    
    configs = get_unique_model_configs()
    
    results = []
    for name, cfg in configs:
        print(f"\n📍 Testing: {cfg.model}")
        print(f"   Personality: {name}")
        print(f"   Reasoning effort: {cfg.reasoning_effort or 'N/A'}")
        print(f"   Temperature: {cfg.temperature}")
        
        success, message = await test_model(name, cfg)
        results.append((cfg.model, success, message))
        
        if success:
            print(f"   ✅ {message}")
        else:
            print(f"   ❌ {message}")
    
    print("\n" + "=" * 70)
    print("📊 Summary:")
    
    passed = sum(1 for _, s, _ in results if s)
    failed = sum(1 for _, s, _ in results if not s)
    
    print(f"   Passed: {passed}")
    print(f"   Failed: {failed}")
    
    if failed > 0:
        print("\n❌ Failed models:")
        for model, success, msg in results:
            if not success:
                print(f"   - {model}: {msg}")
    
    return failed == 0


def main():
    if not config.OPENAI_API_KEY:
        print("❌ OPENAI_API_KEY not set")
        return
    
    success = asyncio.run(run_all_tests())
    
    if success:
        print("\n✅ All models working! Ready to start bot runner.")
    else:
        print("\n⚠️ Some models failed. Fix before starting bot runner.")


if __name__ == "__main__":
    main()
