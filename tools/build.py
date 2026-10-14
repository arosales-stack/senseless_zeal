#!/usr/bin/env python3
"""Build the site's images and data from originals/ + works.json.

For each work:
  1. load originals/<id>.(webp|jpg|jpeg|png|tif|tiff)
  2. trim N px off each edge if asked (scanner hairlines)
  3. add a frame in the drawing's own background colour (sampled from the edges)
  4. write public/img/<id>.webp (longest side 1400) and public/img/<id>-sm.webp (720 tall)
Then write public/js/works.js with titles, media and final pixel sizes.

Usage:  python3 tools/build.py          (every work is placed on an A4 canvas; --no-a4 to skip)
        python3 tools/build.py          (needs: pip install pillow numpy)
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "originals"
OUT_IMG = ROOT / "public" / "img"
OUT_JS = ROOT / "public" / "js" / "works.js"
EXTS = (".webp", ".jpg", ".jpeg", ".png", ".tif", ".tiff")
FULL_LONG_SIDE = 1000   # sharp on screens, too small for a usable print
SMALL_HEIGHT = 720
QUALITY = 82
COPYRIGHT = "Copyright Senseless Zeal. All rights reserved. No reproduction without permission."


def _exif():
    e = Image.Exif()
    e[0x8298] = COPYRIGHT          # Copyright
    e[0x013B] = "Senseless Zeal"   # Artist
    return e.tobytes()


EXIF = _exif()


def find_source(work_id):
    for ext in EXTS:
        p = SRC / f"{work_id}{ext}"
        if p.exists():
            return p
    sys.exit(f"Missing original for '{work_id}' in {SRC}/")


def edge_colour(img):
    """Median colour of a thin band around the edges = the drawing's background."""
    a = np.asarray(img)
    band = max(4, min(a.shape[:2]) // 100)
    edges = np.concatenate([
        a[:band].reshape(-1, 3), a[-band:].reshape(-1, 3),
        a[:, :band].reshape(-1, 3), a[:, -band:].reshape(-1, 3),
    ])
    return tuple(int(v) for v in np.median(edges, axis=0))


A4 = True   # every work sits on an A4 portrait canvas (--no-a4 for the original proportions)


def content_margins(img, bg):
    a = np.asarray(img).astype(int)
    diff = np.abs(a - np.array(bg)).max(axis=2) > 40
    rows, cols = np.where(diff.sum(axis=1) > 2)[0], np.where(diff.sum(axis=0) > 2)[0]
    w, h = img.size
    if not len(rows) or not len(cols):
        return 0, 0, 0, 0
    return rows[0], h - 1 - rows[-1], cols[0], w - 1 - cols[-1]   # T, B, L, R


def tighten(img, keep):
    """Shrink the empty space around the drawing to `keep` (e.g. 0.4 = 40%) on every side,
    in proportion, so the drawing gets bigger without moving within its composition."""
    T, B, L, R = content_margins(img, edge_colour(img))
    w, h = img.size
    return img.crop((round(L * (1 - keep)), round(T * (1 - keep)), w - round(R * (1 - keep)), h - round(B * (1 - keep))))


def to_a4(img, align=None):
    """Extend the canvas to A4 portrait (1 : sqrt 2) in the background colour, without
    cropping or scaling. The new space is split in the same ratio as the existing margins
    around the drawing, so off-centre compositions keep their placement."""
    bg = edge_colour(img)
    T, B, L, R = content_margins(img, bg)
    w, h = img.size
    ratio = 1 / 2 ** 0.5
    if w / h > ratio:      # too wide: add height
        extra = round(w / ratio) - h
        top = round(extra * (.5 if align == "center" else (T / (T + B) if T + B else .5)))
        box, pos = (w, h + extra), (0, top)
    else:                  # too tall: add width
        extra = round(h * ratio) - w
        left = round(extra * (.5 if align == "center" else (L / (L + R) if L + R else .5)))
        box, pos = (w + extra, h), (left, 0)
    out = Image.new("RGB", box, bg)
    out.paste(img, pos)
    return out


def process(work, defaults):
    if A4:
        work = {**work, **work.get("a4", {})}
    frame = work.get("frame", defaults["frame"])
    trim = work.get("trim", defaults["trim"])
    img = Image.open(find_source(work["id"])).convert("RGB")

    if work.get("crush"):
        # photographed (not scanned) black paper: push near-blacks to pure black so the frame has no seam
        lim = work["crush"]
        a = np.asarray(img).astype(int)
        dark = a.max(axis=2) < lim
        a[dark] = 0
        img = Image.fromarray(a.astype("uint8"))

    if trim:
        w, h = img.size
        img = img.crop((trim, trim, w - trim, h - trim))

    if frame:
        # a number = same border on every side; a dict {top,right,bottom,left} = per side
        sides = frame if isinstance(frame, dict) else {k: frame for k in ("top", "right", "bottom", "left")}
        px = {k: round(sides.get(k, 0) * max(img.size)) for k in ("top", "right", "bottom", "left")}
        framed = Image.new("RGB", (img.width + px["left"] + px["right"], img.height + px["top"] + px["bottom"]), edge_colour(img))
        framed.paste(img, (px["left"], px["top"]))
        img = framed

    if work.get("tighten"):
        img = tighten(img, work["tighten"])

    if A4:
        img = to_a4(img, work.get("a4align"))

    outline = work.get("outline")
    if outline:
        # thin border like the scanner edge on Companion / Mirror (~2px at 1400px)
        t = max(1, round(max(img.size) / 700))
        ImageDraw.Draw(img).rectangle([0, 0, img.width - 1, img.height - 1], outline=outline, width=t)

    scale = FULL_LONG_SIDE / max(img.size)
    full = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS) if scale < 1 else img
    small_scale = SMALL_HEIGHT / full.height
    small = full.resize((round(full.width * small_scale), SMALL_HEIGHT), Image.LANCZOS)

    src = find_source(work["id"])
    if not A4 and not frame and not trim and not outline and scale >= 1 and src.suffix == ".webp":
        (OUT_IMG / f"{work['id']}.webp").write_bytes(src.read_bytes())  # untouched: no re-encode
    else:
        full.save(OUT_IMG / f"{work['id']}.webp", "WEBP", quality=QUALITY, method=6, exif=EXIF)
    small.save(OUT_IMG / f"{work['id']}-sm.webp", "WEBP", quality=QUALITY, method=6, exif=EXIF)
    print(f"{work['id']:<12} frame={str(frame):<5} {full.width}x{full.height}")
    tone = "dark" if sum(edge_colour(full)) / 3 < 128 else "light"   # lets the page outline black drawings in dark mode
    return {"id": work["id"], "title": work["title"], "medium": work["medium"],
            "tags": work.get("tags", []), "tone": tone, "w": full.width, "h": full.height}


def main():
    global A4, OUT_IMG, OUT_JS
    if "--no-a4" in sys.argv:
        A4 = False
    cfg = json.loads((ROOT / "works.json").read_text(encoding="utf-8"))
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    tags = cfg.get("tags", [])
    known = {t["id"] for t in tags}
    for w in cfg["works"]:
        bad = set(w.get("tags", [])) - known
        if bad:
            sys.exit(f"'{w['id']}' uses unknown tag(s) {sorted(bad)}; add them to the tags list in works.json")
    works = [process(w, cfg["defaults"]) for w in cfg["works"]]

    # drop images for works no longer listed
    keep = {f"{w['id']}{s}.webp" for w in works for s in ("", "-sm")}
    for f in OUT_IMG.glob("*.webp"):
        if f.name not in keep:
            f.unlink()
            print(f"removed      {f.name}")

    OUT_JS.write_text(
        "// Generated by tools/build.py from works.json. Do not edit by hand.\n"
        f"window.TAGS = {json.dumps(tags, ensure_ascii=False)};\n"
        f"window.WORKS = {json.dumps(works, ensure_ascii=False, indent=1)};\n",
        encoding="utf-8",
    )
    print(f"wrote        {OUT_JS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
