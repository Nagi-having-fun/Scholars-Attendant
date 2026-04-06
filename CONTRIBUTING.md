# Contributing to Scholars-Attendant

Thanks for your interest in contributing! This guide covers the project structure and how to add or improve features.

## Project Structure

```
├── src/                    # OpenClaw TypeScript plugin code
├── skills/                 # OpenClaw AI skill definitions
├── claude-code/            # Claude Code adaptation
│   ├── CLAUDE.md           # Auto-loaded workflow instructions
│   ├── .claude/commands/   # Slash commands (/paper, /zotero, etc.)
│   ├── scripts/            # Standalone Python scripts
│   └── skills/             # Claude Code skill references
├── CHANGELOG.md            # Version history
└── README.md               # User-facing documentation
```

## Development Setup

### OpenClaw Plugin
```bash
# Requires OpenClaw runtime
npm install
# Plugin is loaded by OpenClaw automatically
```

### Claude Code
```bash
cd claude-code
claude
/paper-setup    # Configure Notion
/zotero-setup   # Configure Zotero
```

### Python Scripts
```bash
# Zero dependencies — uses Python 3.10+ stdlib only
python3 claude-code/scripts/notion-to-zotero.py --help
```

## How to Contribute

### Adding a New Skill
1. Create `skills/<skill-name>/SKILL.md` for OpenClaw
2. Create `claude-code/skills/<skill-name>.md` for Claude Code
3. Update README.md with the new skill
4. Add a CHANGELOG entry

### Improving the Zotero Script
- Keep it zero-dependency (stdlib only)
- Add tests for author parsing edge cases
- Handle new author name formats in `_PREFIXES`

### Reporting Issues
- Use the issue templates in `.github/ISSUE_TEMPLATE/`
- Include your environment: OpenClaw version or Claude Code version
- For paper parsing issues: include the URL that failed

## Code Style

- **TypeScript**: Follow existing style in `src/`
- **Python**: PEP 8, type annotations on all functions
- **Markdown skills**: YAML frontmatter + clear workflow steps

## Commit Messages

Follow conventional commits:
```
feat: add new feature
fix: fix a bug
docs: update documentation
refactor: restructure code without changing behavior
```

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
