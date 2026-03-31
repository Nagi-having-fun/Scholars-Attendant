#!/usr/bin/env python3
"""
Notion Paper Collection → Zotero sync tool.

Usage:
    python3 notion-to-zotero.py --title "Paper Title" --authors "First Last, ..." --url URL --collection "Name"
    python3 notion-to-zotero.py --list-collections
    python3 notion-to-zotero.py --check-duplicate --title "Paper Title"

Reads Zotero credentials from ~/.scholars-attendant/zotero.json
Zero external dependencies — uses only Python stdlib.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import re
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any

__version__ = "1.2.0"

# ── Logging ──

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
    level=logging.INFO,
)
log = logging.getLogger("notion-to-zotero")

# ── Config ──

CONFIG_PATH = Path.home() / ".scholars-attendant" / "zotero.json"
MAX_RETRIES = 3
RETRY_DELAY = 2.0  # seconds


def load_zotero_config() -> dict[str, str]:
    if not CONFIG_PATH.exists():
        log.error("Config not found: %s", CONFIG_PATH)
        log.error("Run /zotero-setup or create it with api_key and user_id.")
        sys.exit(1)
    with open(CONFIG_PATH) as f:
        config = json.load(f)
    if not config.get("api_key") or not config.get("user_id"):
        log.error("Config missing api_key or user_id in %s", CONFIG_PATH)
        sys.exit(1)
    return config


# ── Zotero API ──

def zotero_request(
    method: str,
    path: str,
    config: dict[str, str],
    data: Any | None = None,
    retries: int = MAX_RETRIES,
) -> Any:
    """Make a Zotero API request with retry logic."""
    url = f"https://api.zotero.org/users/{config['user_id']}{path}"
    headers = {
        "Zotero-API-Key": config["api_key"],
        "Zotero-API-Version": "3",
        "Content-Type": "application/json",
    }
    body = json.dumps(data).encode() if data else None

    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, data=body, headers=headers, method=method)
            with urllib.request.urlopen(req, timeout=30) as resp:
                if resp.status in (200, 201):
                    return json.loads(resp.read())
                log.warning("Unexpected status %d on attempt %d", resp.status, attempt)
        except urllib.error.HTTPError as e:
            error_body = e.read().decode()[:500]
            if e.code == 429:  # Rate limited
                retry_after = int(e.headers.get("Retry-After", RETRY_DELAY * attempt))
                log.warning("Rate limited. Retrying in %ds (attempt %d/%d)", retry_after, attempt, retries)
                time.sleep(retry_after)
                continue
            if e.code >= 500 and attempt < retries:
                log.warning("Server error %d. Retrying in %ds (attempt %d/%d)", e.code, RETRY_DELAY * attempt, attempt, retries)
                time.sleep(RETRY_DELAY * attempt)
                continue
            log.error("Zotero API error %d: %s", e.code, error_body)
            return None
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt < retries:
                log.warning("Network error: %s. Retrying in %ds (attempt %d/%d)", e, RETRY_DELAY * attempt, attempt, retries)
                time.sleep(RETRY_DELAY * attempt)
                continue
            log.error("Network error after %d attempts: %s", retries, e)
            return None
    return None


def list_collections(config: dict[str, str]) -> list[dict[str, Any]]:
    return zotero_request("GET", "/collections?limit=100", config) or []


def find_collection_key(name: str, collections: list[dict[str, Any]]) -> str | None:
    name_lower = name.lower().strip()
    for c in collections:
        if c.get("data", {}).get("name", "").lower().strip() == name_lower:
            return c["data"]["key"]
    return None


def check_duplicate(title: str, config: dict[str, str]) -> dict[str, Any] | None:
    """Check if a paper with this title already exists in Zotero."""
    # URL-encode the title for search
    encoded = urllib.request.quote(title[:100])
    items = zotero_request("GET", f"/items?q={encoded}&format=json&limit=10", config)
    if not items:
        return None
    # Normalize for comparison: lowercase, strip punctuation
    norm = lambda s: re.sub(r"[^\w\s]", "", s.lower()).strip()
    target = norm(title)
    for item in items:
        candidate = norm(item.get("data", {}).get("title", ""))
        if candidate == target:
            return item.get("data", {})
    return None


# ── Author Parsing ──

# Common multi-word last name prefixes
_PREFIXES = frozenset({
    "van", "von", "de", "del", "della", "di", "le", "la", "el",
    "al", "bin", "ibn", "abu", "das", "dos", "du", "den", "der",
    "ter", "ten", "op", "het", "st", "mc", "mac", "o'",
})


def parse_author_name(name: str) -> dict[str, str]:
    """Parse an author name into first/last, handling multi-word surnames.

    Handles:
      - "Ludwig van Beethoven" → first="Ludwig", last="van Beethoven"
      - "Jean-Baptiste Tristan" → first="Jean-Baptiste", last="Tristan"
      - "A. Feder Cooper" → first="A. Feder", last="Cooper"
      - "Koedinger" → first="", last="Koedinger"
      - "El Mahdi El Mhamdi" → first="El Mahdi", last="El Mhamdi"
    """
    name = name.strip()
    if not name:
        return {"creatorType": "author", "firstName": "", "lastName": ""}

    # Remove trailing " et al." / " et al"
    name = re.sub(r"\s+et\s+al\.?$", "", name, flags=re.IGNORECASE)

    parts = name.split()
    if len(parts) == 1:
        return {"creatorType": "author", "firstName": "", "lastName": parts[0]}

    # Walk backwards from end to find where the last name starts
    # Last name = final word + any preceding prefix words
    last_start = len(parts) - 1
    while last_start > 1 and parts[last_start - 1].lower().rstrip("'") in _PREFIXES:
        last_start -= 1

    # Ensure at least one word for first name
    if last_start == 0:
        last_start = 1

    first = " ".join(parts[:last_start])
    last = " ".join(parts[last_start:])
    return {"creatorType": "author", "firstName": first, "lastName": last}


def parse_authors(authors_str: str) -> list[dict[str, str]]:
    """Parse a comma-separated author string into Zotero creator objects."""
    creators = []
    for name in authors_str.split(","):
        name = name.strip()
        if not name:
            continue
        creators.append(parse_author_name(name))
    return creators


# ── Item Creation ──

def extract_arxiv_id(url: str) -> str | None:
    m = re.search(r"(\d{4}\.\d{4,5})(v\d+)?", url)
    return m.group(1) if m else None


def _find_zotero_storage_dir() -> Path | None:
    """Auto-detect local Zotero storage directory."""
    candidates = [
        Path.home() / "Zotero" / "storage",            # macOS / Linux default
        Path.home() / "Documents" / "Zotero" / "storage",  # alternate
        Path(os.environ.get("ZOTERO_STORAGE", "")) if os.environ.get("ZOTERO_STORAGE") else None,
    ]
    for p in candidates:
        if p and p.is_dir():
            return p
    return None


def _download_file(url: str, dest: Path, retries: int = MAX_RETRIES) -> bool:
    """Download a file with retry logic."""
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            if len(data) < 1000:
                log.warning("Downloaded file too small (%dB), likely not a PDF", len(data))
                return False
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            log.info("Downloaded %dKB → %s", len(data) // 1024, dest.name)
            return True
        except Exception as e:
            if attempt < retries:
                log.warning("Download attempt %d/%d failed: %s", attempt, retries, e)
                time.sleep(RETRY_DELAY * attempt)
            else:
                log.error("Download failed after %d attempts: %s", retries, e)
    return False


def attach_pdf(
    item_key: str,
    pdf_url: str,
    title: str,
    config: dict[str, str],
    local_storage: bool = True,
) -> bool:
    """Attach a PDF to a Zotero item.

    If local_storage=True (default), downloads the PDF directly into the local
    Zotero storage directory so it opens in the built-in reader without syncing.
    Falls back to imported_url mode if local storage is not found.
    """
    # Step 1: Create attachment item in Zotero
    safe_filename = re.sub(r"[^\w\s\-.]", "", title.replace("/", "_"))[:80]
    if not safe_filename.endswith(".pdf"):
        safe_filename += ".pdf"

    attachment = [{
        "itemType": "attachment",
        "parentItem": item_key,
        "linkMode": "imported_url",
        "title": safe_filename,
        "url": pdf_url,
        "contentType": "application/pdf",
        "charset": "",
        "tags": [],
    }]
    log.info("Creating PDF attachment for: %s", title[:60])
    result = zotero_request("POST", "/items", config, attachment)
    if not result or not result.get("successful"):
        log.warning("Failed to create attachment item: %s", result)
        return False

    att_key = list(result["successful"].values())[0]["key"]

    # Step 2: Download PDF to local Zotero storage
    if local_storage:
        storage_dir = _find_zotero_storage_dir()
        if storage_dir:
            dest = storage_dir / att_key / safe_filename
            if _download_file(pdf_url, dest):
                log.info("PDF saved locally: %s/%s", att_key, safe_filename)
                return True
            log.warning("Local download failed, PDF will need Zotero sync")
        else:
            log.info("Local Zotero storage not found, PDF will need Zotero sync")

    # Step 3: Register file with Zotero API (fallback for cloud sync)
    log.info("PDF attachment created (key: %s), may need Zotero sync for cloud access", att_key)
    return True


def create_zotero_item(
    title: str,
    authors: str,
    abstract: str,
    url: str,
    date: str,
    tags: list[str],
    collection_key: str | None,
    config: dict[str, str],
    skip_duplicate_check: bool = False,
    attach_pdf_url: str | None = None,
) -> dict[str, Any] | None:
    # Duplicate check
    if not skip_duplicate_check:
        existing = check_duplicate(title, config)
        if existing:
            log.warning("Duplicate found: '%s' (key: %s). Skipping.", existing.get("title"), existing.get("key"))
            return {"skipped": True, "existing_key": existing.get("key")}

    arxiv_id = extract_arxiv_id(url)
    creators = parse_authors(authors)

    item: dict[str, Any] = {
        "itemType": "preprint",
        "title": title,
        "creators": creators,
        "abstractNote": abstract,
        "url": url,
        "date": date,
        "repository": "arXiv" if arxiv_id else "",
        "archiveID": f"arXiv:{arxiv_id}" if arxiv_id else "",
        "tags": [{"tag": t} for t in tags],
    }
    if collection_key:
        item["collections"] = [collection_key]

    log.info("Saving: %s", title[:80])
    result = zotero_request("POST", "/items", config, [item])

    # Attach PDF if requested and item was created
    if attach_pdf_url and result and isinstance(result, dict):
        success = result.get("successful", {})
        if success:
            item_key = list(success.values())[0].get("key")
            if item_key:
                attach_pdf(item_key, attach_pdf_url, title, config)

    return result


# ── CLI ──

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Notion Paper Collection → Zotero sync tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""Examples:
  %(prog)s --title "Paper" --authors "First Last" --url URL --collection "AI Review"
  %(prog)s --list-collections
  %(prog)s --check-duplicate --title "Paper Title"
  %(prog)s --version""",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    parser.add_argument("--title", default="", help="Paper title")
    parser.add_argument("--authors", default="", help="Comma-separated authors")
    parser.add_argument("--abstract", default="", help="Paper abstract")
    parser.add_argument("--url", default="", help="Paper URL (arXiv, DOI)")
    parser.add_argument("--date", default="", help="Publication date (YYYY-MM-DD)")
    parser.add_argument("--tags", default="", help="Comma-separated tags")
    parser.add_argument("--collection", default="", help="Zotero collection name")
    parser.add_argument("--collection-key", default="", help="Zotero collection key")
    parser.add_argument("--list-collections", action="store_true", help="List collections and exit")
    parser.add_argument("--check-duplicate", action="store_true", help="Check if title exists in Zotero")
    parser.add_argument("--skip-duplicate-check", action="store_true", help="Skip duplicate checking")
    parser.add_argument("--pdf", default="", help="PDF URL to attach (auto-inferred from arXiv if empty)")
    parser.add_argument("--no-pdf", action="store_true", help="Skip PDF attachment")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable debug logging")
    args = parser.parse_args()

    if args.verbose:
        log.setLevel(logging.DEBUG)

    config = load_zotero_config()

    # List collections
    if args.list_collections:
        collections = list_collections(config)
        for c in collections:
            d = c.get("data", {})
            parent = d.get("parentCollection", "root")
            print(f"  {d.get('name', '?')} (key: {d.get('key', '?')}, parent: {parent})")
        return

    # Check duplicate
    if args.check_duplicate:
        if not args.title:
            log.error("--title required with --check-duplicate")
            sys.exit(1)
        existing = check_duplicate(args.title, config)
        if existing:
            print(f"DUPLICATE: '{existing.get('title')}' (key: {existing.get('key')})")
        else:
            print("NOT FOUND")
        return

    # Save item
    if not args.title or not args.url:
        parser.error("--title and --url are required to save an item")

    collection_key = args.collection_key
    if not collection_key and args.collection:
        collections = list_collections(config)
        collection_key = find_collection_key(args.collection, collections)
        if not collection_key:
            log.error("Collection '%s' not found. Available:", args.collection)
            for c in collections:
                d = c.get("data", {})
                print(f"  {d.get('name', '?')} (key: {d.get('key', '?')})")
            sys.exit(1)

    tags = [t.strip() for t in args.tags.split(",") if t.strip()]

    # Auto-infer PDF URL from arXiv
    pdf_url = args.pdf
    if not pdf_url and not args.no_pdf:
        arxiv_id = extract_arxiv_id(args.url)
        if arxiv_id:
            pdf_url = f"https://arxiv.org/pdf/{arxiv_id}"
            log.info("Auto-inferred PDF URL: %s", pdf_url)

    result = create_zotero_item(
        title=args.title,
        authors=args.authors,
        abstract=args.abstract,
        url=args.url,
        date=args.date,
        tags=tags,
        collection_key=collection_key,
        config=config,
        skip_duplicate_check=args.skip_duplicate_check,
        attach_pdf_url=pdf_url if not args.no_pdf else None,
    )

    if result and isinstance(result, dict):
        if result.get("skipped"):
            print(f"Skipped (duplicate): existing key {result.get('existing_key')}")
            return
        success = result.get("successful", {})
        if success:
            item_data = list(success.values())[0]
            key = item_data.get("key", "?")
            log.info("Saved to Zotero! Item key: %s", key)
            print(f"Saved to Zotero! Item key: {key}")
            if collection_key:
                print(f"Collection: {collection_key}")
        else:
            failed = result.get("failed", {})
            log.error("Failed: %s", json.dumps(failed, indent=2))
            sys.exit(1)
    else:
        log.error("Failed to create item after %d retries.", MAX_RETRIES)
        sys.exit(1)


if __name__ == "__main__":
    main()
