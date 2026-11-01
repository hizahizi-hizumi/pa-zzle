#!/usr/bin/env python3
"""Generate a self-review or human-review gallery for showcase pictograms.

self:  one sandboxed srcdoc iframe per candidate (candidates share class names, so they are never
       inlined into one document), with replay, pause, a time scrubber and a play-attribute toggle.
human: a mobile-first single column page. Every SVG is shown through <img src="data:image/svg+xml...">
       with the host context (color variables, .dark, data-pictogram-motion) put on its root <svg>,
       so candidates stay isolated without iframes. Decisions and notes are kept in localStorage and,
       with --db-doc, in the artifact database.
"""

from __future__ import annotations

import argparse
import base64
import html
import json
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from check_self_review import load_json as load_self_review_json
from check_self_review import validate as validate_self_review

REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_GLOBALS_CSS = REPOSITORY_ROOT / "frontend/styles/globals.css"
DEFAULT_GAMES_DIR = REPOSITORY_ROOT / "frontend/src/games"
THEME_TOKENS = ("foreground", "muted-foreground", "background", "muted", "ring", "border")
FALLBACK_THEMES = {
    "light": {
        "foreground": "oklch(0.145 0 0)",
        "muted-foreground": "oklch(0.556 0 0)",
        "background": "oklch(1 0 0)",
        "muted": "oklch(0.97 0 0)",
        "ring": "oklch(0.708 0 0)",
        "border": "oklch(0.922 0 0)",
    },
    "dark": {
        "foreground": "oklch(0.985 0 0)",
        "muted-foreground": "oklch(0.708 0 0)",
        "background": "oklch(0.145 0 0)",
        "muted": "oklch(0.269 0 0)",
        "ring": "oklch(0.556 0 0)",
        "border": "oklch(1 0 0 / 10%)",
    },
}
THEME_SELECTORS = {"light": ":root", "dark": ".dark"}
# Showcase SVGs switch dark-theme colors with an ancestor .dark selector, as the app does.
THEME_ROOT_CLASSES = {"light": "", "dark": " dark"}
THEME_LABELS = {"light": "ライト", "dark": "ダーク"}
DECISIONS = (
    ("candidate", "候補"),
    ("explore", "掘る"),
    ("part", "一部"),
    ("reject", "除外"),
)
# App sizes (GameSelectionGallery): hero box 170px / 225px with 16px / 24px padding,
# list button 78px / 100px with 18% / 20% padding; sm breakpoint 640px.
HERO = {"mobile": (138, 16), "desktop": (177, 24)}
LIST = {"mobile": (78, 0.18), "desktop": (100, 0.20)}
# The list item pads its pictogram by roughly 18-20% of the button size.
LIST_PADDING_RATIO = 0.3
THEME_ROW_CHROME = 56


@dataclass(frozen=True)
class Sizes:
    hero: tuple[int, ...]
    list: tuple[int, ...]

    @property
    def frame_height(self) -> int:
        """Initial iframe height before the script fits it to the content."""
        tallest = max((*self.hero, *(round(size * (1 + 2 * LIST_PADDING_RATIO)) for size in self.list)))
        return 2 * (tallest + THEME_ROW_CHROME) + 2 * (max(self.list) + THEME_ROW_CHROME)


def parse_sizes(value: str) -> tuple[int, ...]:
    try:
        sizes = tuple(int(part) for part in value.split(",") if part.strip())
    except ValueError as error:
        raise argparse.ArgumentTypeError(f"sizes must be comma-separated integers: {value}") from error
    if not sizes or any(size <= 0 for size in sizes):
        raise argparse.ArgumentTypeError(f"sizes must be positive: {value}")
    return sizes


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a self-review or human-review gallery for showcase pictograms."
    )
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--audience", choices=("self", "human"), default="self")
    parser.add_argument("--self-review", type=Path)
    parser.add_argument("--hero-sizes", type=parse_sizes, default=(177, 138), help="self gallery only")
    parser.add_argument("--list-sizes", type=parse_sizes, default=(60, 50), help="self gallery only")
    parser.add_argument("--globals-css", type=Path, default=DEFAULT_GLOBALS_CSS)
    parser.add_argument(
        "--games-dir",
        type=Path,
        default=DEFAULT_GAMES_DIR,
        help="directory whose */assets/pictogram.svg are shown next to the candidate at list size",
    )
    parser.add_argument(
        "--db-doc",
        help="human gallery: also save the review to the artifact database doc reviews/<id>",
    )
    return parser.parse_args()


def css_block(css: str, selector: str) -> str | None:
    match = re.search(rf"(?m)^{re.escape(selector)}\s*\{{(.*?)^\}}", css, re.DOTALL)
    return match.group(1) if match else None


def load_themes(path: Path) -> dict[str, dict[str, str]]:
    try:
        css = path.read_text(encoding="utf-8")
    except OSError as error:
        print(f"WARN: cannot read {path}; using fallback theme values: {error}", file=sys.stderr)
        return FALLBACK_THEMES

    themes: dict[str, dict[str, str]] = {}
    for theme, selector in THEME_SELECTORS.items():
        block = css_block(css, selector) or ""
        values: dict[str, str] = {}
        for token in THEME_TOKENS:
            match = re.search(rf"--{re.escape(token)}\s*:\s*([^;]+);", block)
            if match:
                values[token] = match.group(1).strip()
            else:
                print(
                    f"WARN: --{token} not found in {selector} of {path}; using fallback",
                    file=sys.stderr,
                )
                values[token] = FALLBACK_THEMES[theme][token]
        themes[theme] = values
    return themes


def load_manifest(path: Path) -> dict[str, Any]:
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict):
        raise ValueError("manifest root must be an object")
    candidates = manifest.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        raise ValueError("manifest candidates must be a non-empty array")
    if any(not isinstance(candidate, dict) for candidate in candidates):
        raise ValueError("each candidate must be an object")
    return manifest


def human_candidates(
    manifest: dict[str, Any], self_review_path: Path | None
) -> list[dict[str, Any]]:
    if self_review_path is None:
        raise ValueError("--audience human requires --self-review")

    self_review = load_self_review_json(self_review_path)
    errors = validate_self_review(manifest, self_review)
    if errors:
        raise ValueError("self-review gate failed: " + "; ".join(errors))

    reviews = self_review["candidates"]
    candidates = [
        candidate for candidate in manifest["candidates"] if reviews[candidate["id"]]["result"] == "pass"
    ]
    if not candidates:
        raise ValueError("human review requires at least one self-reviewed pass candidate")
    return candidates


def resolve(manifest_path: Path, value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else manifest_path.parent / path


def read_svg(manifest_path: Path, value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} has no file")
    return resolve(manifest_path, value).read_text(encoding="utf-8")


def other_game_pictograms(games_dir: Path, game_id: str) -> list[tuple[str, str]]:
    """Monochrome pictograms of the other games, shown unselected next to the candidate."""
    if not games_dir.is_dir():
        print(f"WARN: games dir not found; no comparison row: {games_dir}", file=sys.stderr)
        return []
    return [
        (path.parents[1].name, path.read_text(encoding="utf-8"))
        for path in sorted(games_dir.glob("*/assets/pictogram.svg"))
        if path.parents[1].name != game_id
    ]


def text_field(candidate: dict[str, Any], key: str) -> str:
    return str(candidate.get(key, "")).strip()


def candidate_fields(candidate: dict[str, Any]) -> tuple[str, dict[str, str]]:
    candidate_id = text_field(candidate, "id")
    keys = ("hypothesis", "aim_play", "aim_payoff", "static_pose", "playback")
    fields = {key: text_field(candidate, key) for key in keys}
    missing = [key for key, value in fields.items() if not value]
    if not candidate_id or missing:
        raise ValueError(f"candidate {candidate_id or '(unknown)'} is missing: {', '.join(missing) or 'id'}")
    return candidate_id, fields


def grouped_by_family(candidates: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for candidate in candidates:
        grouped[str(candidate.get("family") or "未分類")].append(candidate)
    return grouped


def theme_style(themes: dict[str, dict[str, str]]) -> str:
    rules = []
    for theme, values in themes.items():
        rules.append(
            f".pzg-{theme}{{--pzg-fg:{values['foreground']};--pzg-muted-fg:{values['muted-foreground']};"
            f"--pzg-bg:{values['background']};--pzg-muted:{values['muted']};--pzg-ring:{values['ring']};"
            f"--pzg-border:{values['border']}}}"
        )
    return "".join(rules)


def preview_document(
    svg: str,
    themes: dict[str, dict[str, str]],
    sizes: Sizes,
    playable: bool,
    others: list[tuple[str, str]],
) -> str:
    style = (
        "<style>"
        "html,body{margin:0;font:11px/1.3 system-ui,sans-serif}"
        ".pzg-theme{padding:10px 12px;background:var(--pzg-bg);color:var(--pzg-fg);"
        "--game-pictogram-strong:var(--pzg-fg);--game-pictogram-soft:var(--pzg-muted-fg)}"
        ".pzg-row{display:flex;flex-wrap:wrap;align-items:flex-end;gap:14px}"
        ".pzg-compare{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px}"
        ".pzg-slot{display:grid;justify-items:center;gap:4px}"
        ".pzg-hero-surface{background:color-mix(in oklab,var(--pzg-muted) 30%,var(--pzg-bg))}"
        ".pzg-list-surface{border:2px solid var(--pzg-ring);border-radius:12px;background:var(--pzg-bg)}"
        ".pzg-other-surface{border:1px solid var(--pzg-border);border-radius:12px;background:var(--pzg-bg)}"
        ".pzg-frame{display:block}"
        ".pzg-frame>svg{display:block;width:100%;height:100%}"
        ".pzg-caption{color:var(--pzg-muted-fg);white-space:nowrap}"
        f"{theme_style(themes)}"
        "</style>"
    )
    list_size = min(sizes.list)
    sections = []
    for theme in themes:
        slots = []
        for size in sizes.hero:
            motion = ' data-pictogram-motion="play"' if playable else ""
            label = "再生" if playable else "静止"
            slots.append(
                f'<div class="pzg-slot"><div class="pzg-hero-surface">'
                f'<span class="pzg-frame pzg-hero"{motion} style="width:{size}px;height:{size}px">{svg}</span>'
                f'</div><span class="pzg-caption">ヒーロー {size}px {label}</span></div>'
            )
        for size in sizes.list:
            padding = round(size * LIST_PADDING_RATIO)
            slots.append(
                f'<div class="pzg-slot"><div class="pzg-list-surface" style="padding:{padding}px">'
                f'<span class="pzg-frame" style="width:{size}px;height:{size}px">{svg}</span>'
                f'</div><span class="pzg-caption">一覧選択中 {size}px 静止</span></div>'
            )
        compare = ""
        if others:
            padding = round(list_size * LIST_PADDING_RATIO)
            tiles = "".join(
                f'<span class="pzg-other-surface" title="{html.escape(game)}" style="padding:{padding}px">'
                f'<span class="pzg-frame" style="width:{list_size}px;height:{list_size}px">{other}</span></span>'
                for game, other in others
            )
            compare = (
                f'<div class="pzg-compare"><span class="pzg-caption">他ゲームと {list_size}px</span>'
                f'<span class="pzg-list-surface" style="padding:{padding}px">'
                f'<span class="pzg-frame" style="width:{list_size}px;height:{list_size}px">{svg}</span></span>'
                f"{tiles}</div>"
            )
        sections.append(
            f'<section class="pzg-theme pzg-{theme}{THEME_ROOT_CLASSES[theme]}" aria-label="{THEME_LABELS[theme]}">'
            f'<div class="pzg-row">{"".join(slots)}</div>{compare}</section>'
        )
    return f"<!doctype html><html><head>{style}</head><body>{''.join(sections)}</body></html>"


def preview_frame(title: str, document: str, sizes: Sizes) -> str:
    return (
        f'<iframe class="preview" title="{html.escape(title)}" sandbox="allow-same-origin" '
        f'style="height:{sizes.frame_height}px" srcdoc="{html.escape(document, quote=True)}"></iframe>'
    )


def decision_buttons(candidate_id: str) -> str:
    return "".join(
        f'<button type="button" class="decision" data-id="{html.escape(candidate_id)}" '
        f'data-decision="{value}">{label}</button>'
        for value, label in DECISIONS
    )


def self_card(
    manifest_path: Path,
    candidate: dict[str, Any],
    themes: dict[str, dict[str, str]],
    sizes: Sizes,
    others: list[tuple[str, str]],
) -> str:
    candidate_id, fields = candidate_fields(candidate)
    svg = read_svg(manifest_path, candidate.get("file"), f"candidate {candidate_id}")
    document = preview_document(svg, themes, sizes, True, others)
    notes = text_field(candidate, "notes")
    notes_html = f'<p class="notes"><strong>補足:</strong> {html.escape(notes)}</p>' if notes else ""
    escaped_id = html.escape(candidate_id)
    name = text_field(candidate, "name")
    name_html = f"{html.escape(name)} <small>{escaped_id}</small>" if name else escaped_id
    return f"""
<article class="card" data-candidate-id="{escaped_id}">
  {preview_frame(f"{candidate_id} preview", document, sizes)}
  <div class="controls">
    <button type="button" class="replay-one">最初から再生</button>
    <button type="button" class="toggle-motion">再生属性を外す</button>
    <label class="scrub">時刻 <input type="range" class="scrubber" min="0" max="1000" value="0" step="1"> <output class="time">-</output></label>
  </div>
  <div class="body">
    <h3>{name_html} <span class="playback">{html.escape(fields["playback"])}</span></h3>
    <p><strong>案:</strong> {html.escape(fields["hypothesis"])}</p>
    <p><strong>A 遊び:</strong> {html.escape(fields["aim_play"])}</p>
    <p><strong>B 見せ場:</strong> {html.escape(fields["aim_payoff"])}</p>
    <p><strong>静止状態:</strong> {html.escape(fields["static_pose"])}</p>
    {notes_html}
    <div class="decisions" role="group" aria-label="{escaped_id} のレビュー">
      {decision_buttons(candidate_id)}
    </div>
    <label class="note-label">メモ
      <textarea class="review-note" rows="2"></textarea>
    </label>
  </div>
</article>
"""


def self_base_section(
    manifest_path: Path, manifest: dict[str, Any], themes: dict[str, dict[str, str]], sizes: Sizes
) -> str:
    base = manifest.get("base_pictogram")
    if not base:
        return ""
    svg = read_svg(manifest_path, base, "base_pictogram")
    document = preview_document(svg, themes, sizes, False, [])
    return f"""
<section class="family">
  <h2>基準（白黒版）</h2>
  <div class="grid"><article class="card base">{preview_frame("base pictogram", document, sizes)}</article></div>
</section>
"""


SELF_SCRIPT = """
(() => {
  const storageKey = __STORAGE_KEY__;
  const output = document.getElementById('review-output');
  let paused = false;
  let review = {};

  try { review = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { review = {}; }
  const save = () => { try { localStorage.setItem(storageKey, JSON.stringify(review)); } catch {} };

  const frameOf = (card) => card.querySelector('.preview');
  const animationsOf = (card) => frameOf(card).contentDocument?.getAnimations() ?? [];
  // One cycle: delay + duration (an infinite loop counts one iteration).
  const cycleLength = (animations) => animations.reduce((longest, animation) => {
    const timing = animation.effect.getComputedTiming();
    const iterations = Number.isFinite(timing.iterations) ? timing.iterations : 1;
    return Math.max(longest, (timing.delay || 0) + Number(timing.duration || 0) * iterations);
  }, 0);

  const fitHeight = (card) => {
    const doc = frameOf(card).contentDocument;
    if (doc?.body) frameOf(card).style.height = `${Math.ceil(doc.documentElement.scrollHeight)}px`;
  };

  const refreshScrubber = (card) => {
    const length = Math.round(cycleLength(animationsOf(card)));
    const scrubber = card.querySelector('.scrubber');
    if (!scrubber) return;
    // The last frame of a cycle is length - 1: at length a loop is back at 0% and a one-shot has ended.
    scrubber.max = String(Math.max(length - 1, 0));
    scrubber.value = '0';
    card.querySelector('.time').textContent = length ? `再生中 / 周期 ${length}ms` : 'アニメーションなし';
  };

  const applyPause = (card) => animationsOf(card).forEach((animation) => paused ? animation.pause() : animation.play());

  const afterLoad = (card) => requestAnimationFrame(() => { fitHeight(card); refreshScrubber(card); applyPause(card); });

  const replay = (card) => {
    const frame = frameOf(card);
    frame.onload = () => afterLoad(card);
    frame.setAttribute('srcdoc', frame.getAttribute('srcdoc'));
    const toggle = card.querySelector('.toggle-motion');
    if (toggle) { toggle.dataset.state = 'on'; toggle.textContent = '再生属性を外す'; }
  };

  document.querySelectorAll('.card').forEach((card) => {
    const frame = frameOf(card);
    frame.addEventListener('load', () => afterLoad(card), { once: true });
    if (frame.contentDocument?.readyState === 'complete') afterLoad(card);
    const id = card.dataset.candidateId;
    if (!id) return;
    const state = review[id] || {};
    if (state.decision) card.querySelector(`[data-decision="${state.decision}"]`)?.classList.add('active');
    card.querySelector('.review-note').value = state.note || '';
  });
  window.addEventListener('resize', () => document.querySelectorAll('.card').forEach(fitHeight));

  document.getElementById('replay-all').addEventListener('click', () => document.querySelectorAll('.card[data-candidate-id]').forEach(replay));
  document.getElementById('pause-all').addEventListener('click', (event) => {
    paused = !paused;
    document.querySelectorAll('.card').forEach(applyPause);
    event.currentTarget.textContent = paused ? '再開' : '一時停止';
  });
  document.querySelectorAll('.replay-one').forEach((button) => button.addEventListener('click', () => replay(button.closest('.card'))));
  document.querySelectorAll('.toggle-motion').forEach((button) => button.addEventListener('click', () => {
    const card = button.closest('.card');
    const heroes = frameOf(card).contentDocument?.querySelectorAll('.pzg-hero') ?? [];
    const playing = button.dataset.state !== 'off';
    heroes.forEach((hero) => playing ? hero.removeAttribute('data-pictogram-motion') : hero.setAttribute('data-pictogram-motion', 'play'));
    button.dataset.state = playing ? 'off' : 'on';
    button.textContent = playing ? '再生属性を付ける' : '再生属性を外す';
    afterLoad(card);
  }));
  document.querySelectorAll('.scrubber').forEach((scrubber) => scrubber.addEventListener('input', () => {
    const card = scrubber.closest('.card');
    const time = Number(scrubber.value);
    animationsOf(card).forEach((animation) => { animation.pause(); animation.currentTime = time; });
    card.querySelector('.time').textContent = `${time}ms / ${scrubber.max}ms で停止`;
  }));
  document.querySelectorAll('.decision').forEach((button) => button.addEventListener('click', () => {
    const card = button.closest('.card');
    const id = card.dataset.candidateId;
    const nextDecision = button.dataset.decision;
    const currentDecision = review[id]?.decision;
    review[id] = { ...(review[id] || {}), decision: currentDecision === nextDecision ? null : nextDecision };
    card.querySelectorAll('.decision').forEach((item) => item.classList.remove('active'));
    if (review[id].decision) button.classList.add('active');
    save();
  }));
  document.querySelectorAll('.review-note').forEach((textarea) => textarea.addEventListener('input', () => {
    const id = textarea.closest('.card').dataset.candidateId;
    review[id] = { ...(review[id] || {}), note: textarea.value };
    save();
  }));
  document.getElementById('show-review').addEventListener('click', () => {
    output.value = JSON.stringify(review, null, 2);
    output.style.display = 'block';
    output.select();
  });
})();
"""


def build_self_document(
    manifest_path: Path,
    manifest: dict[str, Any],
    candidates: list[dict[str, Any]],
    themes: dict[str, dict[str, str]],
    sizes: Sizes,
    others: list[tuple[str, str]],
) -> str:
    sections = self_base_section(manifest_path, manifest, themes, sizes) + "\n".join(
        f"""
<section class="family">
  <h2>{html.escape(family)}</h2>
  <div class="grid">{"".join(self_card(manifest_path, candidate, themes, sizes, others) for candidate in members)}</div>
</section>
"""
        for family, members in grouped_by_family(candidates).items()
    )
    title = str(manifest.get("title") or "Showcase pictogram review")
    storage_key = "pictogram-showcase-self-review:" + str(manifest_path.resolve())
    script = SELF_SCRIPT.replace("__STORAGE_KEY__", json.dumps(storage_key))

    return f"""<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<style>
  :root {{ font-family: system-ui, sans-serif; color: #151515; background: #f2f2f2; }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; padding: 16px 24px 32px; }}
  header {{ margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid #ddd; }}
  h1 {{ margin: 0 0 10px; font-size: 20px; }}
  .hint {{ margin: 0 0 10px; font-size: 12px; color: #555; }}
  .toolbar, .controls {{ display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }}
  button {{ font: inherit; border: 1px solid #bbb; border-radius: 8px; background: #fff; padding: 6px 10px; cursor: pointer; }}
  button:hover {{ background: #eee; }}
  .family {{ margin-bottom: 32px; }}
  .family > h2 {{ font-size: 17px; margin: 0 0 12px; }}
  .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 600px), 1fr)); gap: 14px; align-items: start; }}
  .card {{ min-width: 0; border: 1px solid #ddd; border-radius: 12px; overflow: hidden; background: #fff; }}
  .preview {{ display: block; width: 100%; border: 0; }}
  .controls {{ padding: 10px 14px; border-top: 1px solid #e5e5e5; font-size: 12px; }}
  .scrub {{ display: flex; gap: 6px; align-items: center; flex: 1; min-width: 220px; }}
  .scrubber {{ flex: 1; }}
  .body {{ padding: 12px 14px; border-top: 1px solid #e5e5e5; }}
  h3 {{ margin: 0; font-size: 15px; }}
  h3 small {{ font-weight: 400; color: #777; }}
  .playback {{ font-size: 11px; font-weight: 500; color: #555; border: 1px solid #ccc; border-radius: 6px; padding: 1px 6px; }}
  p {{ margin: 8px 0 0; font-size: 13px; line-height: 1.5; }}
  .notes {{ color: #555; }}
  .decisions {{ display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }}
  .decision.active {{ border-color: #222; background: #222; color: #fff; }}
  .note-label {{ display: grid; gap: 5px; margin-top: 10px; font-size: 12px; font-weight: 600; }}
  textarea {{ width: 100%; resize: vertical; border: 1px solid #ccc; border-radius: 8px; padding: 7px; font: inherit; font-weight: 400; }}
  #review-output {{ display: none; width: 100%; min-height: 180px; margin-top: 12px; }}
  @media (max-width: 560px) {{ body {{ padding: 12px; }} }}
</style>
</head>
<body>
<header>
  <h1>{html.escape(title)}</h1>
  <p class="hint">ヒーローは祖先に data-pictogram-motion="play" を付けて再生、一覧選択中は属性なしで静止。ダークは祖先に .dark クラスを付けて表示。時刻スライダーの最大値は周期 - 1ms（cut / seam の 100% 直前、once の終点）。静止状態との一致・切り替え・動きを減らす設定は observe_animation.cjs で測る。</p>
  <div class="toolbar">
    <button type="button" id="replay-all">すべて最初から再生</button>
    <button type="button" id="pause-all">一時停止</button>
    <button type="button" id="show-review">レビューJSONを表示</button>
  </div>
  <textarea id="review-output" readonly></textarea>
</header>
<main>{sections}</main>
<script>{script}</script>
</body>
</html>
"""


ROOT_SVG = re.compile(r"<svg\b([^>]*)>", re.IGNORECASE)


def with_root_attributes(svg: str, values: dict[str, str], theme: str, play: bool) -> str:
    """Put the host context on the root <svg>, merging an existing class / style attribute."""
    match = ROOT_SVG.search(svg)
    if not match:
        raise ValueError("SVG has no <svg> root element")
    attributes = match.group(1)
    style = (
        f"--game-pictogram-strong:{values['foreground']};"
        f"--game-pictogram-soft:{values['muted-foreground']}"
    )
    existing_style = re.search(r'\sstyle="([^"]*)"', attributes)
    if existing_style:
        style = f"{existing_style.group(1).rstrip(';')};{style}"
        attributes = attributes.replace(existing_style.group(0), "")
    classes = "dark" if theme == "dark" else ""
    existing_class = re.search(r'\sclass="([^"]*)"', attributes)
    if existing_class:
        classes = f"{existing_class.group(1)} {classes}".strip()
        attributes = attributes.replace(existing_class.group(0), "")
    extra = f' style="{html.escape(style, quote=True)}"'
    if classes:
        extra += f' class="{classes}"'
    if play:
        extra += ' data-pictogram-motion="play"'
    return svg[: match.start()] + f"<svg{attributes.rstrip('/')}{extra}>" + svg[match.end() :]


def data_uri(svg: str) -> str:
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode("utf-8")).decode("ascii")


def themed_images(svg: str, themes: dict[str, dict[str, str]], play: bool, extra_class: str = "") -> str:
    images = []
    for theme, values in themes.items():
        uri = data_uri(with_root_attributes(svg, values, theme, play))
        classes = f"th-{theme}{' anim' if play else ''}{(' ' + extra_class) if extra_class else ''}"
        source = f' data-src="{uri}"' if play else ""
        images.append(f'<img class="{classes}" alt=""{source} src="{uri}">')
    return "".join(images)


def human_card(
    manifest_path: Path,
    candidate: dict[str, Any],
    themes: dict[str, dict[str, str]],
    others: list[tuple[str, str]],
) -> str:
    candidate_id, fields = candidate_fields(candidate)
    svg = read_svg(manifest_path, candidate.get("file"), f"candidate {candidate_id}")
    escaped_id = html.escape(candidate_id)
    name = text_field(candidate, "name")
    subtitle = f"{escaped_id} · " if name else ""
    notes = text_field(candidate, "notes")
    notes_html = f"<p><b>補足:</b> {html.escape(notes)}</p>" if notes else ""
    still = themed_images(svg, themes, False)
    compare = ""
    if others:
        tiles = "".join(
            f'<span class="tile other" title="{html.escape(game)}">{themed_images(other, themes, False)}</span>'
            for game, other in others
        )
        compare = (
            '<figure class="compare"><div class="compare-row">'
            f'<span class="tile selected">{still}</span>{tiles}</div>'
            "<figcaption>一覧で他のパズルと並べた姿（左端が選択中）</figcaption></figure>"
        )
    return f"""
<article class="card" data-id="{escaped_id}">
  <h3>{html.escape(name or candidate_id)} <small>{subtitle}{html.escape(fields["playback"])}</small></h3>
  <p class="meta">{html.escape(fields["hypothesis"])}</p>
  <div class="views">
    <figure class="hero">{themed_images(svg, themes, True)}<figcaption>ヒーロー（再生）</figcaption></figure>
    <figure><span class="tile selected">{still}</span><figcaption>一覧の選択中（静止）</figcaption></figure>
  </div>
  <button type="button" class="replay">最初から再生</button>
  {compare}
  <details><summary>狙いと静止状態</summary>
    <p><b>A 遊び:</b> {html.escape(fields["aim_play"])}</p>
    <p><b>B 見せ場:</b> {html.escape(fields["aim_payoff"])}</p>
    <p><b>静止状態:</b> {html.escape(fields["static_pose"])}</p>
    {notes_html}
  </details>
  <div class="decisions" role="group" aria-label="{escaped_id} の判定">{decision_buttons(candidate_id)}</div>
  <textarea class="note" rows="2" placeholder="メモ"></textarea>
</article>"""


HUMAN_SCRIPT = """
(() => {
  const storageKey = __STORAGE_KEY__;
  const dbDoc = __DB_DOC__;
  const meta = __META__;
  const empty = () => ({ candidates: {}, overall: '' });
  let review = empty();
  try { review = { ...empty(), ...JSON.parse(localStorage.getItem(storageKey) || '{}') }; } catch { review = empty(); }
  const status = document.getElementById('save-status');
  let schedulePush = () => {};
  const save = () => { try { localStorage.setItem(storageKey, JSON.stringify(review)); } catch {} schedulePush(); };
  const entry = (id) => (review.candidates[id] = review.candidates[id] || {});

  const render = () => {
    document.querySelectorAll('.card').forEach((card) => {
      const state = review.candidates[card.dataset.id] || {};
      card.querySelectorAll('.decision').forEach((button) => button.classList.toggle('active', button.dataset.decision === state.decision));
      card.querySelector('.note').value = state.note || '';
    });
    document.getElementById('overall').value = review.overall || '';
  };

  // An <img> SVG restarts its animation only when its document is reloaded.
  const restart = (img) => { const source = img.dataset.src; img.src = 'data:,'; requestAnimationFrame(() => { img.src = source; }); };
  const visibleHeroes = (root) => root.querySelectorAll(document.body.classList.contains('dark') ? 'img.anim.th-dark' : 'img.anim.th-light');

  document.querySelectorAll('.card').forEach((card) => {
    const id = card.dataset.id;
    card.querySelector('.note').addEventListener('input', (event) => { entry(id).note = event.target.value; save(); });
    card.querySelectorAll('.decision').forEach((button) => button.addEventListener('click', () => {
      const next = button.dataset.decision;
      entry(id).decision = entry(id).decision === next ? null : next;
      card.querySelectorAll('.decision').forEach((item) => item.classList.toggle('active', item.dataset.decision === entry(id).decision));
      save();
    }));
    card.querySelector('.replay').addEventListener('click', () => visibleHeroes(card).forEach(restart));
  });
  document.getElementById('overall').addEventListener('input', (event) => { review.overall = event.target.value; save(); });
  document.getElementById('replay-all').addEventListener('click', () => visibleHeroes(document).forEach(restart));
  const themeButton = document.getElementById('theme');
  themeButton.addEventListener('click', () => {
    const dark = document.body.classList.toggle('dark');
    themeButton.textContent = dark ? 'ライトで見る' : 'ダークで見る';
    visibleHeroes(document).forEach(restart);
  });
  const output = document.getElementById('review-output');
  document.getElementById('show-review').addEventListener('click', () => {
    output.value = JSON.stringify({ ...meta, ...review }, null, 2);
    output.hidden = false;
    output.select();
    navigator.clipboard?.writeText(output.value).catch(() => {});
  });
  render();

  if (!dbDoc) { status.textContent = 'この端末にのみ保存（下の「レビューJSON」で書き出し）'; return; }
  const offline = () => { status.textContent = 'DB 未接続（この端末にのみ保存）'; };
  status.textContent = 'DB 接続中…';
  let db = null, writing = false, pending = false, timer = null;
  const push = async () => {
    if (!db) { offline(); return; }
    if (writing) { pending = true; return; }
    writing = true;
    try {
      await db.doc(dbDoc).set({ review: JSON.parse(JSON.stringify({ ...meta, ...review })), updatedAt: new Date().toISOString() });
      status.textContent = 'DB に保存済み';
    } catch (error) { status.textContent = 'DB 保存に失敗: ' + (error && error.message ? error.message : error); }
    writing = false;
    if (pending) { pending = false; push(); }
  };
  schedulePush = () => { if (!db) return; clearTimeout(timer); status.textContent = '保存待ち…'; timer = setTimeout(push, 600); };
  const connectTimer = setTimeout(() => { if (!db) offline(); }, 10000);
  if (!(window.claude && typeof window.claude.use === 'function')) { clearTimeout(connectTimer); offline(); return; }
  window.claude.use('db').then(async (namespace) => {
    clearTimeout(connectTimer);
    if (!namespace) { offline(); return; }
    db = namespace;
    status.textContent = 'DB 接続済み';
    const local = Object.keys(review.candidates).length > 0 || review.overall;
    if (!local) {
      try {
        const snapshot = await db.doc(dbDoc).get();
        const data = snapshot && typeof snapshot.data === 'function' ? snapshot.data() : snapshot;
        if (data && data.review) {
          review = { ...empty(), candidates: data.review.candidates || {}, overall: data.review.overall || '' };
          try { localStorage.setItem(storageKey, JSON.stringify(review)); } catch {}
          render();
        }
      } catch {}
    } else {
      push();
    }
  }).catch(() => { clearTimeout(connectTimer); offline(); });
})();
"""


def build_human_document(
    manifest_path: Path,
    manifest: dict[str, Any],
    candidates: list[dict[str, Any]],
    themes: dict[str, dict[str, str]],
    others: list[tuple[str, str]],
    db_doc: str | None,
) -> str:
    light, dark = themes["light"], themes["dark"]
    families = "".join(
        f'<h2 class="family">{html.escape(family)}</h2>'
        + "".join(human_card(manifest_path, candidate, themes, others) for candidate in members)
        for family, members in grouped_by_family(candidates).items()
    )
    base = manifest.get("base_pictogram")
    base_html = ""
    if base:
        base_svg = read_svg(manifest_path, base, "base_pictogram")
        base_html = (
            f'<figure class="base"><span class="tile">{themed_images(base_svg, themes, False)}</span>'
            "<figcaption>基準（白黒版）</figcaption></figure>"
        )
    title = str(manifest.get("title") or "Showcase pictogram review")
    game_id = str(manifest.get("game_id") or "")
    storage_key = f"pictogram-showcase-review:{game_id}:{db_doc or manifest_path.resolve()}"
    script = (
        HUMAN_SCRIPT.replace("__STORAGE_KEY__", json.dumps(storage_key))
        .replace("__DB_DOC__", json.dumps(f"reviews/{db_doc}" if db_doc else None))
        .replace("__META__", json.dumps({"title": title, "game_id": game_id}, ensure_ascii=False))
    )
    hero_mobile, hero_mobile_pad = HERO["mobile"]
    hero_desktop, hero_desktop_pad = HERO["desktop"]
    list_mobile, list_mobile_pad = LIST["mobile"]
    list_desktop, list_desktop_pad = LIST["desktop"]

    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<style>
  :root {{ font-family: system-ui, -apple-system, sans-serif; }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; --fg: {light['foreground']}; --muted-fg: {light['muted-foreground']}; --bg: {light['background']};
    --muted: {light['muted']}; --ring: {light['ring']}; --border: {light['border']}; --page: #f4f4f4;
    background: var(--page); color: var(--fg); color-scheme: light; }}
  body.dark {{ --fg: {dark['foreground']}; --muted-fg: {dark['muted-foreground']}; --bg: {dark['background']};
    --muted: {dark['muted']}; --ring: {dark['ring']}; --border: {dark['border']}; --page: #0a0a0a; color-scheme: dark; }}
  body:not(.dark) .th-dark, body.dark .th-light {{ display: none !important; }}
  .wrap {{ max-width: 560px; margin: 0 auto; padding: 16px 14px 48px; }}
  h1 {{ font-size: 18px; line-height: 1.4; margin: 0 0 6px; }}
  .lead, .meta, small, figcaption, #save-status {{ color: var(--muted-fg); }}
  .lead {{ font-size: 13px; margin: 0 0 10px; line-height: 1.6; }}
  .bar {{ display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 8px; }}
  button {{ font: inherit; font-size: 14px; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--muted-fg); background: var(--bg); color: var(--fg); }}
  #save-status {{ font-size: 12px; }}
  .family {{ font-size: 15px; margin: 24px 0 8px; line-height: 1.4; }}
  .card {{ background: var(--bg); border-radius: 12px; padding: 14px; margin-bottom: 14px; border: 1px solid var(--border); }}
  .card h3 {{ font-size: 16px; margin: 0 0 4px; line-height: 1.4; }}
  .card small {{ font-weight: 400; font-size: 11px; }}
  .meta {{ font-size: 12px; margin: 0 0 10px; line-height: 1.5; }}
  .views {{ display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap; }}
  figure {{ margin: 0; text-align: center; }}
  figcaption {{ font-size: 11px; margin-top: 4px; }}
  .hero {{ background: color-mix(in oklab, var(--muted) 30%, var(--bg)); border-radius: 8px; padding: {hero_mobile_pad}px; }}
  .hero img {{ display: block; width: {hero_mobile}px; height: {hero_mobile}px; }}
  .tile {{ display: inline-flex; width: {list_mobile}px; height: {list_mobile}px; padding: {round(list_mobile * list_mobile_pad)}px;
    border-radius: 12px; border: 1px solid var(--border); background: var(--bg); flex: none; }}
  .tile.selected {{ border: 2px solid var(--ring); }}
  .tile img {{ display: block; width: 100%; height: 100%; }}
  .replay {{ margin-top: 10px; }}
  .compare {{ margin-top: 12px; text-align: left; }}
  .compare-row {{ display: flex; flex-wrap: wrap; gap: 12px; }}
  details {{ margin-top: 10px; font-size: 13px; line-height: 1.6; }}
  details p {{ margin: 6px 0; }}
  .decisions {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 12px; }}
  .decision {{ padding: 10px 0; }}
  .decision.active {{ background: var(--fg); color: var(--bg); border-color: var(--fg); }}
  textarea {{ width: 100%; margin-top: 8px; font: inherit; font-size: 16px; padding: 8px; border-radius: 8px;
    border: 1px solid var(--muted-fg); background: var(--bg); color: var(--fg); }}
  .base {{ display: inline-block; margin: 4px 0 0; }}
  #review-output {{ min-height: 160px; font-size: 12px; }}
  @media (min-width: 640px) {{
    .hero {{ padding: {hero_desktop_pad}px; }}
    .hero img {{ width: {hero_desktop}px; height: {hero_desktop}px; }}
    .tile {{ width: {list_desktop}px; height: {list_desktop}px; padding: {round(list_desktop * list_desktop_pad)}px; }}
  }}
</style>
</head>
<body>
<div class="wrap">
<h1>{html.escape(title)}</h1>
<p class="lead">各案の「ヒーロー（再生）」は選んだときに上部へ大きく出る姿、「一覧の選択中（静止）」は下部一覧で選ばれているときの姿です。大きさはこの端末の画面幅でアプリと同じです。判定とメモは自動で保存されます。全体メモは一番下にあります。</p>
<div class="bar">
  <button type="button" id="theme">ダークで見る</button>
  <button type="button" id="replay-all">すべて最初から再生</button>
  <span id="save-status"></span>
</div>
{base_html}
{families}
<h2 class="family">全体メモ</h2>
<textarea id="overall" rows="5" placeholder="候補どうしの比較、組み合わせたい点、次に試したいことなど"></textarea>
<div class="bar"><button type="button" id="show-review">レビューJSON（表示してコピー）</button></div>
<textarea id="review-output" readonly hidden></textarea>
</div>
<script>{script}</script>
</body>
</html>
"""


def main() -> int:
    args = parse_args()
    if args.db_doc is not None and not re.fullmatch(r"[A-Za-z0-9_-]+", args.db_doc):
        raise SystemExit("ERROR: --db-doc must be letters, digits, '_' or '-'")
    try:
        manifest = load_manifest(args.manifest)
        themes = load_themes(args.globals_css)
        others = other_game_pictograms(args.games_dir, str(manifest.get("game_id") or ""))
        if args.audience == "human":
            candidates = human_candidates(manifest, args.self_review)
            document = build_human_document(args.manifest, manifest, candidates, themes, others, args.db_doc)
        else:
            sizes = Sizes(hero=args.hero_sizes, list=args.list_sizes)
            document = build_self_document(
                args.manifest, manifest, manifest["candidates"], themes, sizes, others
            )
    except (OSError, json.JSONDecodeError, ValueError) as error:
        raise SystemExit(f"ERROR: {error}") from error

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(document, encoding="utf-8")
    print(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
