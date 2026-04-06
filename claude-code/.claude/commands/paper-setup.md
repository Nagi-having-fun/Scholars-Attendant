# Paper Collection Setup

Guide the user through first-time setup for the Scholars-Attendant paper collection pipeline.

## Steps

### 1. Check Notion MCP Connection

Verify the Notion MCP is available by running:
```
notion-search with query "test" to confirm access
```

If not connected, tell the user:
"You need the Notion MCP server connected. If you're using Claude Code on claude.ai, it should be available automatically. Otherwise, check your MCP server configuration."

### 2. Find or Create Paper Collection Database

Search Notion for an existing "Paper Collection" database:
```
notion-search query="Paper Collection"
```

**If found:** Fetch it to get the data_source_id:
```
notion-fetch id="<database_id>"
```
Extract the data_source_id from `<data-source url="collection://...">` tags.

**If not found:** Ask the user for a parent page ID (or create at workspace level), then create the database:
```
notion-create-database with:
  title: "Paper Collection"
  schema: CREATE TABLE (
    "Title" TITLE,
    "Authors" RICH_TEXT,
    "Institution" MULTI_SELECT('MIT':blue, 'CMU':red, 'Stanford':green, 'Google':yellow, 'Meta':purple),
    "Published" DATE,
    "Source URL" URL,
    "Paper URL" URL,
    "Summary" RICH_TEXT,
    "Contributions" RICH_TEXT,
    "Tags" MULTI_SELECT('LLM':blue, 'NLP':green, 'HCI':purple, 'survey':gray, 'deep learning':orange),
    "Conference" SELECT('ICLR 2025':blue, 'NeurIPS 2024':green, 'ICML 2024':purple, 'ACL 2025':orange),
    "Status" SELECT('Unread':red, 'Reading':yellow, 'Read':green)
  )
```

### 3. Save Configuration

Write the config file:
```json
// ~/.scholars-attendant/config.json
{
  "database_id": "<database_id>",
  "data_source_id": "<data_source_id>"
}
```

Create with:
```bash
mkdir -p ~/.scholars-attendant
cat > ~/.scholars-attendant/config.json << EOF
{
  "database_id": "<ID>",
  "data_source_id": "<ID>"
}
EOF
```

### 4. Confirm Setup

Tell the user:
"Setup complete! Your Paper Collection database is ready. Send me any paper URL and I'll run the full pipeline: metadata → Notion → English blog page → Chinese translation."
