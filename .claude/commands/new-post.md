# New Blog Post

Create a new blog post as a Hugo page bundle in `content/posts/`.

## Instructions

1. Ask the user for:
   - **Title** (required)
   - **Description** (optional — one-line summary for the blog list page)

2. Generate the directory name from the title:
   - Prefix with today's date in YYYY-MM-DD format
   - Slugify the title: lowercase, replace spaces with hyphens, strip non-alphanumeric characters (keep hyphens)
   - Format: `<YYYY-MM-DD>-<slug>`
   - Example: "My First Post!" on Feb 18, 2026 → `2026-02-18-my-first-post`

3. Create the directory and file at `content/posts/<YYYY-MM-DD>-<slug>/index.md` with this front matter:

```markdown
---
title: "<title>"
date: <today's date in YYYY-MM-DD format>
description: "<description if provided>"
draft: true
---

```

4. Open the project workspace and the new file in VS Code Insiders:
   ```
   code-insiders . content/posts/<YYYY-MM-DD>-<slug>/index.md
   ```

5. Tell the user the file was created and remind them:
   - `draft: true` means it won't show in production builds
   - Use `hugo server -D` to preview drafts locally
   - Set `draft: false` when ready to publish
   - Drop images into the post's directory and reference them with relative paths: `![alt](image.png)`
