---
name: alphaxiv-lookup
description: "Fetch AI-generated structured paper analysis from alphaxiv.org. Use when the user asks to explain or summarize an arXiv paper."
---

# AlphaXiv Lookup (Claude Code Adaptation)

## When to Use

- User shares an arXiv URL and wants a summary
- You need structured content for a paper blog page
- Faster and more reliable than parsing raw PDFs

## Workflow

### 1. Extract Paper ID

From various URL formats:
- `arxiv.org/abs/2401.12345` → `2401.12345`
- `arxiv.org/pdf/2401.12345` → `2401.12345`
- `alphaxiv.org/overview/2401.12345` → `2401.12345`

### 2. Fetch Overview

```
WebFetch on: https://alphaxiv.org/overview/{PAPER_ID}.md
Prompt: "Return the complete content. All sections, all analysis. Do not summarize."
```

### 3. Fetch Full Text (if more detail needed)

```
WebFetch on: https://alphaxiv.org/abs/{PAPER_ID}.md
Prompt: "Return complete content with all tables and data."
```

### 4. Fallback

If AlphaXiv returns 404:
- Fetch arXiv abstract: `WebFetch` on `https://arxiv.org/abs/{PAPER_ID}`
- Fetch arXiv HTML: `WebFetch` on `https://arxiv.org/html/{PAPER_ID}v1`
