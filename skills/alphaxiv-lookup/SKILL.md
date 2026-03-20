---
name: alphaxiv-lookup
description: Look up any arXiv paper on alphaxiv.org for a structured AI-generated overview. Use when the user shares an arXiv URL, paper ID, or asks to explain/summarize a research paper. Faster and more reliable than reading raw PDFs.
---

# AlphaXiv Paper Lookup

Fetch a structured, machine-readable analysis of any arXiv paper from alphaxiv.org. This is the preferred first step before parsing PDFs or fetching raw paper text.

## When to Use

- User shares an arXiv URL (e.g. `arxiv.org/abs/2401.12345`)
- User mentions a paper ID (e.g. `2401.12345`)
- User asks to explain, summarize, or analyze a research paper
- User shares an AlphaXiv URL (e.g. `alphaxiv.org/overview/2401.12345`)
- Before running `paper-parse` or `paper-to-notion` — always try AlphaXiv first for a structured overview

## Workflow

### Step 1: Extract the paper ID

| Input | Paper ID |
|---|---|
| `https://arxiv.org/abs/2401.12345` | `2401.12345` |
| `https://arxiv.org/pdf/2401.12345` | `2401.12345` |
| `https://alphaxiv.org/overview/2401.12345` | `2401.12345` |
| `2401.12345v2` | `2401.12345v2` |
| `2401.12345` | `2401.12345` |

### Step 2: Fetch the machine-readable report

Use `web_fetch` on:

```
https://alphaxiv.org/overview/{PAPER_ID}.md
```

This returns a structured, detailed analysis optimized for LLM consumption. One call, plain markdown, no JSON parsing.

If this returns 404, the report hasn't been generated yet — proceed to Step 3.

### Step 3: If more detail is needed, fetch the full paper text

If the report doesn't contain specific information the user needs (e.g. a particular equation, table, or section):

```
https://alphaxiv.org/abs/{PAPER_ID}.md
```

This returns the full extracted text of the paper as markdown. Only use this as a fallback.

If this also returns 404, fall back to the PDF at `https://arxiv.org/pdf/{PAPER_ID}`.

## Integration with other skills

- After fetching the overview, you can use `paper-parse` for detailed formula/table extraction
- Use `paper-figures` to save the paper's figures
- Use `paper-to-notion` to create a full blog-style Notion page from the paper
- Use `paper-collector` (notion_save_paper) to save the paper's metadata to the database

## Error Handling

- **404 on Step 2**: Report not generated — try Step 3
- **404 on Step 3**: Full text not extracted — fall back to PDF
- No authentication required — these are public endpoints

## Notes

- Always try AlphaXiv before attempting to parse a PDF directly
- The machine-readable report typically includes: abstract, key contributions, methodology, results, limitations, and related work
- If you need to cite specific equations or figures, use `paper-parse` after getting the overview
