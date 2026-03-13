# Scholars-Attendant (Paper Collector)

An [OpenClaw](https://github.com/openclaw/openclaw) plugin that automatically detects research paper URLs from various platforms and saves structured metadata to a Notion database.

## Supported Platforms

- arXiv
- Xiaohongshu (小红书)
- WeChat articles (微信公众号)
- X / Twitter
- GitHub
- Google Scholar, Semantic Scholar, PapersWithCode, HuggingFace
- Academic conference sites (NeurIPS, ICML, ICLR, ACL, CVPR, AAAI, etc.)
- Any URL containing research paper references

## How It Works

1. User sends a URL in a message
2. Plugin fetches and evaluates the content
3. If research-related, extracts metadata (title, authors, institution, summary, tags, etc.)
4. Saves structured entry to a Notion database
5. Deduplicates by source URL

## Setup

### 1. Create a Notion Integration

1. Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Create a new internal integration
3. Copy the **Internal Integration Secret**

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your Notion token
```

Or set the environment variable directly:

```bash
export NOTION_API_TOKEN=your_token_here
```

### 3. Create the Database

Use the `notion_setup` tool with a `parent_page_id` to create the Paper Collection database in Notion. Make sure to share the parent page with your integration first.

### 4. Install as OpenClaw Plugin

Add this plugin to your OpenClaw configuration and set the `databaseId` in the plugin config.

## Notion Database Schema

| Property      | Type         | Description                          |
|---------------|--------------|--------------------------------------|
| Title         | Title        | Paper title                          |
| Authors       | Rich Text    | Comma-separated author names         |
| Institution   | Rich Text    | Primary institution/affiliation      |
| Published     | Date         | Publication date                     |
| Source URL    | URL          | Original URL shared by user          |
| Paper URL     | URL          | Direct link to paper (arXiv, DOI)    |
| Summary       | Rich Text    | One-sentence summary                 |
| Contributions | Rich Text    | Main contributions (2-3 sentences)   |
| Tags          | Multi-select | Research area tags (English)         |
| Status        | Select       | Unread / Reading / Read              |

## Project Structure

```
├── index.ts                  # Plugin entry point
├── openclaw.plugin.json      # Plugin manifest
├── package.json
├── src/
│   ├── config.ts             # Configuration parser
│   ├── types.ts              # TypeScript type definitions
│   ├── notion-client.ts      # Notion API client
│   └── notion-tools.ts       # Tool definitions (save_paper, setup)
└── skills/
    └── paper-collector/
        └── SKILL.md           # AI skill definition for URL handling
```

## License

MIT
