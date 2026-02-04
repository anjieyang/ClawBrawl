"""
Danmaku Service - 弹幕后台服务
定期生成智能弹幕并发送到竞技场
"""

import asyncio
import random
from datetime import datetime
from typing import Optional

import httpx

from .config import config
from .danmaku_generator import DanmakuGenerator, get_danmaku_generator


class DanmakuService:
    """弹幕后台服务"""
    
    # 弹幕颜色池（鲜艳的颜色）
    COLORS = [
        "#FF6B6B",  # 红
        "#4ECDC4",  # 青
        "#FFE66D",  # 黄
        "#95E1D3",  # 薄荷
        "#F38181",  # 粉红
        "#AA96DA",  # 紫
        "#FCBAD3",  # 浅粉
        "#A8D8EA",  # 浅蓝
        "#FF9F43",  # 橙
        "#00D2D3",  # 青绿
        "#FFFFFF",  # 白
        "#54A0FF",  # 蓝
    ]
    
    # 昵称池（匿名用户风格）
    NICKNAMES = [
        "韭菜本韭",
        "梭哈战士",
        "抄底大师",
        "山顶站岗",
        "钻石手",
        "纸手玩家",
        "空军司令",
        "多头先锋",
        "量化小白",
        "老韭菜",
        "新韭菜",
        "币圈萌新",
        "合约杀手",
        "爆仓专家",
        "止损达人",
        "FOMO患者",
        "佛系持币",
        "短线选手",
        "趋势猎人",
        "逆势而为",
        "随缘交易",
        "技术派",
        "消息党",
        "巨鲸观察",
        "散户代表",
    ]
    
    def __init__(
        self,
        api_base: str = "http://localhost:8000",
        symbol: str = "BTCUSDT",
        interval_range: tuple[int, int] = (8, 20),  # 发送间隔范围（秒）
        batch_size_range: tuple[int, int] = (1, 3),  # 每批生成数量
    ):
        self.api_base = api_base
        self.symbol = symbol
        self.interval_range = interval_range
        self.batch_size_range = batch_size_range
        
        self.generator = get_danmaku_generator()
        self._running = False
        self._task: Optional[asyncio.Task[None]] = None
        self._http_client: Optional[httpx.AsyncClient] = None
    
    async def _get_http_client(self) -> httpx.AsyncClient:
        """获取 HTTP 客户端"""
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(timeout=10.0)
        return self._http_client
    
    async def _get_round_bets(self) -> tuple[int, int]:
        """获取当前轮的多空下注数"""
        try:
            client = await self._get_http_client()
            response = await client.get(
                f"{self.api_base}/api/v1/rounds/current",
                params={"symbol": self.symbol}
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("data"):
                    round_data = data["data"]
                    long_count = round_data.get("long_count", 0)
                    short_count = round_data.get("short_count", 0)
                    return long_count, short_count
        except Exception as e:
            print(f"[DanmakuService] Failed to get round bets: {e}")
        return 0, 0
    
    async def _send_danmaku(self, content: str) -> bool:
        """发送弹幕到 API"""
        try:
            client = await self._get_http_client()
            
            # 随机选择颜色和昵称
            color = random.choice(self.COLORS)
            nickname = random.choice(self.NICKNAMES)
            
            response = await client.post(
                f"{self.api_base}/api/v1/danmaku",
                json={
                    "symbol": self.symbol,
                    "content": content,
                    "color": color,
                    "nickname": nickname,
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    return True
                else:
                    # 可能是频率限制，静默处理
                    if data.get("error") == "RATE_LIMITED":
                        return False
                    print(f"[DanmakuService] API error: {data.get('error')}")
            return False
            
        except Exception as e:
            print(f"[DanmakuService] Failed to send danmaku: {e}")
            return False
    
    async def _run_loop(self) -> None:
        """主循环"""
        print(f"[DanmakuService] Started for {self.symbol}", flush=True)
        
        while self._running:
            try:
                # 获取当前轮的多空数据
                long_count, short_count = await self._get_round_bets()
                
                # 构建上下文
                ctx = await self.generator.build_context(
                    symbol=self.symbol,
                    long_count=long_count,
                    short_count=short_count,
                )
                
                if ctx:
                    # 随机批量大小
                    batch_size = random.randint(*self.batch_size_range)
                    
                    # 生成弹幕
                    danmaku_list = await self.generator.generate_danmaku(ctx, count=batch_size)
                    print(f"[DanmakuService] Generated {len(danmaku_list)} danmaku: {danmaku_list}")
                    
                    # 发送弹幕（带随机延迟）
                    for danmaku in danmaku_list:
                        success = await self._send_danmaku(danmaku)
                        if success:
                            print(f"[DanmakuService] Sent: {danmaku}")
                        else:
                            print(f"[DanmakuService] Failed to send: {danmaku}")
                        
                        # 每条弹幕之间加点延迟
                        await asyncio.sleep(random.uniform(1.5, 4.0))
                else:
                    print("[DanmakuService] Failed to build context")
                
                # 等待下一轮
                interval = random.uniform(*self.interval_range)
                await asyncio.sleep(interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[DanmakuService] Error in loop: {e}")
                await asyncio.sleep(10)  # 出错后等待一会
        
        print("[DanmakuService] Stopped")
    
    async def start(self) -> None:
        """启动服务"""
        if self._running:
            return
        
        self._running = True
        self._task = asyncio.create_task(self._run_loop())
    
    async def stop(self) -> None:
        """停止服务"""
        self._running = False
        
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None
        
        await self.generator.close()


async def run_danmaku_service(
    api_base: str = "http://localhost:8000",
    symbol: str = "BTCUSDT",
) -> None:
    """运行弹幕服务（独立入口）"""
    service = DanmakuService(
        api_base=api_base,
        symbol=symbol,
        interval_range=(8, 20),  # 8-20秒发一批
        batch_size_range=(1, 3),  # 每批1-3条
    )
    
    try:
        await service.start()
        # 保持运行
        while True:
            await asyncio.sleep(60)
    except KeyboardInterrupt:
        print("\n[DanmakuService] Shutting down...")
    finally:
        await service.stop()


if __name__ == "__main__":
    import sys
    
    api_base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
    symbol = sys.argv[2] if len(sys.argv) > 2 else "BTCUSDT"
    
    asyncio.run(run_danmaku_service(api_base, symbol))
