# Save to Zotero

Save a paper from the Notion Paper Collection to a Zotero collection.

## Input

$ARGUMENTS — either a paper title to search in Notion, or "list" to show Zotero collections

## Instructions

### If arguments is "list"
Run: `python3 <repo>/claude-code/scripts/notion-to-zotero.py --list-collections --title x --authors x --url x`
Show the user their Zotero collections.

### If arguments is a paper title or URL

1. Search for the paper in Notion:
   ```
   notion-search query="<paper title>"
   ```

2. Fetch the page to get metadata:
   ```
   notion-fetch id="<page_id>"
   ```
   Extract: Title, Authors, Summary, Paper URL, Published date, Tags

3. Ask the user which Zotero collection to save to (show the list). If they already specified one, use it.

4. Run the script:
   ```bash
   python3 <repo>/claude-code/scripts/notion-to-zotero.py \
     --title "Paper Title" \
     --authors "Author1, Author2" \
     --abstract "Summary text" \
     --url "https://arxiv.org/abs/..." \
     --date "YYYY-MM-DD" \
     --tags "tag1,tag2" \
     --collection "Collection Name"
   ```

5. Report success with the Zotero item key.

### Auto-save after paper collection

When running the `/paper` pipeline, after Step 7 (Chinese subpage), ask the user:
"Want to save this to Zotero too? Which collection?"
Then run the zotero script with the extracted metadata.
