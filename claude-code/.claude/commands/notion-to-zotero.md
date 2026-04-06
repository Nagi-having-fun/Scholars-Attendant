# Batch Sync Notion → Zotero

Sync all papers from a Notion database table to a Zotero collection, skipping duplicates.

## Input

$ARGUMENTS — Notion database name or URL, and target Zotero collection name

Example: `/notion-to-zotero Unlearning → Unlearning`

## Instructions

1. Parse arguments to get source Notion database/table and target Zotero collection.

2. Search Notion for the database:
   ```
   notion-search query="<database name>"
   ```
   Fetch the data source to get the schema and paper list.

3. Get existing Zotero items in the target collection:
   ```bash
   curl -s "https://api.zotero.org/users/<USER_ID>/collections/<COLLECTION_KEY>/items?limit=100&format=json" \
     -H "Zotero-API-Key: <KEY>" -H "Zotero-API-Version: 3"
   ```
   Build a set of existing titles for dedup.

4. For each paper in Notion that doesn't exist in Zotero, use the script:
   ```bash
   python3 <repo>/claude-code/scripts/notion-to-zotero.py \
     --title "..." --authors "..." --url "..." --date "..." --tags "..." \
     --collection "Collection Name"
   ```
   Or batch them via direct API calls for efficiency.

5. If the Zotero collection doesn't exist, create it:
   ```bash
   curl -s -X POST "https://api.zotero.org/users/<USER_ID>/collections" \
     -H "Zotero-API-Key: <KEY>" -H "Zotero-API-Version: 3" \
     -H "Content-Type: application/json" \
     -d '[{"name": "<name>", "parentCollection": "<parent_key or false>"}]'
   ```

6. Report: X papers synced, Y skipped (duplicates), Z failed.
