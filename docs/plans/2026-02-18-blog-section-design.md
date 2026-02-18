# Blog Section Design

## Goal

Add a blog section to joelmgallant.com for mixed personal and technical content. Chronological post listing, clean reading experience, consistent visual style with the existing site.

## Decisions

- **Content type**: Mixed personal + tech (casual, flexible format)
- **Navigation**: Blog link added to the actions section on homepage (alongside CV link)
- **Organization**: Chronological only (no tags/categories — YAGNI)
- **Architecture**: Shared base template (`baseof.html`) to keep styling DRY

## Architecture

### Base Template Refactor

Create `layouts/_default/baseof.html` extracting shared elements from `layouts/index.html`:

- `<head>`: meta tags, fonts (Roboto, Jura), normalize.css, Font Awesome, Hugo Pipes SCSS, favicons
- Body: gradient background (`linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab)`)
- `.wrap`: glassmorphism card (white bg, blur, border-radius, box-shadow)
- Footer partial
- Block definitions: `{{ block "head" . }}` for page-specific styles, `{{ block "main" . }}` for content, `{{ block "scripts" . }}` for page-specific JS

Refactor `layouts/index.html` to use `{{ define "main" }}` blocks while preserving all existing homepage functionality (stats, rotating quotes, typewriter effect, count-up animations).

### Blog List Page — `layouts/posts/list.html`

- URL: `/posts/`
- Iterates `.Pages` sorted by date (descending) — Hugo default
- Each entry: title (linked), date, description/summary
- Entries separated by subtle dividers inside the glassmorphism card
- "Back to home" link at top
- Responsive layout

### Blog Single Post — `layouts/posts/single.html`

- Post title, formatted date, estimated reading time
- Rendered markdown content with typography styles for: headings, paragraphs, code blocks, blockquotes, images, lists, links
- Code syntax highlighting via Hugo's built-in Chroma
- "Back to blog" link at top
- No sidebar, no clutter

### Homepage Integration

- Add `blog.name = "Blog"` and `blog.url = "/posts/"` to `[params.actions]` in `config.toml`
- No other homepage changes

### Content Structure

Posts in `content/posts/` with front matter:

```yaml
---
title: "Post Title"
date: 2026-02-18
description: "Brief summary for the list page"
draft: false
---
```

One sample post created to validate the templates.

## What's NOT In Scope

- Tags, categories, or taxonomies
- RSS feed (can add later)
- Search functionality
- Comments system
- Pagination (not needed until 10+ posts)
