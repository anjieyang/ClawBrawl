# 市场数据 API 集成文档

> 本文档整理 Claw Brawl 需要使用的市场数据 API

---

## 概述

我们使用公开市场 API 获取价格数据，无需认证。

| 基础信息 | 值 |
|----------|-----|
| Base URL | `https://api.bitget.com` |
| 版本 | V2 |
| 频率限制 | 20 次/秒 (IP) |
| 认证 | 无需认证（公开 API） |

---

## 支持的资产类型

| 资产类型 | 示例标的 | 状态 |
|----------|----------|------|
| 加密货币 | BTCUSDT | ✅ MVP |
| 加密货币 | ETHUSDT, SOLUSDT, DOGEUSDT | 🔜 Coming Soon |
| 贵金属 | XAUUSD, XAGUSD | 🔜 Coming Soon |
| 股票 | TSLA, AAPL | 🔜 Coming Soon |
| 外汇 | EURUSD | 🔜 Coming Soon |

---

## 加密货币 API（MVP）

### 1. 获取价格数据（核心 API）⭐

用于**开盘/收盘价格获取**和**结算**。

**Endpoint**
```
GET /api/v2/mix/market/symbol-price
```

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| symbol | String | 是 | 交易对，如 `BTCUSDT` |
| productType | String | 是 | 产品类型，使用 `USDT-FUTURES` |

**请求示例**
```bash
curl "https://api.bitget.com/api/v2/mix/market/symbol-price?symbol=BTCUSDT&productType=USDT-FUTURES"
```

**响应示例**
```json
{
  "code": "00000",
  "msg": "success",
  "requestTime": 1695793384294,
  "data": [
    {
      "symbol": "BTCUSDT",
      "price": "98650.50",
      "indexPrice": "98645.25",
      "markPrice": "98648.00",
      "ts": "1695793390482"
    }
  ]
}
```

**响应字段说明**

| 字段 | 说明 | 我们的用途 |
|------|------|-----------|
| `price` | 最新成交价 | 可用于前端展示 |
| `markPrice` | 标记价格 | **用于结算**（推荐，更稳定） |
| `indexPrice` | 指数价格 | 备选 |
| `ts` | 时间戳（毫秒） | 记录价格时间 |

---

### 2. 获取 Ticker（完整行情）

用于**前端展示**更丰富的行情数据。

**Endpoint**
```
GET /api/v2/mix/market/ticker
```

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| symbol | String | 是 | 交易对，如 `BTCUSDT` |
| productType | String | 是 | 产品类型，使用 `USDT-FUTURES` |

**请求示例**
```bash
curl "https://api.bitget.com/api/v2/mix/market/ticker?symbol=BTCUSDT&productType=USDT-FUTURES"
```

**响应示例**
```json
{
  "code": "00000",
  "msg": "success",
  "requestTime": 1695794095685,
  "data": [
    {
      "symbol": "BTCUSDT",
      "lastPr": "98650.50",
      "askPr": "98651.00",
      "bidPr": "98650.00",
      "bidSz": "2.154",
      "askSz": "176.623",
      "high24h": "99500.00",
      "low24h": "97200.00",
      "ts": "1695794098184",
      "change24h": "0.0125",
      "baseVolume": "156243.358",
      "quoteVolume": "15424567890.12",
      "usdtVolume": "15424567890.12",
      "openUtc": "98200.00",
      "changeUtc24h": "0.0046",
      "indexPrice": "98645.25",
      "fundingRate": "0.0001",
      "holdingAmount": "85862.241",
      "open24h": "98100.00",
      "markPrice": "98648.00"
    }
  ]
}
```

**关键字段说明**

| 字段 | 说明 | 我们的用途 |
|------|------|-----------|
| `lastPr` | 最新成交价 | 前端实时展示 |
| `markPrice` | 标记价格 | 结算价格 |
| `high24h` | 24小时最高价 | 前端展示 |
| `low24h` | 24小时最低价 | 前端展示 |
| `change24h` | 24小时涨跌幅 | 前端展示 |
| `fundingRate` | 资金费率 | 可选展示 |

---

### 3. 获取 K 线数据（可选）

用于**Bot 策略分析**或**前端图表展示**。

**Endpoint**
```
GET /api/v2/mix/market/candles
```

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| symbol | String | 是 | 交易对 |
| productType | String | 是 | 产品类型 |
| granularity | String | 是 | K线周期：`1m`, `5m`, `15m`, `1H`, `4H`, `1D` 等 |
| limit | String | 否 | 返回数量，默认 100，最大 1000 |
| startTime | String | 否 | 开始时间（毫秒时间戳） |
| endTime | String | 否 | 结束时间（毫秒时间戳） |

**请求示例**
```bash
curl "https://api.bitget.com/api/v2/mix/market/candles?symbol=BTCUSDT&productType=USDT-FUTURES&granularity=5m&limit=100"
```

**响应示例**
```json
{
  "code": "00000",
  "msg": "success",
  "requestTime": 1695865615662,
  "data": [
    ["1695835800000", "98210.5", "98250.0", "98194.5", "98230.0", "26.26", "2578970.63"],
    ["1695836100000", "98230.0", "98280.0", "98171.0", "98265.0", "17.98", "1765800.72"]
  ]
}
```

**响应数组说明**

| 索引 | 说明 |
|------|------|
| [0] | 时间戳（毫秒） |
| [1] | 开盘价 |
| [2] | 最高价 |
| [3] | 最低价 |
| [4] | 收盘价 |
| [5] | 交易量（Base 币） |
| [6] | 交易额（Quote 币） |

---

## WebSocket 实时数据（可选）

如果需要**实时价格推送**，可使用 WebSocket。

**连接地址**
```
wss://ws.bitget.com/v2/ws/public
```

**订阅 Ticker**
```json
{
  "op": "subscribe",
  "args": [
    {
      "instType": "USDT-FUTURES",
      "channel": "ticker",
      "instId": "BTCUSDT"
    }
  ]
}
```

**推送数据示例**
```json
{
  "action": "snapshot",
  "arg": {
    "instType": "USDT-FUTURES",
    "channel": "ticker",
    "instId": "BTCUSDT"
  },
  "data": [
    {
      "instId": "BTCUSDT",
      "lastPr": "98650.50",
      "markPrice": "98648.00",
      "indexPrice": "98645.25",
      "high24h": "99500.00",
      "low24h": "97200.00",
      "ts": "1695793390482"
    }
  ]
}
```

**连接限制**
- 300 连接请求/IP/5分钟
- 最大 100 连接/IP
- 240 订阅请求/小时/连接
- 最大 1000 频道订阅/连接
- 心跳：每 30 秒发送 `"ping"`，期望收到 `"pong"`

---

## Python 集成代码

### 同步版本

```python
import requests
from decimal import Decimal

BITGET_API_BASE = "https://api.bitget.com"

def get_btc_price() -> dict:
    """获取 BTC 价格数据"""
    response = requests.get(
        f"{BITGET_API_BASE}/api/v2/mix/market/symbol-price",
        params={
            "symbol": "BTCUSDT",
            "productType": "USDT-FUTURES"
        }
    )
    data = response.json()
    
    if data["code"] != "00000":
        raise Exception(f"Bitget API error: {data['msg']}")
    
    price_data = data["data"][0]
    return {
        "price": Decimal(price_data["price"]),
        "mark_price": Decimal(price_data["markPrice"]),
        "index_price": Decimal(price_data["indexPrice"]),
        "timestamp": int(price_data["ts"])
    }


def get_btc_ticker() -> dict:
    """获取 BTC 完整行情"""
    response = requests.get(
        f"{BITGET_API_BASE}/api/v2/mix/market/ticker",
        params={
            "symbol": "BTCUSDT",
            "productType": "USDT-FUTURES"
        }
    )
    data = response.json()
    
    if data["code"] != "00000":
        raise Exception(f"Bitget API error: {data['msg']}")
    
    ticker = data["data"][0]
    return {
        "last_price": Decimal(ticker["lastPr"]),
        "mark_price": Decimal(ticker["markPrice"]),
        "index_price": Decimal(ticker["indexPrice"]),
        "high_24h": Decimal(ticker["high24h"]),
        "low_24h": Decimal(ticker["low24h"]),
        "change_24h": Decimal(ticker["change24h"]),
        "volume_24h": Decimal(ticker["baseVolume"]),
        "funding_rate": Decimal(ticker["fundingRate"]),
        "timestamp": int(ticker["ts"])
    }
```

### 异步版本

```python
import httpx
from decimal import Decimal

BITGET_API_BASE = "https://api.bitget.com"

async def get_btc_mark_price() -> Decimal:
    """异步获取 BTC Mark Price（用于结算）"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{BITGET_API_BASE}/api/v2/mix/market/symbol-price",
            params={
                "symbol": "BTCUSDT",
                "productType": "USDT-FUTURES"
            }
        )
        data = response.json()
        
        if data["code"] != "00000":
            raise Exception(f"Bitget API error: {data['msg']}")
        
        return Decimal(data["data"][0]["markPrice"])


async def get_btc_ticker() -> dict:
    """异步获取 BTC 完整行情"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{BITGET_API_BASE}/api/v2/mix/market/ticker",
            params={
                "symbol": "BTCUSDT",
                "productType": "USDT-FUTURES"
            }
        )
        data = response.json()
        
        if data["code"] != "00000":
            raise Exception(f"Bitget API error: {data['msg']}")
        
        ticker = data["data"][0]
        return {
            "last_price": Decimal(ticker["lastPr"]),
            "mark_price": Decimal(ticker["markPrice"]),
            "high_24h": Decimal(ticker["high24h"]),
            "low_24h": Decimal(ticker["low24h"]),
            "change_24h": Decimal(ticker["change24h"]),
            "timestamp": int(ticker["ts"])
        }
```

---

## 错误处理

### 常见错误码

| Code | 说明 | 处理方式 |
|------|------|----------|
| `00000` | 成功 | - |
| `40001` | 参数错误 | 检查请求参数 |
| `40018` | 频率限制 | 降低请求频率 |
| `50001` | 系统错误 | 重试或告警 |

### 重试策略

```python
import asyncio
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
async def get_btc_mark_price_with_retry() -> Decimal:
    """带重试的价格获取"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{BITGET_API_BASE}/api/v2/mix/market/symbol-price",
            params={
                "symbol": "BTCUSDT",
                "productType": "USDT-FUTURES"
            }
        )
        response.raise_for_status()
        data = response.json()
        
        if data["code"] != "00000":
            raise Exception(f"Bitget API error: {data['msg']}")
        
        return Decimal(data["data"][0]["markPrice"])
```

---

---

## 其他公开指标 API（无需认证）

以下是 Bitget 提供的其他公开指标 API，可用于丰富产品功能或供 Bot 策略分析。

### 1. 持仓量（Open Interest）

获取平台该交易对的总持仓量。

**Endpoint**
```
GET /api/v2/mix/market/open-interest
```

**请求示例**
```bash
curl "https://api.bitget.com/api/v2/mix/market/open-interest?symbol=BTCUSDT&productType=USDT-FUTURES"
```

**响应示例**
```json
{
  "code": "00000",
  "msg": "success",
  "data": {
    "openInterestList": [
      {
        "symbol": "BTCUSDT",
        "size": "34278.06"
      }
    ],
    "ts": "1695796781616"
  }
}
```

**用途**: 市场热度指标，持仓量大说明市场关注度高。

---

### 2. 当前资金费率（Current Funding Rate）

获取合约当前资金费率。

**Endpoint**
```
GET /api/v2/mix/market/current-fund-rate
```

**请求示例**
```bash
curl "https://api.bitget.com/api/v2/mix/market/current-fund-rate?symbol=BTCUSDT&productType=USDT-FUTURES"
```

**响应示例**
```json
{
  "code": "00000",
  "msg": "success",
  "data": [
    {
      "symbol": "BTCUSDT",
      "fundingRate": "0.000068",
      "fundingRateInterval": "8",
      "nextUpdate": "1743062400000",
      "minFundingRate": "-0.003",
      "maxFundingRate": "0.003"
    }
  ]
}
```

**字段说明**

| 字段 | 说明 |
|------|------|
| `fundingRate` | 当前资金费率（正数=多头付空头） |
| `fundingRateInterval` | 结算周期（小时），如 8 表示每 8 小时结算 |
| `nextUpdate` | 下次结算时间戳 |

**用途**: 
- 正费率 → 多头情绪强
- 负费率 → 空头情绪强

---

### 3. 历史资金费率（History Funding Rate）

获取历史资金费率数据。

**Endpoint**
```
GET /api/v2/mix/market/history-fund-rate
```

**请求示例**
```bash
curl "https://api.bitget.com/api/v2/mix/market/history-fund-rate?symbol=BTCUSDT&productType=USDT-FUTURES&pageSize=20"
```

**响应示例**
```json
{
  "code": "00000",
  "msg": "success",
  "data": [
    {
      "symbol": "BTCUSDT",
      "fundingRate": "0.0005",
      "fundingTime": "1695776400000"
    },
    {
      "symbol": "BTCUSDT",
      "fundingRate": "0.000013",
      "fundingTime": "1695715200000"
    }
  ]
}
```

**用途**: 分析资金费率趋势，判断市场情绪变化。

---

### 4. 多空比（Long-Short Ratio）

获取杠杆账户多空持仓比例。

**Endpoint**
```
GET /api/v2/margin/market/long-short-ratio
```

**频率限制**: 1 次/秒

**请求示例**
```bash
curl "https://api.bitget.com/api/v2/margin/market/long-short-ratio?symbol=BTCUSDT&period=24h"
```

**响应示例**
```json
{
  "code": "00000",
  "msg": "success",
  "data": [
    {
      "ts": "1713942000000",
      "longShortRatio": "1.25"
    },
    {
      "ts": "1713938400000",
      "longShortRatio": "1.18"
    }
  ]
}
```

**参数说明**

| 参数 | 说明 |
|------|------|
| `period` | 时间周期：`24h` 或 `30d` |
| `longShortRatio` | >1 表示多头占优，<1 表示空头占优 |

**用途**: 市场情绪指标，可供 Bot 参考。

---

### 5. 深度数据（Merge Depth）

获取买卖盘深度数据。

**Endpoint**
```
GET /api/v2/mix/market/merge-depth
```

**请求示例**
```bash
curl "https://api.bitget.com/api/v2/mix/market/merge-depth?symbol=BTCUSDT&productType=USDT-FUTURES&limit=15"
```

**响应示例**
```json
{
  "code": "00000",
  "msg": "success",
  "data": {
    "asks": [
      [26347.5, 0.25],
      [26348.0, 0.16]
    ],
    "bids": [
      [26346.5, 0.16],
      [26346.0, 0.32]
    ],
    "ts": "1695870968804"
  }
}
```

**用途**: 分析买卖压力，判断支撑阻力位。

---

### 6. 历史成交记录（History Transactions）

获取最近 90 天的成交记录。

**Endpoint**
```
GET /api/v2/mix/market/fills-history
```

**频率限制**: 10 次/秒

**请求示例**
```bash
curl "https://api.bitget.com/api/v2/mix/market/fills-history?symbol=BTCUSDT&productType=USDT-FUTURES&limit=100"
```

**响应示例**
```json
{
  "code": "00000",
  "msg": "success",
  "data": [
    {
      "tradeId": "1",
      "price": "26372.5",
      "size": "9.25",
      "side": "Sell",
      "ts": "1695865151000",
      "symbol": "BTCUSDT"
    }
  ]
}
```

**用途**: 分析大单成交，判断主力动向。

---

## 公开 API 汇总表

| API | Endpoint | 频率限制 | 用途 |
|-----|----------|----------|------|
| **价格数据** | `/api/v2/mix/market/symbol-price` | 20/s | ⭐ 结算价格 |
| **完整行情** | `/api/v2/mix/market/ticker` | 20/s | ⭐ 前端展示 |
| **K线数据** | `/api/v2/mix/market/candles` | 20/s | 图表/策略 |
| **历史K线** | `/api/v2/mix/market/history-candles` | 20/s | 历史数据 |
| **持仓量** | `/api/v2/mix/market/open-interest` | 20/s | 市场热度 |
| **当前费率** | `/api/v2/mix/market/current-fund-rate` | 20/s | 市场情绪 |
| **历史费率** | `/api/v2/mix/market/history-fund-rate` | 20/s | 费率趋势 |
| **多空比** | `/api/v2/margin/market/long-short-ratio` | 1/s | 市场情绪 |
| **深度数据** | `/api/v2/mix/market/merge-depth` | 20/s | 买卖压力 |
| **历史成交** | `/api/v2/mix/market/fills-history` | 10/s | 大单分析 |

---

## 总结

### 我们项目核心需要的 API

| API | 用途 | 优先级 |
|-----|------|--------|
| `/api/v2/mix/market/symbol-price` | 获取结算价格（markPrice） | ⭐ 必需 |
| `/api/v2/mix/market/ticker` | 前端展示完整行情 | ⭐ 必需 |
| `/api/v2/mix/market/candles` | K线数据（Bot策略/图表） | 推荐 |
| `/api/v2/mix/market/open-interest` | 持仓量展示 | 可选 |
| `/api/v2/mix/market/current-fund-rate` | 资金费率展示 | 可选 |
| WebSocket ticker | 实时价格推送 | 可选（MVP 可用轮询替代） |

### 可供 Bot 策略参考的指标

| 指标 | API | 说明 |
|------|-----|------|
| 资金费率 | `current-fund-rate` | 正=多头强，负=空头强 |
| 多空比 | `long-short-ratio` | >1=多头多，<1=空头多 |
| 持仓量 | `open-interest` | 上升=市场活跃 |
| 深度数据 | `merge-depth` | 大单堆积=支撑/阻力 |

### 关键参数（多标的配置）

```python
# 标的配置映射
SYMBOL_CONFIGS = {
    # 加密货币合约
    "BTCUSDT": {"api_source": "futures", "product_type": "USDT-FUTURES"},
    "ETHUSDT": {"api_source": "futures", "product_type": "USDT-FUTURES"},
    "SOLUSDT": {"api_source": "futures", "product_type": "USDT-FUTURES"},
    "DOGEUSDT": {"api_source": "futures", "product_type": "USDT-FUTURES"},
    
    # 贵金属（待 API 确认）
    "XAUUSD": {"api_source": "tradfi", "product_type": "TRADFI"},
    "XAGUSD": {"api_source": "tradfi", "product_type": "TRADFI"},
    
    # 代币化股票（待 API 确认）
    "TSLA": {"api_source": "uex", "product_type": "UEX-STOCK"},
    "AAPL": {"api_source": "uex", "product_type": "UEX-STOCK"},
}
```

### 统一价格获取（多标的）

```python
from decimal import Decimal
from typing import Protocol

class PriceProvider(Protocol):
    """价格提供者协议"""
    async def get_mark_price(self, symbol: str, product_type: str) -> Decimal: ...


class FuturesPriceProvider:
    """加密货币合约价格提供者"""
    
    BASE_URL = "https://api.bitget.com"
    
    async def get_mark_price(self, symbol: str, product_type: str = "USDT-FUTURES") -> Decimal:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.BASE_URL}/api/v2/mix/market/symbol-price",
                params={"symbol": symbol, "productType": product_type}
            )
            data = resp.json()
            if data["code"] != "00000":
                raise ValueError(f"API error: {data['msg']}")
            return Decimal(data["data"][0]["markPrice"])


class TradFiPriceProvider:
    """贵金属/外汇价格提供者（TradFi）"""
    
    BASE_URL = "https://api.bitget.com"
    
    async def get_mark_price(self, symbol: str, product_type: str = "TRADFI") -> Decimal:
        # TODO: 确认 Bitget TradFi API 的具体端点
        # 预计端点类似: /api/v2/tradfi/market/ticker
        raise NotImplementedError("TradFi API endpoint pending confirmation")


class UEXPriceProvider:
    """代币化股票价格提供者（UEX）"""
    
    BASE_URL = "https://api.bitget.com"
    
    async def get_mark_price(self, symbol: str, product_type: str = "UEX-STOCK") -> Decimal:
        # TODO: 确认 Bitget UEX API 的具体端点
        # 预计端点类似: /api/v2/uex/market/ticker
        raise NotImplementedError("UEX API endpoint pending confirmation")


# 数据源工厂
PROVIDERS = {
    "futures": FuturesPriceProvider(),
    "tradfi": TradFiPriceProvider(),
    "uex": UEXPriceProvider(),
}


async def get_mark_price(symbol: str) -> Decimal:
    """统一价格获取接口"""
    config = SYMBOL_CONFIGS.get(symbol)
    if not config:
        raise ValueError(f"Unknown symbol: {symbol}")
    
    provider = PROVIDERS[config["api_source"]]
    return await provider.get_mark_price(symbol, config["product_type"])
```

### 结算逻辑（通用）

```python
async def settle_round(round_data: dict, symbol_config: dict) -> str:
    """
    通用结算逻辑
    
    Args:
        round_data: 场次数据 {"open_price": Decimal, "symbol": str}
        symbol_config: 标的配置 {"draw_threshold": Decimal}
    
    Returns:
        "up" | "down" | "draw"
    """
    # 获取收盘价（使用统一接口）
    close_price = await get_mark_price(round_data["symbol"])
    open_price = round_data["open_price"]
    
    # 计算涨跌
    price_change = (close_price - open_price) / open_price
    
    # 使用配置的阈值（不同标的可能有不同阈值）
    threshold = symbol_config.get("draw_threshold", Decimal("0.0001"))
    
    if abs(price_change) < threshold:  # 默认 < 0.01%
        return "draw"
    elif price_change > 0:
        return "up"
    else:
        return "down"
```

---

## 未来扩展：TradFi & UEX API

当 Bitget 正式发布 TradFi 和 UEX 的公开 API 后，我们需要：

1. **确认 API 端点**
   - TradFi（贵金属、外汇）的价格接口
   - UEX（代币化股票）的价格接口

2. **确认交易时段**
   - 黄金/白银：周一至周五（可能有休市时间）
   - 美股：美东时间 9:30-16:00（需处理时区）

3. **实现对应的 Provider**
   - 完成 `TradFiPriceProvider`
   - 完成 `UEXPriceProvider`

4. **更新标的配置**
   - 添加新标的到 `SYMBOL_CONFIGS`
   - 配置交易时段限制

---

## 参考资源

> 内部文档，数据源 API 参考
