# Blog Section Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a blog section to joelmgallant.com with shared base template, post listing, and single post view — all matching the existing glassmorphism/gradient design.

**Architecture:** Extract shared HTML structure (head, gradient background, glassmorphism card, footer) into `baseof.html`. Homepage, blog list, and blog single all inherit from it via Hugo's `{{ define }}` blocks. Blog link added to homepage actions section.

**Tech Stack:** Hugo (static site generator), Hugo Pipes (SCSS), Chroma (syntax highlighting), HTML/CSS/JS

---

### Task 1: Create the base template

**Files:**
- Create: `layouts/_default/baseof.html`

**Step 1: Create `layouts/_default/baseof.html`**

This extracts all the shared HTML from the current `layouts/index.html`: the `<head>` (meta, fonts, stylesheets, favicons), the gradient background style, glassmorphism `.wrap` style, and the footer partial. It defines three blocks for child templates to fill: `head` (extra styles), `main` (page content), and `scripts` (page JS).

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="content-type" content="text/html; charset=utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
{{ partial "opengraph.html" . }}
{{ with .Site.Params.meta.description }}
    <meta name="description" content="{{ . }}" />
{{ end }}
{{ with .Site.Params.meta.keywords }}
    <meta name="keywords" content="{{ . }}" />
{{ end }}
    <base href="{{ .Site.BaseURL }}">
    <title>{{ if not .IsHome }}{{ .Title }} | {{ end }}{{ .Site.Title }}</title>

    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/normalize.css@8.0.1/normalize.css">
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.7.2/css/all.css" integrity="sha384-fnmOCqbTlWIlj8LyTjo7mOUStjsKC4pOpQbqyi7RrhN7udi9RwhKkMHpvLbHG9Sr" crossorigin="anonymous">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto:100,700">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Jura:400,700">

{{ $options := (dict "targetPath" "css/style.css" "outputStyle" "compressed") }}
{{ $style := resources.Get "sass/main.scss" | toCSS $options | fingerprint }}
    <link rel="stylesheet" href="{{ $style.RelPermalink }}">

    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="manifest" href="/manifest.json">

    <style>
      body {
        background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
        background-attachment: fixed;
        background-size: cover;
        background-repeat: no-repeat;
        min-height: 100vh;
      }

      .wrap {
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border-radius: 20px;
        padding: 3em 2em;
        box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
        border: 1px solid rgba(255, 255, 255, 0.18);
        margin: 0.75em;
        width: calc(100% - 1.5em);
        box-sizing: border-box;
      }

      @media (max-width: 768px) {
        .wrap {
          padding: 2em 1.5em;
        }
      }
    </style>
{{ block "head" . }}{{ end }}
  </head>
  <body>
    <div class="wrap">
{{ block "main" . }}{{ end }}
    </div>
{{ partial "footer.html" . }}
{{ block "scripts" . }}{{ end }}
  </body>
</html>
```

**Step 2: Verify Hugo still builds**

Run: `hugo`
Expected: Build succeeds. The homepage still renders from `layouts/index.html` (which is still a full HTML document at this point, so Hugo ignores `baseof.html` for it).

**Step 3: Commit**

```bash
git add layouts/_default/baseof.html
git commit -m "Add base template with shared head, gradient, and glassmorphism"
```

---

### Task 2: Refactor homepage to use base template

**Files:**
- Modify: `layouts/index.html` (complete rewrite to use `{{ define }}` blocks)

**Step 1: Rewrite `layouts/index.html`**

Replace the entire file. It now uses `{{ define "head" }}`, `{{ define "main" }}`, and `{{ define "scripts" }}` blocks instead of being a standalone HTML document. All homepage-specific CSS goes in `head`, the page content goes in `main`, and the JS goes in `scripts`.

```html
{{ define "head" }}
    <style>
      /* Typewriter effect */
      .typewriter {
        overflow: hidden;
        white-space: nowrap;
        margin: 0 auto;
        animation: typing 3.5s steps(40, end), blink-caret .75s step-end infinite;
      }

      @keyframes typing {
        from { width: 0 }
        to { width: 100% }
      }

      @keyframes blink-caret {
        from, to { border-color: transparent }
        50% { border-color: #333; }
      }

      /* Enhanced hover effects for social links */
      .contacts a {
        transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        display: inline-block;
        color: #333;
        opacity: 0.9;
      }

      .contacts a i {
        color: #333;
      }

      .contacts a:hover {
        transform: translateY(-5px) scale(1.2);
        color: #e73c7e;
        opacity: 1;
      }

      .contacts a:hover i {
        animation: shake 0.5s;
        color: #e73c7e;
      }

      @keyframes shake {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-10deg); }
        75% { transform: rotate(10deg); }
      }

      /* Stats section */
      .stats-section {
        margin: 2em 0;
        padding: 2em 0;
        border-top: 1px solid rgba(0,0,0,0.1);
        border-bottom: 1px solid rgba(0,0,0,0.1);
        text-align: center;
      }

      .stats-container {
        display: flex;
        justify-content: space-around;
        flex-wrap: wrap;
        margin-top: 1em;
      }

      .stat-item {
        flex: 1;
        min-width: 120px;
        padding: 1em;
        animation: fadeInUp 1s ease-out;
      }

      .stat-number {
        font-size: 2.5em;
        font-weight: bold;
        color: #e73c7e;
        display: block;
        animation: countUp 2s ease-out;
      }

      .stat-label {
        font-size: 0.9em;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-top: 0.5em;
      }

      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(30px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes countUp {
        from {
          opacity: 0;
          transform: scale(0.5);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      /* Tagline styling */
      .tagline {
        font-size: 1.1em;
        color: #444;
        margin-top: 1em;
        font-weight: 500;
        min-height: 1.5em;
        transition: opacity 0.6s ease-in-out;
      }

      .tagline.visible {
        opacity: 1;
      }

      .tagline.hidden {
        opacity: 0;
      }

      /* Profile section enhancements */
      .profile__portrait img {
        transition: transform 0.3s ease;
      }

      .profile__portrait:hover img {
        transform: scale(1.05) rotate(2deg);
      }

      /* Mobile optimizations */
      @media (max-width: 768px) {
        .stats-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1em;
        }

        .stat-item {
          margin-bottom: 0;
        }
      }
    </style>
{{ end }}

{{ define "main" }}
{{ partial "profile.html" . }}

      <!-- Stats Section -->
      <div class="stats-section">
        <div class="stats-container">
          <div class="stat-item">
            <span class="stat-number">16+</span>
            <span class="stat-label">Years Experience</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">60+</span>
            <span class="stat-label">Team Members Led</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">25+</span>
            <span class="stat-label">Technologies</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">∞</span>
            <span class="stat-label">Coffee Consumed</span>
          </div>
        </div>
      </div>

      <!-- Tagline -->
      <div style="text-align: center;">
        <p style="font-size: 0.9em; color: #666; margin-bottom: 0.5em; text-transform: uppercase; letter-spacing: 1px;">Some things I did/do</p>
        <p class="tagline" id="rotating-quote"></p>
      </div>

{{ partial "contacts.html" . }}
{{ partial "actions.html" . }}
{{ end }}

{{ define "scripts" }}
    <script>
      document.addEventListener('DOMContentLoaded', function() {
        const titleElement = document.querySelector('.profile__title');
        if (titleElement) {
          titleElement.classList.add('typewriter');
        }

        const quotes = [
          'Scaled platform from hundreds to millions of users',
          'Led teams across 60+ global team members',
          'Deployed solutions for Ooredoo, Globe, Etisalat UAE',
          'Built cloud-native Kubernetes architectures',
          'Shipped games for Zynga, A&E, National Geographic',
          'Designed microservice platforms with GraphQL APIs',
          'Implemented regulated sportsbook platforms',
          'Developed Unity games for iOS, Android, Web',
          'Created React PWAs with real-time features',
          'Architected distributed systems with Scala/Play',
          'End-to-end business concepts to deployment',
          'Runs an army of robots 🤖',
          'VP Development at high-growth gaming platform',
          'Integrated neural networks for voice recognition',
          'Built real-money sports wagering platforms',
          'Delivered Williams Interactive gaming solutions',
          'Pioneered mobile sportsbook evolution',
          'Led R&D for Nintendo Wii & Microsoft Kinect projects',
          'Managed agile transformation initiatives',
          'Evaluated M&A technical compatibility for VC partners',
          'Optimized container-based Kubernetes deployments',
          'Delivered Kaplan K12 educational games',
          'Implemented phoneme-based voice recognition',
          'Designed pluggable game feature systems',
          'Awarded dozens of RFPs w/ technical writing',
          'Cutting edge AI-development practices',
          'VFX & video production 🎬',
          'Play piano and guitar (and might sing)',
          'What do you need?',
          'Continuous & lifelong learning on all things'
        ];

        function shuffleArray(array) {
          const arr = [...array];
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          return arr;
        }

        let availableQuotes = shuffleArray(quotes);
        let currentQuote = '';
        const quoteElement = document.getElementById('rotating-quote');

        function getNextQuote() {
          if (availableQuotes.length === 0) {
            availableQuotes = shuffleArray(quotes);
            if (availableQuotes[0] === currentQuote && availableQuotes.length > 1) {
              availableQuotes.push(availableQuotes.shift());
            }
          }
          currentQuote = availableQuotes.shift();
          return currentQuote;
        }

        quoteElement.textContent = getNextQuote();
        quoteElement.classList.add('visible');

        function rotateQuote() {
          quoteElement.classList.remove('visible');
          quoteElement.classList.add('hidden');

          setTimeout(() => {
            quoteElement.textContent = getNextQuote();
            void quoteElement.offsetWidth;
            quoteElement.classList.remove('hidden');
            quoteElement.classList.add('visible');
          }, 600);
        }

        setInterval(rotateQuote, 5000);

        const animateValue = (element, start, end, duration) => {
          let startTimestamp = null;
          const originalText = element.textContent;
          const hasPlus = originalText.includes('+');
          const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const currentValue = Math.floor(progress * (end - start) + start);
            if (originalText.includes('M+')) {
              element.textContent = currentValue + 'M+';
            } else if (hasPlus) {
              element.textContent = currentValue + '+';
            } else {
              element.textContent = currentValue;
            }
            if (progress < 1) {
              window.requestAnimationFrame(step);
            }
          };
          window.requestAnimationFrame(step);
        };

        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const statNumbers = document.querySelectorAll('.stat-number');
              statNumbers.forEach((stat, index) => {
                const text = stat.textContent;
                if (text.includes('M+')) {
                  animateValue(stat, 0, 1, 2000);
                  setTimeout(() => { stat.textContent = '1M+'; }, 2000);
                } else if (text.includes('+')) {
                  const value = parseInt(text);
                  animateValue(stat, 0, value, 2000);
                } else if (text !== '∞') {
                  const value = parseInt(text);
                  stat.textContent = '0';
                  animateValue(stat, 0, value, 2000);
                }
              });
              observer.disconnect();
            }
          });
        });

        const statsSection = document.querySelector('.stats-section');
        if (statsSection) {
          observer.observe(statsSection);
        }
      });
    </script>
{{ end }}
```

**Step 2: Verify homepage renders identically**

Run: `hugo server`
Expected: Homepage at http://localhost:1313 looks exactly the same as before — gradient background, glassmorphism card, profile, stats, rotating quotes, contacts, actions, footer. All animations still work.

**Step 3: Verify build succeeds**

Run: `hugo`
Expected: Build succeeds without errors or warnings.

**Step 4: Commit**

```bash
git add layouts/index.html
git commit -m "Refactor homepage to use baseof.html blocks"
```

---

### Task 3: Create the blog list template

**Files:**
- Create: `layouts/posts/list.html`

**Step 1: Create `layouts/posts/list.html`**

This template lists all posts in reverse chronological order. It inherits the gradient/glassmorphism from `baseof.html` and adds its own styles in the `head` block.

```html
{{ define "head" }}
    <style>
      .blog-header {
        text-align: center;
        margin-bottom: 2em;
      }

      .blog-header h1 {
        font-family: Roboto, sans-serif;
        font-weight: 100;
        font-size: 2rem;
        margin-bottom: 0.3em;
      }

      .blog-header h1 b {
        font-weight: 700;
      }

      .back-link {
        display: inline-block;
        margin-bottom: 2em;
        color: #666;
        font-size: 0.9em;
        transition: color 0.3s ease;
      }

      .back-link:hover {
        color: #e73c7e;
      }

      .post-list {
        list-style: none;
      }

      .post-item {
        padding: 1.5em 0;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      }

      .post-item:last-child {
        border-bottom: none;
      }

      .post-item a {
        text-decoration: none;
        color: inherit;
        display: block;
        transition: transform 0.2s ease;
      }

      .post-item a:hover {
        transform: translateX(5px);
      }

      .post-title {
        font-family: Roboto, sans-serif;
        font-size: 1.3em;
        font-weight: 700;
        color: #333;
        margin-bottom: 0.3em;
      }

      .post-item a:hover .post-title {
        color: #e73c7e;
      }

      .post-date {
        font-size: 0.85em;
        color: #999;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .post-description {
        font-size: 0.95em;
        color: #555;
        margin-top: 0.5em;
        line-height: 1.6;
      }

      .empty-state {
        text-align: center;
        color: #999;
        padding: 3em 0;
        font-size: 1.1em;
      }
    </style>
{{ end }}

{{ define "main" }}
      <a href="/" class="back-link"><i class="fas fa-arrow-left"></i> Back to home</a>

      <div class="blog-header">
        <h1>The <b>Blog</b></h1>
      </div>

      {{ $posts := where .Pages "Draft" false }}
      {{ if $posts }}
      <ul class="post-list">
        {{ range $posts.ByDate.Reverse }}
        <li class="post-item">
          <a href="{{ .Permalink }}">
            <div class="post-title">{{ .Title }}</div>
            <div class="post-date">{{ .Date.Format "January 2, 2006" }}</div>
            {{ with .Description }}
            <div class="post-description">{{ . }}</div>
            {{ end }}
          </a>
        </li>
        {{ end }}
      </ul>
      {{ else }}
      <div class="empty-state">
        <p>No posts yet. Check back soon!</p>
      </div>
      {{ end }}
{{ end }}
```

**Step 2: Verify it renders**

Run: `hugo server`
Expected: Navigate to http://localhost:1313/posts/ — you should see the gradient background, glassmorphism card, "Back to home" link, "The Blog" header, and the existing `robyn-xmas-2023` post listed (if not draft).

**Step 3: Commit**

```bash
git add layouts/posts/list.html
git commit -m "Add blog list template with chronological post listing"
```

---

### Task 4: Create the blog single post template

**Files:**
- Create: `layouts/posts/single.html`

**Step 1: Create `layouts/posts/single.html`**

This overrides the bare-bones `layouts/_default/single.html` for posts specifically. It includes typography for article content, code syntax highlighting, and reading time.

```html
{{ define "head" }}
    <style>
      .back-link {
        display: inline-block;
        margin-bottom: 2em;
        color: #666;
        font-size: 0.9em;
        transition: color 0.3s ease;
      }

      .back-link:hover {
        color: #e73c7e;
      }

      .post-header {
        text-align: center;
        margin-bottom: 2em;
        padding-bottom: 1.5em;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      }

      .post-header h1 {
        font-family: Roboto, sans-serif;
        font-weight: 700;
        font-size: 2em;
        color: #333;
        line-height: 1.3;
        margin-bottom: 0.5em;
      }

      .post-meta {
        font-size: 0.85em;
        color: #999;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .post-meta span {
        margin: 0 0.5em;
      }

      /* Article content typography */
      .post-content {
        line-height: 1.8;
        color: #333;
        font-size: 1.05em;
      }

      .post-content h2 {
        font-family: Roboto, sans-serif;
        font-size: 1.5em;
        font-weight: 700;
        margin-top: 2em;
        margin-bottom: 0.5em;
        color: #222;
      }

      .post-content h3 {
        font-family: Roboto, sans-serif;
        font-size: 1.25em;
        font-weight: 700;
        margin-top: 1.5em;
        margin-bottom: 0.5em;
        color: #333;
      }

      .post-content p {
        margin-bottom: 1.2em;
      }

      .post-content a {
        color: #e73c7e;
        text-decoration: underline;
        text-decoration-color: rgba(231, 60, 126, 0.3);
        transition: text-decoration-color 0.3s ease;
      }

      .post-content a:hover {
        text-decoration-color: #e73c7e;
      }

      .post-content blockquote {
        border-left: 3px solid #e73c7e;
        margin: 1.5em 0;
        padding: 0.5em 1.5em;
        color: #555;
        background: rgba(0, 0, 0, 0.02);
        border-radius: 0 8px 8px 0;
      }

      .post-content ul, .post-content ol {
        margin: 1em 0;
        padding-left: 2em;
      }

      .post-content li {
        margin-bottom: 0.5em;
      }

      .post-content code {
        background: rgba(0, 0, 0, 0.06);
        padding: 0.15em 0.4em;
        border-radius: 4px;
        font-size: 0.9em;
      }

      .post-content pre {
        background: #1e1e2e;
        color: #cdd6f4;
        padding: 1.2em;
        border-radius: 10px;
        overflow-x: auto;
        margin: 1.5em 0;
        font-size: 0.9em;
        line-height: 1.6;
      }

      .post-content pre code {
        background: none;
        padding: 0;
        border-radius: 0;
        font-size: inherit;
        color: inherit;
      }

      .post-content img {
        max-width: 100%;
        height: auto;
        border-radius: 10px;
        margin: 1.5em 0;
      }

      .post-content hr {
        border: none;
        border-top: 1px solid rgba(0, 0, 0, 0.08);
        margin: 2em 0;
      }

      @media (max-width: 768px) {
        .post-header h1 {
          font-size: 1.5em;
        }

        .post-content {
          font-size: 1em;
        }
      }
    </style>
{{ end }}

{{ define "main" }}
      <a href="/posts/" class="back-link"><i class="fas fa-arrow-left"></i> Back to blog</a>

      <article>
        <div class="post-header">
          <h1>{{ .Title }}</h1>
          <div class="post-meta">
            <span>{{ .Date.Format "January 2, 2006" }}</span>
            <span>&middot;</span>
            <span>{{ .ReadingTime }} min read</span>
          </div>
        </div>

        <div class="post-content">
          {{ .Content }}
        </div>
      </article>
{{ end }}
```

**Step 2: Verify it renders**

Run: `hugo server`
Expected: Click on a post from the list page — it should show the post content inside the glassmorphism card with proper typography. The "Back to blog" link should work.

**Step 3: Commit**

```bash
git add layouts/posts/single.html
git commit -m "Add blog single post template with article typography"
```

---

### Task 5: Add blog link to homepage and create sample post

**Files:**
- Modify: `config.toml` (add blog action)
- Create: `content/posts/hello-world.md` (sample post to validate templates)

**Step 1: Add blog action to `config.toml`**

Add `blog.name` and `blog.url` under `[params.actions]`, after the existing resume entry:

```toml
  blog.name = "Blog"
  blog.url = "/posts/"
```

**Step 2: Create sample post `content/posts/hello-world.md`**

```markdown
---
title: "Hello, World"
date: 2026-02-18
description: "First post on the new blog. Testing out the templates."
draft: false
---

This is the first post on the blog. Just making sure everything works.

## A Heading

Some text with **bold** and *italic* and a [link](https://joelmgallant.com).

> A blockquote for good measure.

### Code Sample

Here's a code block:

` ` `go
func main() {
    fmt.Println("Hello, World!")
}
` ` `

And some `inline code` too.

- List item one
- List item two
- List item three
```

(Note: the spaces in the triple backticks above are for escaping in this plan doc — the actual file should use real triple backticks with no spaces.)

**Step 3: Verify end-to-end**

Run: `hugo server`
Expected:
1. Homepage shows "Blog" button next to "CV (PDF)" in the actions section
2. Clicking "Blog" goes to `/posts/` listing page with both posts
3. Clicking a post goes to the single post view with typography
4. "Back to blog" navigates back to list
5. "Back to home" navigates back to homepage
6. All pages have gradient background and glassmorphism card

**Step 4: Run production build**

Run: `hugo --minify`
Expected: Build succeeds. Check `public/posts/index.html` exists and `public/posts/hello-world/index.html` exists.

**Step 5: Commit**

```bash
git add config.toml content/posts/hello-world.md
git commit -m "Add blog link to homepage and create sample post"
```

---

### Task 6: Clean up old single template and delete sample post

**Files:**
- Delete: `layouts/_default/single.html` (the bare-bones one — `posts/single.html` handles posts, and `baseof.html` provides the fallback structure)
- Delete: `content/posts/hello-world.md` (sample post served its purpose)

**Step 1: Remove `layouts/_default/single.html`**

This file was a minimal placeholder. Now that `layouts/posts/single.html` exists for posts (and `baseof.html` handles the base structure), this file is unnecessary and could cause confusion.

**Step 2: Delete sample post**

Remove `content/posts/hello-world.md` — it was just for validation.

**Step 3: Verify build still works**

Run: `hugo`
Expected: Build succeeds. The existing `robyn-xmas-2023` post still renders correctly at its custom URL.

**Step 4: Commit**

```bash
git rm layouts/_default/single.html content/posts/hello-world.md
git commit -m "Remove placeholder single template and sample post"
```

---

### Task 7: Final verification and design doc cleanup

**Files:**
- Delete: `docs/plans/2026-02-18-blog-section-design.md`
- Delete: `docs/plans/2026-02-18-blog-section-implementation.md`

**Step 1: Full end-to-end verification**

Run: `hugo server`
Verify:
1. Homepage: gradient, glassmorphism, profile, stats, rotating quotes, contacts, "CV (PDF)" and "Blog" buttons, footer — all working
2. Blog list (`/posts/`): gradient, glassmorphism, back link, header, post entries with dates
3. Blog single (click a post): gradient, glassmorphism, back link, title, date, reading time, content with typography
4. Mobile: resize browser to verify responsive layout on all three page types

**Step 2: Production build**

Run: `hugo --minify`
Expected: Clean build, no errors or warnings.

**Step 3: Remove plan files and commit**

```bash
git rm docs/plans/2026-02-18-blog-section-design.md docs/plans/2026-02-18-blog-section-implementation.md
rmdir docs/plans docs 2>/dev/null; true
git add -A
git commit -m "Add blog section: base template, list, single post, homepage link"
```
