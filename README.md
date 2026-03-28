# PrintWise

**AI-powered clean reading & printing for the web.**

PrintWise strips ads, navigation, cookie banners, and other junk from any web page — leaving you with beautifully typeset content ready to read or print.

It uses Claude (Haiku) to intelligently identify what matters on the page, then renders it with editorial-quality typography: proper serif fonts, generous spacing, elegant drop caps, and print-optimized page breaks.

## Installation

1. Unzip `printwise.zip`
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked** → select the `printwise` folder
5. Click the PrintWise icon in your toolbar
6. Add your Anthropic API key in settings

## Usage

1. Navigate to any article, blog post, Substack, Twitter/X thread, or web page
2. Click the PrintWise extension icon
3. Click **Extract & Prepare for Print**
4. A new tab opens with the beautifully formatted content
5. Click **Print** or press `Ctrl/Cmd + P`

## What it handles well

- Substack posts
- Twitter/X threads
- Medium articles
- Blog posts
- News articles
- Any standard web article

## Cost

Each extraction uses one Claude Haiku API call (~$0.001–0.003 per page). Your API key stays stored locally in Chrome and is only sent to the Anthropic API.

## Credits

Built by Daniel Halvarsson · [danielhalvarsson.com](https://danielhalvarsson.com)

Uses [Claude Haiku](https://anthropic.com) for content extraction.
