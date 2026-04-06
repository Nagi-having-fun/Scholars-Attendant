# Zotero Setup

Guide the user through first-time Zotero API configuration.

## Steps

### 1. Get API Credentials

Tell the user:
"To connect Zotero, I need two things:
1. Go to https://www.zotero.org/settings/keys
2. Your **User ID** is shown at the top of that page
3. Click **Create new private key**, name it 'Scholars-Attendant'
4. Check **Allow library access** and **Allow write access**
5. Save and copy the key

Send me both your User ID and API key."

### 2. Save Configuration

Once the user provides both:
```bash
mkdir -p ~/.scholars-attendant
cat > ~/.scholars-attendant/zotero.json << EOF
{
  "api_key": "<KEY>",
  "user_id": "<ID>"
}
EOF
chmod 600 ~/.scholars-attendant/zotero.json
```

### 3. Verify Connection

```bash
python3 <repo>/claude-code/scripts/notion-to-zotero.py --list-collections --title x --authors x --url x
```

Show the user their collections to confirm it works.

### 4. Confirm

"Zotero connected! You have N collections. Use `/zotero <paper title>` to save papers, or I'll offer to save after each `/paper` run."
