# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal portfolio/identity website for Joel Gallant, hosted at **joelmgallant.com** via GitHub Pages. Built with Hugo using the `awesome-identity` theme (a single-page identity/portfolio theme).

## Build & Development Commands

```bash
# Local dev server (hot reload on http://localhost:1313)
hugo server

# Production build (outputs to ./public)
hugo --minify

# Production build with custom base URL (used in CI)
hugo --minify --baseURL "https://joelmgallant.com/"
```

Hugo version in CI: **0.102.3** (extended). Local Homebrew version may be newer — be aware of potential incompatibilities.

There are no tests, linters, or formatters configured for this project.

## Architecture

### Hugo Structure

- **`config.toml`** — Site config: base URL, title, profile info (name, bio, title), contact links, footer. This is the primary file for content changes.
- **`layouts/index.html`** — **Heavily customized** homepage that overrides the theme's `index.html`. Contains all custom CSS (glassmorphism, animations, stats section) and JavaScript (typewriter effect, rotating quotes, count-up animations) inline. This is where most site behavior lives.
- **`layouts/_default/single.html`** — Minimal single-page layout for content pages.
- **`themes/awesome-identity/`** — Base theme (vendored, not a submodule). Provides partials (`profile.html`, `contacts.html`, `actions.html`, `footer.html`, `opengraph.html`), SCSS assets, and the foundational layout.
- **`content/posts/`** — Markdown content pages (currently minimal).
- **`static/`** — Static assets served at site root (images, favicon files, `manifest.json`, resume PDF).

### Theme Override Pattern

The site uses Hugo's standard lookup order: files in the root `layouts/` directory override same-path files in `themes/awesome-identity/layouts/`. The homepage (`layouts/index.html`) is a full override that inlines all custom styling and interactivity while still using the theme's partials via `{{ partial "..." . }}`.

### Styling

- Theme base styles: `themes/awesome-identity/assets/sass/` (SCSS compiled by Hugo Pipes)
- Custom styles: inline `<style>` block in `layouts/index.html` (gradient background, glassmorphism cards, animations, responsive breakpoints)

## Deployment

- **Branch**: `trunk` (not `main`/`master`)
- **Method**: GitHub Actions workflow (`.github/workflows/hugo.yml`) builds and deploys to GitHub Pages on push to `trunk`
- **Custom domain**: `joelmgallant.com` (configured via `CNAME` file)

## Key Customizations in layouts/index.html

- Gradient background with glassmorphism card effect
- Animated stats section (years experience, team size, technologies, coffee)
- Rotating tagline quotes showcasing career highlights (Fisher-Yates shuffle, no-repeat cycling)
- Typewriter effect on profile title
- Count-up number animations with IntersectionObserver
- Hover effects on social links and profile portrait
