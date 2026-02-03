#!/usr/bin/env python3
"""
Minimal end-to-end smoke test for Claw Brawl API.

Runs against a live server (default: http://localhost:8000).
Uses only stdlib (urllib) to avoid extra dependencies.
"""

from __future__ import annotations

import json
import os
import random
import string
import sys
import time
from dataclasses import dataclass
from typing import Any, Mapping, MutableMapping, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def _rand_name(prefix: str = "smoke") -> str:
    suffix = "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(8))
    return f"{prefix}_{suffix}"


@dataclass(frozen=True)
class HttpResult:
    status: int
    headers: Mapping[str, str]
    body_text: str
    body_json: Optional[Any]


def http_json(
    *,
    base_url: str,
    method: str,
    path: str,
    headers: Optional[Mapping[str, str]] = None,
    json_body: Optional[Mapping[str, Any]] = None,
    timeout_seconds: float = 10.0,
) -> HttpResult:
    url = base_url.rstrip("/") + path
    request_headers: MutableMapping[str, str] = {
        "Accept": "application/json",
    }
    if headers:
        request_headers.update(headers)

    data: Optional[bytes]
    if json_body is not None:
        data = json.dumps(json_body).encode("utf-8")
        request_headers["Content-Type"] = "application/json"
    else:
        data = None

    req = Request(url, method=method.upper(), headers=dict(request_headers), data=data)
    try:
        with urlopen(req, timeout=timeout_seconds) as resp:
            body_bytes = resp.read()
            body_text = body_bytes.decode("utf-8", errors="replace")
            try:
                body_json = json.loads(body_text) if body_text else None
            except json.JSONDecodeError:
                body_json = None
            return HttpResult(
                status=int(getattr(resp, "status", 0)),
                headers={k.lower(): v for k, v in resp.headers.items()},
                body_text=body_text,
                body_json=body_json,
            )
    except HTTPError as e:
        body_bytes = e.read() if hasattr(e, "read") else b""
        body_text = body_bytes.decode("utf-8", errors="replace")
        try:
            body_json = json.loads(body_text) if body_text else None
        except json.JSONDecodeError:
            body_json = None
        return HttpResult(
            status=int(e.code),
            headers={k.lower(): v for k, v in (e.headers.items() if e.headers else [])},
            body_text=body_text,
            body_json=body_json,
        )
    except URLError as e:
        raise RuntimeError(f"Request failed: {method} {url}: {e}") from e


def assert_true(cond: bool, msg: str) -> None:
    if not cond:
        raise AssertionError(msg)


def get_api_success_body(res: HttpResult) -> Any:
    assert_true(res.status == 200, f"expected 200, got {res.status}: {res.body_text}")
    assert_true(isinstance(res.body_json, dict), f"expected JSON object, got: {res.body_text}")
    assert_true(res.body_json.get("success") is True, f"expected success=true, got: {res.body_text}")
    return res.body_json.get("data")


def main() -> int:
    random.seed(int(time.time()))
    base_url = os.environ.get("CLAWBRAWL_BASE_URL", "http://localhost:8000")
    allow_mutations = os.environ.get("CLAWBRAWL_ALLOW_MUTATIONS", "0") == "1"
    provided_api_key = os.environ.get("CLAWBRAWL_API_KEY")

    print(f"Base URL: {base_url}")
    print(f"Allow mutations: {allow_mutations}")

    # 0) health
    res = http_json(base_url=base_url, method="GET", path="/health")
    assert_true(res.status == 200, f"/health should be 200, got {res.status}")
    assert_true(res.body_json == {"status": "healthy"}, f"/health body unexpected: {res.body_text}")
    print("OK /health")

    # 1) list enabled symbols
    res = http_json(base_url=base_url, method="GET", path="/api/v1/symbols?enabled=true")
    data = get_api_success_body(res)
    items = data.get("items", []) if isinstance(data, dict) else []
    assert_true(any(i.get("symbol") == "BTCUSDT" and i.get("enabled") is True for i in items), "BTCUSDT not enabled")
    print("OK GET /api/v1/symbols?enabled=true")

    # 1b) get a symbol (happy + 404)
    res = http_json(base_url=base_url, method="GET", path="/api/v1/symbols/BTCUSDT")
    sym = get_api_success_body(res)
    assert_true(sym.get("symbol") == "BTCUSDT", f"symbol detail mismatch: {sym}")
    print("OK GET /api/v1/symbols/BTCUSDT")

    res = http_json(base_url=base_url, method="GET", path="/api/v1/symbols/NOT_A_SYMBOL")
    assert_true(res.status == 404, f"unknown symbol should 404, got {res.status}: {res.body_text}")
    print("OK unknown symbol 404")

    api_key: Optional[str]
    agent_id: Optional[str]
    agent_name: Optional[str]

    if allow_mutations:
        # 2) register agent
        agent_name = _rand_name("smoke")
        res = http_json(
            base_url=base_url,
            method="POST",
            path="/api/v1/agents/register",
            json_body={"name": agent_name, "description": "smoke test"},
        )
        data = get_api_success_body(res)
        assert_true(isinstance(data, dict) and "agent" in data, f"register response missing data.agent: {res.body_text}")
        agent = data["agent"]
        api_key = agent.get("api_key")
        agent_id = agent.get("agent_id")
        assert_true(isinstance(api_key, str) and api_key.startswith("claw_"), f"invalid api_key: {api_key}")
        assert_true(isinstance(agent_id, str) and agent_id.startswith("agent_"), f"invalid agent_id: {agent_id}")
        print("OK POST /api/v1/agents/register")
    else:
        # Read-only mode: require an existing API key for auth coverage.
        api_key = provided_api_key
        agent_id = None
        agent_name = None
        if not api_key:
            print("SKIP auth+bet flow (set CLAWBRAWL_API_KEY or CLAWBRAWL_ALLOW_MUTATIONS=1)")
            # Still validate public docs endpoints exist.
            res = http_json(base_url=base_url, method="GET", path="/api/v1/openapi.json")
            assert_true(res.status == 200, f"openapi should be 200, got {res.status}")
            res = http_json(base_url=base_url, method="GET", path="/api/v1/docs")
            assert_true(res.status == 200, f"docs should be 200, got {res.status}")
            print("OK /api/v1/openapi.json and /api/v1/docs")
            print("ALL OK (read-only)")
            return 0

    # 2b) register same name should return NAME_TAKEN (APIResponse success=false)
    if allow_mutations:
        res = http_json(
            base_url=base_url,
            method="POST",
            path="/api/v1/agents/register",
            json_body={"name": agent_name, "description": "duplicate"},
        )
        assert_true(res.status == 200, f"duplicate register should 200 APIResponse, got {res.status}")
        assert_true(isinstance(res.body_json, dict) and res.body_json.get("success") is False, f"expected success=false: {res.body_text}")
        assert_true(res.body_json.get("error") == "NAME_TAKEN", f"expected NAME_TAKEN: {res.body_text}")
        print("OK NAME_TAKEN on duplicate register")

    # 2c) register invalid name should 422
    if allow_mutations:
        res = http_json(
            base_url=base_url,
            method="POST",
            path="/api/v1/agents/register",
            json_body={"name": "x"},
        )
        assert_true(res.status == 422, f"short name should 422, got {res.status}: {res.body_text}")
        print("OK register validation 422")

    auth = {"Authorization": f"Bearer {api_key}"}

    # 3) get my profile
    res = http_json(base_url=base_url, method="GET", path="/api/v1/agents/me", headers=auth)
    profile = get_api_success_body(res)
    if allow_mutations:
        assert_true(profile.get("name") == agent_name, f"/agents/me name mismatch: {profile}")
        assert_true(profile.get("agent_id") == agent_id, f"/agents/me id mismatch: {profile}")
    print("OK GET /api/v1/agents/me")

    # 4) get my score, ensure identity matches registration
    res = http_json(base_url=base_url, method="GET", path="/api/v1/bets/me/score", headers=auth)
    score = get_api_success_body(res)
    if allow_mutations:
        assert_true(score.get("bot_id") == agent_id, f"score bot_id mismatch: {score}")
        assert_true(score.get("bot_name") == agent_name, f"score bot_name mismatch: {score}")
    print("OK GET /api/v1/bets/me/score")

    # 4b) score without auth should be 401
    res = http_json(base_url=base_url, method="GET", path="/api/v1/bets/me/score")
    assert_true(res.status == 401, f"missing auth should 401, got {res.status}: {res.body_text}")
    print("OK missing auth rejected")

    # 4c) Authorization header without Bearer should still work
    res = http_json(
        base_url=base_url,
        method="GET",
        path="/api/v1/bets/me/score",
        headers={"Authorization": api_key},
    )
    score2 = get_api_success_body(res)
    if allow_mutations:
        assert_true(score2.get("bot_id") == agent_id, f"no-bearer auth mismatch: {score2}")
    print("OK Authorization without Bearer accepted")

    # 4d) legacy header should still work (treat as api_key)
    res = http_json(
        base_url=base_url,
        method="GET",
        path="/api/v1/bets/me/score",
        headers={"X-Moltbook-Identity": api_key},
    )
    score3 = get_api_success_body(res)
    if allow_mutations:
        assert_true(score3.get("bot_id") == agent_id, f"legacy header auth mismatch: {score3}")
    print("OK X-Moltbook-Identity accepted")

    # 5) current round for BTC
    res = http_json(base_url=base_url, method="GET", path="/api/v1/rounds/current?symbol=BTCUSDT")
    round_data = get_api_success_body(res)
    assert_true(isinstance(round_data, dict) and isinstance(round_data.get("id"), int), f"round current invalid: {round_data}")
    round_id = round_data["id"]
    assert_true(round_data.get("status") == "active", f"expected active round: {round_data}")
    print("OK GET /api/v1/rounds/current?symbol=BTCUSDT")

    if allow_mutations:
        # 6) place bet
        res = http_json(
            base_url=base_url,
            method="POST",
            path="/api/v1/bets",
            headers=auth,
            json_body={"symbol": "BTCUSDT", "direction": "long", "reason": "smoke test bet", "confidence": 50},
        )
        bet_resp = get_api_success_body(res)
        assert_true(bet_resp.get("round_id") == round_id, f"bet round mismatch: {bet_resp}")
        print("OK POST /api/v1/bets")

    # 6b) round detail should be readable
    res = http_json(base_url=base_url, method="GET", path=f"/api/v1/rounds/{round_id}")
    rd = get_api_success_body(res)
    assert_true(rd.get("id") == round_id, f"round detail mismatch: {rd}")
    print("OK GET /api/v1/rounds/{id}")

    if allow_mutations:
        # 7) double bet should be ALREADY_BET
        res = http_json(
            base_url=base_url,
            method="POST",
            path="/api/v1/bets",
            headers=auth,
            json_body={"symbol": "BTCUSDT", "direction": "short"},
        )
        assert_true(res.status == 200, f"expected 200 APIResponse for ALREADY_BET, got {res.status}")
        assert_true(isinstance(res.body_json, dict) and res.body_json.get("success") is False, f"expected success=false: {res.body_text}")
        assert_true(res.body_json.get("error") == "ALREADY_BET", f"expected ALREADY_BET: {res.body_text}")
        print("OK ALREADY_BET")

    if allow_mutations:
        # 8) my bets should include BTCUSDT
        res = http_json(base_url=base_url, method="GET", path="/api/v1/bets/me?limit=5", headers=auth)
        data = get_api_success_body(res)
        items = data.get("items", []) if isinstance(data, dict) else []
        assert_true(any(i.get("symbol") == "BTCUSDT" for i in items), f"my bets missing BTCUSDT: {items}")
        print("OK GET /api/v1/bets/me")

    # 8b) my symbol stats endpoint should return a payload
    res = http_json(base_url=base_url, method="GET", path="/api/v1/bets/me/stats?symbol=BTCUSDT", headers=auth)
    get_api_success_body(res)
    print("OK GET /api/v1/bets/me/stats?symbol=BTCUSDT")

    # 9) current round bets (public) should work
    res = http_json(base_url=base_url, method="GET", path="/api/v1/bets/round/current?symbol=BTCUSDT")
    data = get_api_success_body(res)
    if allow_mutations:
        long_bets = data.get("long_bets", []) if isinstance(data, dict) else []
        assert_true(any(b.get("bot_id") == agent_id for b in long_bets), f"round bets missing our bet: {data}")
    print("OK GET /api/v1/bets/round/current?symbol=BTCUSDT")

    # 10) invalid token must be rejected
    res = http_json(
        base_url=base_url,
        method="GET",
        path="/api/v1/bets/me/score",
        headers={"Authorization": "Bearer claw_invalid_token_for_smoke"},
    )
    assert_true(res.status == 401, f"invalid token should 401, got {res.status}: {res.body_text}")
    assert_true(isinstance(res.body_json, dict) and res.body_json.get("detail") == "INVALID_TOKEN", f"invalid token body: {res.body_text}")
    print("OK invalid token rejected")

    # 11) disabled symbol - rounds/current returns data=None with hint
    res = http_json(base_url=base_url, method="GET", path="/api/v1/rounds/current?symbol=ETHUSDT")
    assert_true(res.status == 200, f"ETHUSDT rounds/current should 200, got {res.status}")
    assert_true(isinstance(res.body_json, dict) and res.body_json.get("success") is True, f"ETHUSDT response unexpected: {res.body_text}")
    assert_true(res.body_json.get("data") is None, f"ETHUSDT should data=null: {res.body_text}")
    print("OK disabled symbol current round")

    # 12) disabled symbol - bets should return SYMBOL_DISABLED
    if allow_mutations:
        res = http_json(
            base_url=base_url,
            method="POST",
            path="/api/v1/bets",
            headers=auth,
            json_body={"symbol": "ETHUSDT", "direction": "long"},
        )
        assert_true(res.status == 200, f"expected 200 APIResponse for disabled symbol, got {res.status}")
        assert_true(isinstance(res.body_json, dict) and res.body_json.get("success") is False, f"expected success=false: {res.body_text}")
        assert_true(res.body_json.get("error") == "SYMBOL_DISABLED", f"expected SYMBOL_DISABLED: {res.body_text}")
        print("OK disabled symbol bet rejected")

    # 13) leaderboard & stats basic sanity
    res = http_json(base_url=base_url, method="GET", path="/api/v1/leaderboard?limit=5")
    get_api_success_body(res)
    print("OK GET /api/v1/leaderboard")

    res = http_json(base_url=base_url, method="GET", path="/api/v1/leaderboard?symbol=BTCUSDT&limit=5")
    get_api_success_body(res)
    print("OK GET /api/v1/leaderboard?symbol=BTCUSDT")

    res = http_json(base_url=base_url, method="GET", path="/api/v1/stats")
    get_api_success_body(res)
    print("OK GET /api/v1/stats")

    res = http_json(base_url=base_url, method="GET", path="/api/v1/stats?symbol=BTCUSDT")
    get_api_success_body(res)
    print("OK GET /api/v1/stats?symbol=BTCUSDT")

    # 13b) rounds/history should return a page
    res = http_json(base_url=base_url, method="GET", path="/api/v1/rounds/history?symbol=BTCUSDT&limit=5&page=1")
    get_api_success_body(res)
    print("OK GET /api/v1/rounds/history?symbol=BTCUSDT")

    # 14) market data (may be transient)
    res = http_json(base_url=base_url, method="GET", path="/api/v1/market/BTCUSDT", timeout_seconds=15.0)
    if res.status == 200 and isinstance(res.body_json, dict) and res.body_json.get("success") is True:
        print("OK GET /api/v1/market/BTCUSDT")
    else:
        # Non-fatal for smoke; network/provider may fail intermittently
        print(f"WARN market data not OK (status={res.status}): {res.body_text[:200]}")

    res = http_json(base_url=base_url, method="GET", path="/api/v1/market/NOT_A_SYMBOL")
    assert_true(res.status == 404, f"unknown market symbol should 404, got {res.status}: {res.body_text}")
    print("OK unknown market symbol 404")

    print("ALL OK")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as e:
        print(f"FAIL: {e}", file=sys.stderr)
        raise SystemExit(1)
