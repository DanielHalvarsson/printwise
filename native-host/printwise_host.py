#!/usr/bin/env python3
"""
PrintWise Native Messaging Host
Runs inside WSL, invoked by printwise_host.bat via wsl.exe.
Reads one native message from Chrome, calls the Claude CLI, sends back JSON.
"""
import sys
import json
import struct
import subprocess
import shutil
import os
import logging

LOG_FILE = '/tmp/printwise-host.log'

logging.basicConfig(
    filename=LOG_FILE,
    level=logging.DEBUG,
    format='%(asctime)s %(levelname)s %(message)s',
)

EXTRACTION_PROMPT = """\
You are PrintWise, a content extraction and typesetting assistant. \
Extract ONLY the meaningful article/post/thread content from the raw web page text below.

RULES:
- Remove all ads, navigation, cookie notices, newsletter prompts, social sharing \
text, sidebar content, comments, related articles, and any other non-article content.
- Preserve the full article text faithfully — do not summarise or shorten.
- Preserve the original structure: headings, paragraphs, lists, block quotes.
- Identify the article title, author (if available), and date (if available).
- For Twitter/X threads: clean up into a coherent reading flow, each tweet as a paragraph.
- For Substack/blog posts: extract just the post content.

OUTPUT FORMAT — respond with ONLY this JSON, no markdown fences, no preamble:
{"title":"The article title","author":"Author name or null","date":"Publication date or null",\
"content":"Full article in clean HTML using only: \
<h1> <h2> <h3> <p> <blockquote> <ul> <ol> <li> <em> <strong> <a href=\\"...\\"> \
<hr> <figure> <figcaption>. Every paragraph must be wrapped in <p> tags."}"""


def find_claude():
    # Prefer the PATH lookup, then common install locations
    found = shutil.which('claude')
    if found:
        return found
    candidates = [
        os.path.expanduser('~/.local/bin/claude'),
        '/usr/local/bin/claude',
        '/usr/bin/claude',
    ]
    for path in candidates:
        if os.path.isfile(path) and os.access(path, os.X_OK):
            return path
    return None


def read_message():
    """Read one length-prefixed JSON message from Chrome via stdin."""
    raw_len = sys.stdin.buffer.read(4)
    if len(raw_len) < 4:
        sys.exit(0)
    msg_len = struct.unpack('<I', raw_len)[0]
    if msg_len > 1024 * 1024:
        raise ValueError(f'Message too large: {msg_len} bytes')
    raw_msg = sys.stdin.buffer.read(msg_len)
    return json.loads(raw_msg.decode('utf-8'))


def send_message(obj):
    """Send one length-prefixed JSON message back to Chrome via stdout."""
    data = json.dumps(obj, ensure_ascii=False).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('<I', len(data)))
    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()


def main():
    try:
        msg = read_message()
    except Exception as e:
        logging.error('Failed to read message: %s', e)
        send_message({'error': f'Failed to read message: {e}'})
        return

    text = msg.get('text', '')
    url = msg.get('url', '')
    title = msg.get('title', '')

    logging.info('Processing: %s', url)

    claude_bin = find_claude()
    if not claude_bin:
        logging.error('Claude CLI not found')
        send_message({'error': 'Claude CLI not found. Install it with: npm install -g @anthropic-ai/claude-code'})
        return

    prompt = f'{EXTRACTION_PROMPT}\n\nURL: {url}\nPage title: {title}\n\nRaw page text:\n{text}'

    try:
        result = subprocess.run(
            [claude_bin, '-p', prompt],
            capture_output=True,
            text=True,
            timeout=120,
        )
    except subprocess.TimeoutExpired:
        logging.error('Claude timed out')
        send_message({'error': 'Claude timed out after 120 seconds'})
        return
    except Exception as e:
        logging.error('subprocess.run failed: %s', e)
        send_message({'error': f'Failed to run Claude: {e}'})
        return

    if result.returncode != 0:
        stderr = (result.stderr or '').strip()[:300]
        logging.error('Claude exited %d: %s', result.returncode, stderr)
        send_message({'error': f'Claude exited with code {result.returncode}: {stderr}'})
        return

    raw = (result.stdout or '').strip()
    logging.debug('Claude raw output length: %d', len(raw))

    try:
        cleaned = raw.replace('```json', '').replace('```', '').strip()
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        logging.warning('JSON parse failed, using plain-text fallback')
        parsed = {
            'title': title,
            'author': None,
            'date': None,
            'content': '\n'.join(
                f'<p>{p.strip()}</p>' for p in raw.split('\n') if p.strip()
            ),
        }

    send_message({
        'content': parsed.get('content', ''),
        'title': parsed.get('title') or title,
        'author': parsed.get('author'),
        'date': parsed.get('date'),
    })
    logging.info('Done: %s', url)


if __name__ == '__main__':
    main()
