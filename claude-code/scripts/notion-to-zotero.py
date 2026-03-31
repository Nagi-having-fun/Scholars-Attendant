#!/usr/bin/env python3
"""
Notion Paper Collection → Zotero sync tool.

Usage:
    python3 notion-to-zotero.py --paper-url "https://arxiv.org/abs/2310.07127" --collection "AI Review"
    python3 notion-to-zotero.py --paper-url "https://arxiv.org/abs/2310.07127" --collection-key "2XHLMFQW"

Reads Zotero credentials from ~/.scholars-attendant/zotero.json
"""

import argparse
import json
import re
import sys
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any


def load_zotero_config() -> dict[str, str]:
    config_path = Path.home() / ".scholars-attendant" / "zotero.json"
    if not config_path.exists():
        print("Error: ~/.scholars-attendant/zotero.json not found.")
        print("Run /paper-setup or create it with your api_key and user_id.")
        sys.exit(1)
    with open(config_path) as f:
        return json.load(f)


def zotero_request(
    method: str,
    path: str,
    config: dict[str, str],
    data: Any | None = None,
) -> Any:
    url = f"https://api.zotero.org/users/{config['user_id']}{path}"
    headers = {
        "Zotero-API-Key": config["api_key"],
        "Zotero-API-Version": "3",
        "Content-Type": "application/json",
    }
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            if resp.status in (200, 201):
                return json.loads(resp.read())
            return None
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"Zotero API error {e.code}: {error_body}")
        return None


def list_collections(config: dict[str, str]) -> list[dict[str, Any]]:
    return zotero_request("GET", "/collections?limit=100", config) or []


def find_collection_key(
    name: str, collections: list[dict[str, Any]]
) -> str | None:
    name_lower = name.lower()
    for c in collections:
        if c.get("data", {}).get("name", "").lower() == name_lower:
            return c["data"]["key"]
    return None


def extract_arxiv_id(url: str) -> str | None:
    m = re.search(r"(\d{4}\.\d{4,5})(v\d+)?", url)
    return m.group(1) if m else None


def create_zotero_item(
    title: str,
    authors: str,
    abstract: str,
    url: str,
    arxiv_id: str | None,
    date: str,
    tags: list[str],
    collection_key: str | None,
    config: dict[str, str],
) -> dict[str, Any] | None:
    creators = []
    for name in authors.split(","):
        name = name.strip()
        if not name:
            continue
        parts = name.rsplit(" ", 1)
        if len(parts) == 2:
            creators.append({
                "creatorType": "author",
                "firstName": parts[0],
                "lastName": parts[1],
            })
        else:
            creators.append({
                "creatorType": "author",
                "lastName": name,
                "firstName": "",
            })

    item: dict[str, Any] = {
        "itemType": "preprint",
        "title": title,
        "creators": creators,
        "abstractNote": abstract,
        "url": url,
        "date": date,
        "repository": "arXiv",
        "archiveID": f"arXiv:{arxiv_id}" if arxiv_id else "",
        "tags": [{"tag": t} for t in tags],
    }
    if collection_key:
        item["collections"] = [collection_key]

    result = zotero_request("POST", "/items", config, [item])
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Save paper to Zotero")
    parser.add_argument("--title", required=True, help="Paper title")
    parser.add_argument("--authors", required=True, help="Comma-separated authors")
    parser.add_argument("--abstract", default="", help="Paper abstract")
    parser.add_argument("--url", required=True, help="Paper URL (arXiv, DOI)")
    parser.add_argument("--date", default="", help="Publication date (YYYY-MM-DD)")
    parser.add_argument("--tags", default="", help="Comma-separated tags")
    parser.add_argument("--collection", default="", help="Zotero collection name")
    parser.add_argument("--collection-key", default="", help="Zotero collection key")
    parser.add_argument("--list-collections", action="store_true", help="List collections and exit")
    args = parser.parse_args()

    config = load_zotero_config()

    if args.list_collections:
        collections = list_collections(config)
        for c in collections:
            d = c.get("data", {})
            print(f"  {d.get('name', '?')} (key: {d.get('key', '?')})")
        return

    collection_key = args.collection_key
    if not collection_key and args.collection:
        collections = list_collections(config)
        collection_key = find_collection_key(args.collection, collections)
        if not collection_key:
            print(f"Collection '{args.collection}' not found. Available:")
            for c in collections:
                d = c.get("data", {})
                print(f"  {d.get('name', '?')} (key: {d.get('key', '?')})")
            sys.exit(1)

    arxiv_id = extract_arxiv_id(args.url)
    tags = [t.strip() for t in args.tags.split(",") if t.strip()]

    result = create_zotero_item(
        title=args.title,
        authors=args.authors,
        abstract=args.abstract,
        url=args.url,
        arxiv_id=arxiv_id,
        date=args.date,
        tags=tags,
        collection_key=collection_key,
        config=config,
    )

    if result and isinstance(result, dict):
        success = result.get("successful", {})
        if success:
            item_data = list(success.values())[0]
            key = item_data.get("key", "?")
            print(f"Saved to Zotero! Item key: {key}")
            if collection_key:
                print(f"Collection: {collection_key}")
        else:
            failed = result.get("failed", {})
            print(f"Failed: {json.dumps(failed, indent=2)}")
    else:
        print("Failed to create item.")


if __name__ == "__main__":
    main()
