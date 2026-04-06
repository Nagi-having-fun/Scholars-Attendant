---
name: paper-figures
description: "Extract figures from research papers. Use when building Notion blog pages or when user asks about paper figures."
---

# Paper Figures (Claude Code Adaptation)

## Figure Sources (Priority Order)

| Source | Method | Reliability |
|---|---|---|
| arXiv HTML | `WebFetch` + extract `<img>` tags | High for papers with HTML |
| ar5iv | `WebFetch` on `ar5iv.labs.arxiv.org/html/{ID}` | Good fallback |
| GitHub repo | `web_search_exa` for repo, then extract README figures | Good for popular papers |

## Workflow

### 1. Fetch arXiv HTML

```
WebFetch on: https://arxiv.org/html/{PAPER_ID}v{VERSION}/
Prompt: "List ALL image URLs (img src) with figure numbers and captions."
```

### 2. Construct Full URLs

Relative paths like `x1.png` → `https://arxiv.org/html/{PAPER_ID}v{VERSION}/x1.png`
Nested paths like `extracted/123/figures/fig.png` → full URL with base

### 3. Verify URLs

```bash
curl -sL -o /dev/null -w "%{http_code} %{size_download}" "URL"
```

- HTTP 200 + >10KB = valid
- <10KB = likely arXiv HTML fragment, reject

### 4. Embed in Notion

Use standard markdown image syntax:
```markdown
![Figure N: Caption text](https://arxiv.org/html/.../xN.png)
```

## Important Notes

- Capture EVERY figure in the paper, not a fixed count
- arXiv HTML often splits composite figures into tiny fragments — verify size
- If no arXiv HTML exists, try ar5iv as fallback
- GitHub repos often have high-quality figures in README
