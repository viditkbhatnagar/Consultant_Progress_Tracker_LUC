#!/usr/bin/env python3
"""
Phase 5 — generate single-page, pre-highlighted PDFs for every DocChunk.

For each chunk:
  1. Open client/public/program-docs/<slug>/<sourceFile>.
  2. Extract ONLY the chunk's source page into a fresh in-memory document.
  3. On that extracted page:
       - yellow highlight over the first ~80 chars of chunk.content
       - light-blue highlight over questionText (QNA chunks only) so the
         Q/A boundary pops
  4. Save to client/public/program-docs-highlighted/<slug>/<chunkId>.pdf
  5. Update DocChunk.highlightedPdfPath to the web-relative path.

Run:  python3 server/scripts/generateHighlightedPdfs.py [--limit N]

Reads MongoDB via MONGODB_URI from server/.env (same file as the Node
side). Safe to re-run — files are overwritten, hash-tracked skip isn't
needed at this volume (~215 chunks × <100 ms each ≈ 20 s total).
"""
import argparse
import os
import re
import sys
from pathlib import Path

import fitz  # PyMuPDF
from pymongo import MongoClient
from dotenv import load_dotenv


SERVER_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = SERVER_DIR.parent
SOURCE_ROOT = REPO_ROOT / "client" / "public" / "program-docs"
OUT_ROOT = REPO_ROOT / "client" / "public" / "program-docs-highlighted"
SNIPPET_ROOT = REPO_ROOT / "client" / "public" / "program-docs-snippets"

# Snippet padding + max-height in PDF points (1pt ≈ 1/72 inch)
SNIPPET_PAD_X = 40
SNIPPET_PAD_Y = 60
SNIPPET_MAX_HEIGHT = 800
# 150 DPI over PDF's 72-dpi coord space → 2.083× scale matrix.
SNIPPET_DPI = 150
SNIPPET_ZOOM = SNIPPET_DPI / 72.0

# RGBA-lite: PyMuPDF takes RGB tuples in 0..1 and an opacity separately.
YELLOW_RGB = (1.0, 0.94, 0.30)        # warm yellow, content highlight
BLUE_RGB = (0.68, 0.85, 0.98)         # soft blue, questionText highlight
ANNOT_OPACITY = 0.4


def load_env():
    load_dotenv(SERVER_DIR / ".env")
    uri = os.environ.get("MONGODB_URI")
    if not uri:
        sys.exit("MONGODB_URI is not set — can't read DocChunk collection.")
    return uri


def shorten_for_search(text, max_chars=80):
    """Trim chunk content to a PDF-searchable phrase.

    Chunk content is sanitized (fixLigatures, mojibake, line-dedup) but the
    PDF itself still contains the original glyphs. Shorter needles are more
    likely to match — PyMuPDF's search_for can't hop across line breaks
    cleanly on long phrases.

    Strategy: strip leading boilerplate (section headers, big-caps titles,
    Q-markers), then take the first sentence up to max_chars.
    """
    if not text:
        return ""
    t = text
    # Drop any leading lines that are section-header / preamble (all-caps,
    # <= 60 chars, or match SECTION|COMPLETE ANSWER|Q\d+|SCENARIO markers).
    lines = [ln.strip() for ln in t.split("\n") if ln.strip()]
    keep = []
    started = False
    for ln in lines:
        if not started:
            if re.match(r"^(SECTION\s+\d+|Q\d+[:.]|SCENARIO\s+\d+|COMPLETE ANSWER)", ln, re.I):
                continue
            # all-caps short header like "DOCTORATE OF BUSINESS..."
            if len(ln) <= 60 and ln.upper() == ln and re.search(r"[A-Z]", ln):
                continue
            started = True
        keep.append(ln)
    t = " ".join(keep) if keep else " ".join(lines)
    # First sentence up to max_chars
    sent = re.split(r"(?<=[.?!])\s+", t, maxsplit=1)[0]
    if len(sent) > max_chars:
        sent = sent[:max_chars]
    return sent.strip()


def search_and_highlight(page, needle, color_rgb, opacity=ANNOT_OPACITY):
    """Return the matched quads (empty list when nothing hit) so the caller
    can reuse them both for annotation AND for the snippet crop."""
    needle = (needle or "").strip()
    if not needle:
        return []
    attempts = [needle]
    if len(needle) > 40:
        attempts.append(needle[:40])
    if len(needle) > 20:
        attempts.append(needle[:20])
    for candidate in attempts:
        try:
            quads = page.search_for(candidate, quads=True)
        except TypeError:
            quads = page.search_for(candidate)
        if quads:
            annot = page.add_highlight_annot(quads)
            annot.set_colors(stroke=color_rgb)
            annot.set_opacity(opacity)
            annot.update()
            return quads
    return []


def rect_from_quads(quads):
    """Union a list of Quad/Rect into a single bounding Rect, or None."""
    if not quads:
        return None
    r = None
    for q in quads:
        box = q.rect if hasattr(q, "rect") else q
        r = fitz.Rect(box) if r is None else r | fitz.Rect(box)
    return r


def save_snippet(page, content_quads, question_quads, out_path):
    """Render a PNG crop covering the highlighted region + padding.

    Returns True on success, False if we had no quads (caller falls back
    to the full-page highlighted PDF).
    """
    merged = rect_from_quads(list(content_quads) + list(question_quads))
    if merged is None:
        return False

    page_rect = page.rect
    # Pad horizontally and vertically, clamped to the page bounds so we
    # never read outside the page.
    clip = fitz.Rect(
        max(page_rect.x0, merged.x0 - SNIPPET_PAD_X),
        max(page_rect.y0, merged.y0 - SNIPPET_PAD_Y),
        min(page_rect.x1, merged.x1 + SNIPPET_PAD_X),
        min(page_rect.y1, merged.y1 + SNIPPET_PAD_Y),
    )

    # Cap height — a very tall quad (long Q&A) would otherwise produce
    # a multi-megabyte snippet that defeats the "quick preview" purpose.
    if clip.height > SNIPPET_MAX_HEIGHT:
        clip.y1 = clip.y0 + SNIPPET_MAX_HEIGHT

    pix = page.get_pixmap(
        clip=clip, matrix=fitz.Matrix(SNIPPET_ZOOM, SNIPPET_ZOOM), alpha=False
    )
    pix.save(str(out_path))
    return True


def process_chunk(chunk, stats):
    slug = chunk["program"]
    source_file = chunk["sourceFile"]
    page_number = int(chunk.get("pageNumber", 1))
    chunk_id = chunk["chunkId"]
    content = chunk.get("content", "")
    question_text = chunk.get("questionText")

    src_path = SOURCE_ROOT / slug / source_file
    if not src_path.exists():
        stats["missing_source"] += 1
        print(f"  [SKIP] {chunk_id}: source PDF missing ({src_path})")
        return None

    out_dir = OUT_ROOT / slug
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{chunk_id}.pdf"

    snip_dir = SNIPPET_ROOT / slug
    snip_dir.mkdir(parents=True, exist_ok=True)
    snip_path = snip_dir / f"{chunk_id}.png"
    snip_web_path = None

    src = fitz.open(src_path)
    try:
        page_idx = max(0, min(page_number - 1, src.page_count - 1))
        # Extract just this page into a new doc so our highlights never
        # touch the source file on disk.
        out = fitz.open()
        out.insert_pdf(src, from_page=page_idx, to_page=page_idx)
        page = out[0]

        question_quads = []
        content_quads = []
        # QNA → highlight the question first in blue so it reads as the
        # anchor, then the content in yellow.
        if question_text:
            question_quads = search_and_highlight(
                page, question_text.strip(' "'), BLUE_RGB
            )
            if question_quads:
                stats["question_hits"] += 1

        content_needle = shorten_for_search(content, 80)
        content_quads = search_and_highlight(page, content_needle, YELLOW_RGB)
        if content_quads:
            stats["content_hits"] += 1

        if not (content_quads or question_quads):
            stats["no_hit"] += 1

        # Render the PNG snippet BEFORE saving/closing the extracted
        # page — once the Document closes the Page handle is detached
        # and get_pixmap() raises "page is None".
        try:
            if save_snippet(page, content_quads, question_quads, snip_path):
                snip_web_path = f"/program-docs-snippets/{slug}/{chunk_id}.png"
                stats["snippet_hits"] += 1
            else:
                stats["snippet_miss"] += 1
        except Exception as e:  # noqa: BLE001
            stats["snippet_miss"] += 1
            print(f"  [SNIPPET ERR] {chunk_id}: {e}")

        out.save(out_path, garbage=4, deflate=True)
        out.close()
    finally:
        src.close()

    return {
        "highlightedPdfPath": f"/program-docs-highlighted/{slug}/{chunk_id}.pdf",
        "snippetPath": snip_web_path,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None, help="process only N chunks")
    ap.add_argument("--dry-run", action="store_true", help="don't write Mongo updates")
    args = ap.parse_args()

    uri = load_env()
    client = MongoClient(uri)
    # Resolve DB from URI (Atlas URIs embed the default DB after the host).
    db = client.get_default_database()
    if db is None:
        # Fall back: assume the tracker DB is the only non-admin DB.
        names = [n for n in client.list_database_names() if n not in ("admin", "local", "config")]
        if not names:
            sys.exit("Could not resolve a default DB from MONGODB_URI.")
        db = client[names[0]]
    print(f"Using DB: {db.name}")

    coll = db["docchunks"]
    cursor = coll.find({"organization": "luc"})
    if args.limit:
        cursor = cursor.limit(args.limit)

    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    SNIPPET_ROOT.mkdir(parents=True, exist_ok=True)

    stats = {
        "processed": 0,
        "content_hits": 0,
        "question_hits": 0,
        "no_hit": 0,
        "missing_source": 0,
        "updated": 0,
        "snippet_hits": 0,
        "snippet_miss": 0,
    }

    for chunk in cursor:
        stats["processed"] += 1
        result = process_chunk(chunk, stats)
        if result is None:
            continue
        if not args.dry_run:
            coll.update_one(
                {"_id": chunk["_id"]},
                {
                    "$set": {
                        "highlightedPdfPath": result["highlightedPdfPath"],
                        "snippetPath": result["snippetPath"],
                    }
                },
            )
            stats["updated"] += 1
        if stats["processed"] % 20 == 0:
            print(
                f"  progress: {stats['processed']} chunks "
                f"(content {stats['content_hits']}, q {stats['question_hits']}, miss {stats['no_hit']})"
            )

    print("\n── summary ──")
    print(f"  processed           : {stats['processed']}")
    print(f"  content highlights  : {stats['content_hits']}")
    print(f"  question highlights : {stats['question_hits']}")
    print(f"  no-hit (export only): {stats['no_hit']}")
    print(f"  missing source PDFs : {stats['missing_source']}")
    print(f"  DocChunk updates    : {stats['updated']}")
    print(f"  snippet hits        : {stats['snippet_hits']}")
    print(f"  snippet miss        : {stats['snippet_miss']}")
    print(f"  pdf output dir      : {OUT_ROOT}")
    print(f"  snippet output dir  : {SNIPPET_ROOT}")


if __name__ == "__main__":
    main()
