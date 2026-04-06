# Collect Paper

Run the full paper collection pipeline on the provided URL or paper title.

## Input

$ARGUMENTS — a URL or paper title to process

## Instructions

1. Read config from `~/.scholars-attendant/config.json`. If missing, run `/paper-setup` first.
2. Follow the workflow in CLAUDE.md exactly:
   - Step 1: Fetch & identify the paper from the URL or title
   - Step 2: Extract metadata
   - Step 3: Save to Notion database
   - Step 4: Fetch all figures from arXiv HTML
   - Step 5: Fetch paper content from AlphaXiv
   - Step 6: Write English blog page (with REAL newlines, all figures)
   - Step 7: Create Chinese translation subpage
   - Step 8: Report results with Notion link
3. Send progress updates at each major step.
4. Never silently fail — report errors with what went wrong and what fallback was taken.
