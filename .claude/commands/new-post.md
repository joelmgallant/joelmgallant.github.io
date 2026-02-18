# New Blog Post

Create a new blog post in `content/posts/`.

## Instructions

1. Ask the user for:
   - **Title** (required)
   - **Description** (optional — one-line summary for the blog list page)

2. Generate the filename slug from the title:
   - Lowercase, replace spaces with hyphens, strip non-alphanumeric characters (keep hyphens)
   - Example: "My First Post!" → `my-first-post`

3. Create the file at `content/posts/<slug>.md` with this front matter:

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
   code-insiders . content/posts/<slug>.md
   ```

5. Tell the user the file was created and remind them:
   - `draft: true` means it won't show in production builds
   - Use `hugo server -D` to preview drafts locally
   - Set `draft: false` when ready to publish
