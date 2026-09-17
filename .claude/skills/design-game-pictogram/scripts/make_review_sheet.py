#!/usr/bin/env python3

from __future__ import annotations

import argparse
import html
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a deterministic HTML review sheet for SVG pictograms."
    )
    parser.add_argument("svgs", nargs="+", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--size", type=int, default=112)
    parser.add_argument("--title", default="Pictogram review")
    return parser.parse_args()


def load_svg(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def card(path: Path, svg: str, size: int, show_label: bool) -> str:
    label = html.escape(path.stem)
    caption = f'<div class="caption">{label}</div>' if show_label else ""
    aria = f' aria-label="{label}"' if show_label else ' aria-hidden="true"'
    return (
        '<article class="card">'
        f'<div class="art" style="--size:{size}px"{aria}>{svg}</div>'
        f"{caption}"
        "</article>"
    )


def section(title: str, items: list[tuple[Path, str]], size: int, show_label: bool) -> str:
    cards = "\n".join(card(path, svg, size, show_label) for path, svg in items)
    return (
        '<section class="section">'
        f"<h2>{html.escape(title)}</h2>"
        f'<div class="grid">{cards}</div>'
        "</section>"
    )


def main() -> int:
    args = parse_args()
    items = [(path, load_svg(path)) for path in args.svgs]

    document = f"""<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(args.title)}</title>
<style>
  :root {{ font-family: system-ui, sans-serif; color: #111; background: #fff; }}
  body {{ margin: 32px; }}
  h1 {{ margin: 0 0 28px; font-size: 24px; }}
  h2 {{ margin: 0 0 16px; font-size: 18px; }}
  .section {{ margin: 0 0 36px; }}
  .grid {{ display: flex; flex-wrap: wrap; gap: 16px; align-items: stretch; }}
  .card {{ width: calc(var(--card-size, {args.size}px) + 48px); border: 1px solid #ddd; border-radius: 12px; overflow: hidden; background: #fff; }}
  .art {{ width: 100%; height: calc(var(--size) + 48px); display: grid; place-items: center; background: #fafafa; }}
  .art > svg {{ width: var(--size); height: var(--size); max-width: var(--size); max-height: var(--size); }}
  .caption {{ border-top: 1px solid #ddd; padding: 12px 16px; font-size: 14px; font-weight: 600; }}
  @media (max-width: 520px) {{ body {{ margin: 16px; }} .grid {{ gap: 12px; }} }}
</style>
</head>
<body>
<h1>{html.escape(args.title)}</h1>
{section('ラベルなし: 意味的距離・弁別性', items, args.size, False)}
{section('ラベルあり: 一覧での視覚重量', items, args.size, True)}
</body>
</html>
"""

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(document, encoding="utf-8")
    print(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
