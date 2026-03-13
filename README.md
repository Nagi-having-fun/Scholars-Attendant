# Scholars-Attendant (Paper Collector)

An [OpenClaw](https://github.com/openclaw/openclaw) plugin that automatically detects research paper URLs from various platforms and saves structured metadata to a Notion database.

## Features

- **Multi-platform URL detection**: Supports arXiv, Xiaohongshu, WeChat, X/Twitter, GitHub, and more
- **Image-based paper inference**: When a page lacks text-based paper info (common on social media), the plugin analyzes images — paper screenshots, architecture diagrams, figure reproductions — to identify and search for the paper
- **Structured metadata extraction**: Title, authors, institution, summary, contributions, tags
- **Notion integration**: Auto-saves to a Notion database with deduplication
- **Multi-language support**: Handles Chinese/English content, always extracts English paper titles

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
2. Plugin fetches and evaluates the content via `web_fetch`
3. If text content is insufficient (blocked by anti-scraping, login walls, etc.):
   - Falls back to browser screenshots
   - **Extracts and analyzes page images** (og:image, embedded figures, etc.) to identify paper clues
   - Uses visual clues (paper titles in screenshots, architecture diagrams, figure captions, arXiv IDs) to search for the paper
4. Extracts structured metadata (title, authors, institution, summary, tags, etc.)
5. Saves to Notion database with duplicate checking

### Image-Based Inference Flow

Many social media posts (Xiaohongshu, WeChat, X) discuss papers primarily through images rather than text. The plugin handles this by:

1. **Extracting images** from HTML via `extract_page_images` tool (parses `og:image`, `<img src>`, `data-src`)
2. **Visually analyzing** each image for paper identifiers:
   - Paper titles visible in screenshots
   - arXiv IDs (e.g., `arXiv:2301.12345`)
   - Architecture/method names in diagrams
   - Author names, conference badges, DOIs
   - Figure captions and table headers
3. **Searching** with extracted clues via `web_search`
4. **Verifying** by fetching the actual paper page for accurate metadata

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

## Tools

| Tool | Description |
|------|-------------|
| `notion_save_paper` | Save a paper's structured metadata to the Notion database |
| `notion_setup` | One-time setup: create the Paper Collection database in Notion |
| `extract_page_images` | Extract image URLs from HTML for visual paper identification |

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
│   ├── notion-tools.ts       # Tool definitions (save_paper, setup, extract_images)
│   └── image-extract.ts      # HTML image URL extraction utilities
└── skills/
    └── paper-collector/
        └── SKILL.md           # AI skill definition for URL handling & image inference
```

## License

MIT
