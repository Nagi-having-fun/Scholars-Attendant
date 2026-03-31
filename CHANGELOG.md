# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-03-31

### Features
- PDF local download: downloads PDFs directly to `~/Zotero/storage/<KEY>/` so they open in Zotero's built-in reader without cloud sync
- Auto-detects local Zotero storage directory (macOS/Linux defaults, or `ZOTERO_STORAGE` env var)
- Falls back to cloud-only attachment if local storage not found

### Fixes
- PDF attachments now use `imported_url` mode + local file, not `linked_url` (which just opens browser)
- File download includes retry logic with exponential backoff

### Design Rationale
- Local-first approach: PDFs are downloaded to the exact directory Zotero expects, so no sync delay
- Zero-dependency: uses only Python stdlib (urllib, hashlib, pathlib)

## [1.1.0] - 2026-03-31

### Features
- Zotero integration: sync papers from Notion to Zotero collections
  - `/zotero-setup`, `/zotero`, `/notion-to-zotero` commands
  - `notion-to-zotero.py` script with retry logic, logging, and smart author parsing
  - Duplicate checking before save (title-normalized matching)
  - Batch sync with dedup across Notion tables → Zotero collections
- Claude Code plug-and-play setup
  - `CLAUDE.md` auto-loaded by Claude Code with full workflow instructions
  - `/paper-setup` for first-time Notion configuration
  - `/paper <url>` for one-command paper collection pipeline
- Security audit tooling: git history scan, public repo credential check

### Fixes
- Author name parsing handles multi-word surnames (van der Berg, El Mhamdi, etc.)
- Duplicate detection uses normalized title comparison (strips punctuation)
- Zotero API calls include retry with exponential backoff and rate-limit handling

### Design Rationale
- Claude Code adaptation uses native Notion MCP + WebFetch tools instead of OpenClaw custom tools
- Zotero script is zero-dependency (Python stdlib only) for maximum portability
- Skills and commands separated: skills/ for reference docs, .claude/commands/ for executable workflows

## [1.0.0] - 2026-03-25

### Features
- Core paper collection pipeline: URL → metadata → Notion database
- 5 AI skills: paper-collector, alphaxiv-lookup, paper-parse, paper-figures, paper-to-notion
- Multi-platform URL detection (arXiv, Xiaohongshu, WeChat, X/Twitter, GitHub, conference sites)
- Image-based paper inference for JS-heavy pages
- Blog-style Notion pages with KaTeX equations, embedded figures, tables
- Chinese translation sub-pages (full mirror, not summary)
- Quality gate: rejects content under 25 blocks
- Markdown → Notion block converter (headings, equations, images, tables, callouts, toggles)
- Notion database with dedup checking
- Progress reporting at each workflow step

### Notes & Caveats
- OpenClaw plugin format — requires OpenClaw runtime for TypeScript tools
- Claude Code users should use the `claude-code/` directory instead
