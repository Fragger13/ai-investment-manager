from __future__ import annotations

import hashlib
import json
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.services.intelligence import now_iso


CACHE_DIR = Path(__file__).resolve().parents[3] / ".research_cache"
DEFAULT_HEADERS = {
    "Accept": "application/rss+xml, application/xml, text/xml, application/json, text/plain, */*",
    "Accept-Language": "en-IN,en;q=0.9",
    "User-Agent": "AIInvestmentManagerResearchBot/0.3 (+local research ingestion; RSS/API only)",
}


@dataclass(frozen=True)
class FetchResult:
    url: str
    text: str
    mode: str
    status_code: int | None
    content_type: str
    retrieved_at: str
    message: str
    from_cache: bool = False

    @property
    def ok(self) -> bool:
        return bool(self.text) and self.mode in {"live", "cached", "delayed"}


def _cache_paths(url: str) -> tuple[Path, Path]:
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()
    return CACHE_DIR / f"{digest}.body", CACHE_DIR / f"{digest}.json"


def _read_cache(url: str, max_age_seconds: int) -> FetchResult | None:
    body_path, meta_path = _cache_paths(url)
    if not body_path.exists() or not meta_path.exists():
        return None
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        age = time.time() - float(meta.get("storedAtEpoch", 0))
        mode = "cached" if age <= max_age_seconds else "delayed"
        return FetchResult(
            url=url,
            text=body_path.read_text(encoding="utf-8", errors="ignore"),
            mode=mode,
            status_code=meta.get("statusCode"),
            content_type=meta.get("contentType", ""),
            retrieved_at=meta.get("retrievedAt", now_iso()),
            message=f"Using {mode} response from local research cache.",
            from_cache=True,
        )
    except (OSError, ValueError, json.JSONDecodeError):
        return None


def _write_cache(result: FetchResult) -> None:
    if not result.text or result.mode != "live":
        return
    body_path, meta_path = _cache_paths(result.url)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    body_path.write_text(result.text, encoding="utf-8")
    meta_path.write_text(
        json.dumps(
            {
                "url": result.url,
                "statusCode": result.status_code,
                "contentType": result.content_type,
                "retrievedAt": result.retrieved_at,
                "storedAtEpoch": time.time(),
            }
        ),
        encoding="utf-8",
    )


def _urllib_fetch(url: str, timeout: int, headers: dict[str, str]) -> FetchResult:
    request = Request(url, headers=headers)
    retrieved_at = now_iso()
    try:
        with urlopen(request, timeout=timeout) as response:
            raw = response.read()
            content_type = response.headers.get("content-type", "")
            return FetchResult(url, raw.decode("utf-8", errors="ignore"), "live", response.status, content_type, retrieved_at, "Fetched with urllib.")
    except HTTPError as exc:
        return FetchResult(url, "", "limited", exc.code, exc.headers.get("content-type", ""), retrieved_at, f"HTTP {exc.code}")
    except (URLError, TimeoutError, OSError, UnicodeDecodeError) as exc:
        return FetchResult(url, "", "limited", None, "", retrieved_at, f"{type(exc).__name__}: {exc}")


def _curl_fetch(url: str, timeout: int, headers: dict[str, str]) -> FetchResult:
    cmd = ["curl", "-sS", "-L", "--max-time", str(timeout), "-w", "\n__HTTP_STATUS__:%{http_code}\n__CONTENT_TYPE__:%{content_type}", url]
    for key, value in headers.items():
        cmd[1:1] = ["-H", f"{key}: {value}"]
    retrieved_at = now_iso()
    try:
        process = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 2, check=False)
    except (OSError, subprocess.SubprocessError) as exc:
        return FetchResult(url, "", "limited", None, "", retrieved_at, f"curl unavailable: {type(exc).__name__}")
    output = process.stdout or ""
    marker = "\n__HTTP_STATUS__:"
    if marker not in output:
        return FetchResult(url, "", "limited", None, "", retrieved_at, process.stderr.strip() or "curl returned no response metadata")
    body, meta = output.rsplit(marker, 1)
    status_text, _, content_type = meta.partition("\n__CONTENT_TYPE__:")
    try:
        status_code = int(status_text.strip())
    except ValueError:
        status_code = None
    if process.returncode == 0 and status_code and 200 <= status_code < 300 and body.strip():
        return FetchResult(url, body, "live", status_code, content_type.strip(), retrieved_at, "Fetched with curl fallback.")
    message = process.stderr.strip() or f"curl HTTP {status_code}"
    return FetchResult(url, "", "limited", status_code, content_type.strip(), retrieved_at, message)


def fetch_text(
    url: str,
    *,
    timeout: int = 10,
    retries: int = 2,
    cache_ttl_seconds: int = 3600,
    headers: dict[str, str] | None = None,
    require_xml: bool = False,
    require_json: bool = False,
) -> FetchResult:
    request_headers = {**DEFAULT_HEADERS, **(headers or {})}
    last_result: FetchResult | None = None
    for attempt in range(retries + 1):
        for fetcher in (_urllib_fetch, _curl_fetch):
            result = fetcher(url, timeout, request_headers)
            last_result = result
            if _valid_result(result, require_xml=require_xml, require_json=require_json):
                _write_cache(result)
                return result
        if attempt < retries:
            time.sleep(0.4 * (attempt + 1))
    cached = _read_cache(url, cache_ttl_seconds)
    if cached and _valid_result(cached, require_xml=require_xml, require_json=require_json):
        return cached
    return last_result or FetchResult(url, "", "limited", None, "", now_iso(), "No fetch attempt completed.")


def _valid_result(result: FetchResult, *, require_xml: bool, require_json: bool) -> bool:
    if not result.text or result.mode != "live":
        return False
    stripped = result.text.lstrip()
    content_type = result.content_type.lower()
    if require_xml:
        return ("xml" in content_type or stripped.startswith("<")) and ("<rss" in stripped[:500].lower() or "<feed" in stripped[:500].lower())
    if require_json:
        return "json" in content_type or stripped.startswith("{") or stripped.startswith("[")
    return True
