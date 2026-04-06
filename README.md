# PrintWise

**AI-powered clean reading & printing for the web.**

PrintWise strips ads, navigation, cookie banners, and other junk from any web page — leaving you with beautifully typeset content ready to read or print. Optionally saves clippings directly to an Obsidian vault via [fragmentd](https://github.com/DanielHalvarsson/fragmentd).

It uses the Claude Code CLI to intelligently identify what matters on the page, then renders it with editorial-quality typography: proper serif fonts, generous spacing, elegant drop caps, and print-optimized page breaks.

## Requirements

- Chrome on Windows
- WSL2 with the [Claude Code CLI](https://claude.ai/code) installed (`npm install -g @anthropic-ai/claude-code`)
- An active Claude subscription (Pro or Max) — no API key needed

## Installation

1. Clone or download this repo
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked** → select the `printwise` folder
5. Note your extension ID (shown under the extension name)
6. Run the native host installer from WSL:
   ```bash
   cd native-host
   ./install.sh
   ```
7. Reload the extension in Chrome

## Usage

1. Navigate to any article, blog post, Substack, Twitter/X thread, or web page
2. Click the PrintWise icon in your toolbar
3. Click **Extract & Prepare for Print**
4. A new tab opens with the beautifully formatted content
5. Click **Print** or press `Ctrl/Cmd + P`
6. Optionally click **Save to Wiki** to send the clipping to your Obsidian vault via fragmentd

## Wiki integration

To enable **Save to Wiki**, configure your fragmentd connection in the popup:

- **fragmentd URL** — defaults to `http://127.0.0.1:7331`
- **fragmentd Token** — your local fragmentd auth token
- **Vault Path** — absolute path to your Obsidian vault

Saved clippings land in `{vault_path}/raw/clippings/` with wiki-compatible frontmatter, ready for the note-agent intake pipeline.

## What it handles well

- Substack posts
- Twitter/X threads
- Medium articles
- Blog posts
- News articles
- Any standard web article

## Cost

Free — uses your existing Claude subscription. No API key, no per-call billing.

## Credits

Built by Daniel Halvarsson · [danielhalvarsson.com](https://danielhalvarsson.com)

Uses [Claude Code](https://claude.ai/code) for content extraction.
