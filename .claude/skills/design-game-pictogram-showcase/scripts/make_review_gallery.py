#!/usr/bin/env python3

from __future__ import annotations

import argparse
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
THEME_TOKENS = ("foreground", "muted-foreground", "background", "muted", "ring")
FALLBACK_THEMES = {
    "light": {
        "foreground": "oklch(0.145 0 0)",
        "muted-foreground": "oklch(0.556 0 0)",
        "background": "oklch(1 0 0)",
        "muted": "oklch(0.97 0 0)",
        "ring": "oklch(0.708 0 0)",
    },
    "dark": {
        "foreground": "oklch(0.985 0 0)",
        "muted-foreground": "oklch(0.708 0 0)",
        "background": "oklch(0.145 0 0)",
        "muted": "oklch(0.269 0 0)",
        "ring": "oklch(0.556 0 0)",
    },
}
THEME_SELECTORS = {"light": ":root", "dark": ".dark"}
THEME_LABELS = {"light": "ライト", "dark": "ダーク"}
DECISIONS = (
    ("candidate", "候補"),
    ("explore", "掘る"),
    ("part", "一部"),
    ("reject", "除外"),
)
# The list item pads its pictogram by roughly 18-20% of the button size.
LIST_PADDING_RATIO = 0.3
THEME_ROW_CHROME = 56


@dataclass(frozen=True)
class Sizes:
    hero: tuple[int, ...]
    list: tuple[int, ...]

    @property
    def frame_height(self) -> int:
        tallest = max((*self.hero, *(round(size * (1 + 2 * LIST_PADDING_RATIO)) for size in self.list)))
        return 2 * (tallest + THEME_ROW_CHROME)


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
    parser.add_argument("--hero-sizes", type=parse_sizes, default=(177, 138))
    parser.add_argument("--list-sizes", type=parse_sizes, default=(60, 50))
    parser.add_argument("--globals-css", type=Path, default=DEFAULT_GLOBALS_CSS)
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
        candidate
        for candidate in manifest["candidates"]
        if isinstance(candidate, dict) and reviews[candidate["id"]]["result"] == "pass"
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


def theme_style(themes: dict[str, dict[str, str]]) -> str:
    rules = []
    for theme, values in themes.items():
        rules.append(
            f".pzg-{theme}{{--pzg-fg:{values['foreground']};--pzg-muted-fg:{values['muted-foreground']};"
            f"--pzg-bg:{values['background']};--pzg-muted:{values['muted']};--pzg-ring:{values['ring']}}}"
        )
    return "".join(rules)


def preview_document(svg: str, themes: dict[str, dict[str, str]], sizes: Sizes, playable: bool) -> str:
    style = (
        "<style>"
        "html,body{margin:0;font:11px/1.3 system-ui,sans-serif}"
        ".pzg-theme{display:flex;flex-wrap:wrap;align-items:flex-end;gap:14px;padding:10px 12px;"
        "background:var(--pzg-bg);color:var(--pzg-fg);"
        "--game-pictogram-strong:var(--pzg-fg);--game-pictogram-soft:var(--pzg-muted-fg)}"
        ".pzg-slot{display:grid;justify-items:center;gap:4px}"
        ".pzg-hero-surface{background:color-mix(in oklab,var(--pzg-muted) 30%,var(--pzg-bg))}"
        ".pzg-list-surface{border:2px solid var(--pzg-ring);border-radius:12px;background:var(--pzg-bg)}"
        ".pzg-frame{display:block}"
        ".pzg-frame>svg{display:block;width:100%;height:100%}"
        ".pzg-caption{color:var(--pzg-muted-fg);white-space:nowrap}"
        f"{theme_style(themes)}"
        "</style>"
    )
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
        sections.append(
            f'<section class="pzg-theme pzg-{theme}" aria-label="{THEME_LABELS[theme]}">{"".join(slots)}</section>'
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


def text_field(candidate: dict[str, Any], key: str) -> str:
    return str(candidate.get(key, "")).strip()


def candidate_card(
    manifest_path: Path, candidate: dict[str, Any], themes: dict[str, dict[str, str]], sizes: Sizes
) -> str:
    candidate_id = text_field(candidate, "id")
    fields = {key: text_field(candidate, key) for key in ("hypothesis", "aim_play", "aim_payoff", "static_pose", "playback")}
    missing = [key for key, value in fields.items() if not value]
    if not candidate_id or missing:
        raise ValueError(f"candidate {candidate_id or '(unknown)'} is missing: {', '.join(missing) or 'id'}")

    svg = read_svg(manifest_path, candidate.get("file"), f"candidate {candidate_id}")
    document = preview_document(svg, themes, sizes, playable=True)
    notes = text_field(candidate, "notes")
    notes_html = f'<p class="notes"><strong>補足:</strong> {html.escape(notes)}</p>' if notes else ""
    escaped_id = html.escape(candidate_id)
    return f"""
<article class="card" data-candidate-id="{escaped_id}">
  {preview_frame(f"{candidate_id} preview", document, sizes)}
  <div class="controls">
    <button type="button" class="replay-one">最初から再生</button>
    <button type="button" class="toggle-motion">再生属性を外す</button>
    <label class="scrub">時刻 <input type="range" class="scrubber" min="0" max="1000" value="0" step="1"> <output class="time">-</output></label>
  </div>
  <div class="body">
    <h3>{escaped_id} <span class="playback">{html.escape(fields["playback"])}</span></h3>
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


def base_section(
    manifest_path: Path, manifest: dict[str, Any], themes: dict[str, dict[str, str]], sizes: Sizes
) -> str:
    base = manifest.get("base_pictogram")
    if not base:
        return ""
    svg = read_svg(manifest_path, base, "base_pictogram")
    document = preview_document(svg, themes, sizes, playable=False)
    return f"""
<section class="family">
  <h2>基準（白黒版）</h2>
  <div class="grid"><article class="card base">{preview_frame("base pictogram", document, sizes)}</article></div>
</section>
"""


def build_document(
    manifest_path: Path,
    manifest: dict[str, Any],
    candidates: list[dict[str, Any]],
    themes: dict[str, dict[str, str]],
    sizes: Sizes,
) -> str:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for candidate in candidates:
        if not isinstance(candidate, dict):
            raise ValueError("each candidate must be an object")
        grouped[str(candidate.get("family") or "未分類")].append(candidate)

    sections = base_section(manifest_path, manifest, themes, sizes) + "\n".join(
        f"""
<section class="family">
  <h2>{html.escape(family)}</h2>
  <div class="grid">{"".join(candidate_card(manifest_path, candidate, themes, sizes) for candidate in members)}</div>
</section>
"""
        for family, members in grouped.items()
    )
    title = str(manifest.get("title") or "Showcase pictogram review")
    storage_key = "pictogram-showcase-review:" + str(manifest_path.resolve())

    return f"""<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<style>
  :root {{ font-family: system-ui, sans-serif; color: #151515; background: #f2f2f2; }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; padding: 24px; }}
  header {{ position: sticky; top: 0; z-index: 10; margin: -24px -24px 24px; padding: 14px 24px; background: rgba(242,242,242,.96); border-bottom: 1px solid #ddd; }}
  h1 {{ margin: 0 0 10px; font-size: 20px; }}
  .hint {{ margin: 0 0 10px; font-size: 12px; color: #555; }}
  .toolbar, .controls {{ display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }}
  button {{ font: inherit; border: 1px solid #bbb; border-radius: 8px; background: #fff; padding: 6px 10px; cursor: pointer; }}
  button:hover {{ background: #eee; }}
  .family {{ margin-bottom: 32px; }}
  .family > h2 {{ font-size: 17px; margin: 0 0 12px; }}
  .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 600px), 1fr)); gap: 14px; }}
  .card {{ min-width: 0; border: 1px solid #ddd; border-radius: 12px; overflow: hidden; background: #fff; }}
  .preview {{ display: block; width: 100%; border: 0; }}
  .controls {{ padding: 10px 14px; border-top: 1px solid #e5e5e5; font-size: 12px; }}
  .scrub {{ display: flex; gap: 6px; align-items: center; flex: 1; min-width: 220px; }}
  .scrubber {{ flex: 1; }}
  .body {{ padding: 12px 14px; border-top: 1px solid #e5e5e5; }}
  h3 {{ margin: 0; font-size: 15px; }}
  .playback {{ font-size: 11px; font-weight: 500; color: #555; border: 1px solid #ccc; border-radius: 6px; padding: 1px 6px; }}
  p {{ margin: 8px 0 0; font-size: 13px; line-height: 1.5; }}
  .notes {{ color: #555; }}
  .decisions {{ display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }}
  .decision.active {{ border-color: #222; background: #222; color: #fff; }}
  .note-label {{ display: grid; gap: 5px; margin-top: 10px; font-size: 12px; font-weight: 600; }}
  textarea {{ width: 100%; resize: vertical; border: 1px solid #ccc; border-radius: 8px; padding: 7px; font: inherit; font-weight: 400; }}
  #review-output {{ display: none; width: 100%; min-height: 180px; margin-top: 12px; }}
  @media (max-width: 560px) {{ body {{ padding: 12px; }} header {{ margin: -12px -12px 16px; padding: 12px; }} }}
</style>
</head>
<body>
<header>
  <h1>{html.escape(title)}</h1>
  <p class="hint">ヒーローは祖先に data-pictogram-motion="play" を付けて再生、一覧選択中は属性なしで静止。動きを減らす設定は Playwright の emulateMedia({{ reducedMotion: "reduce" }}) で確認する。</p>
  <div class="toolbar">
    <button type="button" id="replay-all">すべて最初から再生</button>
    <button type="button" id="pause-all">一時停止</button>
    <button type="button" id="show-review">レビューJSONを表示</button>
  </div>
  <textarea id="review-output" readonly></textarea>
</header>
<main>{sections}</main>
<script>
(() => {{
  const storageKey = {json.dumps(storage_key)};
  const output = document.getElementById('review-output');
  let paused = false;
  let review = {{}};

  try {{ review = JSON.parse(localStorage.getItem(storageKey) || '{{}}'); }} catch {{ review = {{}}; }}
  const save = () => {{ try {{ localStorage.setItem(storageKey, JSON.stringify(review)); }} catch {{}} }};

  const animationsOf = (card) => card.querySelector('.preview').contentDocument?.getAnimations() ?? [];
  const cycleLength = (animations) => animations.reduce((longest, animation) => {{
    const timing = animation.effect.getComputedTiming();
    const iterations = Number.isFinite(timing.iterations) ? timing.iterations : 1;
    return Math.max(longest, (timing.delay || 0) + Number(timing.duration || 0) * iterations);
  }}, 0);

  const refreshScrubber = (card) => {{
    const length = Math.round(cycleLength(animationsOf(card)));
    const scrubber = card.querySelector('.scrubber');
    if (!scrubber) return;
    scrubber.max = String(Math.max(length, 1));
    scrubber.value = '0';
    card.querySelector('.time').textContent = length ? `再生中 / 周期 ${{length}}ms` : 'アニメーションなし';
  }};

  const applyPause = (card) => animationsOf(card).forEach((animation) => paused ? animation.pause() : animation.play());

  const afterLoad = (card) => requestAnimationFrame(() => {{ refreshScrubber(card); applyPause(card); }});

  const replay = (card) => {{
    const frame = card.querySelector('.preview');
    frame.onload = () => afterLoad(card);
    frame.setAttribute('srcdoc', frame.getAttribute('srcdoc'));
    const toggle = card.querySelector('.toggle-motion');
    if (toggle) {{ toggle.dataset.state = 'on'; toggle.textContent = '再生属性を外す'; }}
  }};

  document.querySelectorAll('.card').forEach((card) => {{
    const frame = card.querySelector('.preview');
    frame.addEventListener('load', () => afterLoad(card), {{ once: true }});
    if (frame.contentDocument?.readyState === 'complete') afterLoad(card);
    const id = card.dataset.candidateId;
    if (!id) return;
    const state = review[id] || {{}};
    if (state.decision) card.querySelector(`[data-decision="${{state.decision}}"]`)?.classList.add('active');
    card.querySelector('.review-note').value = state.note || '';
  }});

  document.getElementById('replay-all').addEventListener('click', () => document.querySelectorAll('.card[data-candidate-id]').forEach(replay));
  document.getElementById('pause-all').addEventListener('click', (event) => {{
    paused = !paused;
    document.querySelectorAll('.card').forEach(applyPause);
    event.currentTarget.textContent = paused ? '再開' : '一時停止';
  }});
  document.querySelectorAll('.replay-one').forEach((button) => button.addEventListener('click', () => replay(button.closest('.card'))));
  document.querySelectorAll('.toggle-motion').forEach((button) => button.addEventListener('click', () => {{
    const card = button.closest('.card');
    const heroes = card.querySelector('.preview').contentDocument?.querySelectorAll('.pzg-hero') ?? [];
    const playing = button.dataset.state !== 'off';
    heroes.forEach((hero) => playing ? hero.removeAttribute('data-pictogram-motion') : hero.setAttribute('data-pictogram-motion', 'play'));
    button.dataset.state = playing ? 'off' : 'on';
    button.textContent = playing ? '再生属性を付ける' : '再生属性を外す';
    afterLoad(card);
  }}));
  document.querySelectorAll('.scrubber').forEach((scrubber) => scrubber.addEventListener('input', () => {{
    const card = scrubber.closest('.card');
    const time = Number(scrubber.value);
    animationsOf(card).forEach((animation) => {{ animation.pause(); animation.currentTime = time; }});
    card.querySelector('.time').textContent = `${{time}}ms / ${{scrubber.max}}ms で停止`;
  }}));
  document.querySelectorAll('.decision').forEach((button) => button.addEventListener('click', () => {{
    const card = button.closest('.card');
    const id = card.dataset.candidateId;
    const nextDecision = button.dataset.decision;
    const currentDecision = review[id]?.decision;
    review[id] = {{ ...(review[id] || {{}}), decision: currentDecision === nextDecision ? null : nextDecision }};
    card.querySelectorAll('.decision').forEach((item) => item.classList.remove('active'));
    if (review[id].decision) button.classList.add('active');
    save();
  }}));
  document.querySelectorAll('.review-note').forEach((textarea) => textarea.addEventListener('input', () => {{
    const id = textarea.closest('.card').dataset.candidateId;
    review[id] = {{ ...(review[id] || {{}}), note: textarea.value }};
    save();
  }}));
  document.getElementById('show-review').addEventListener('click', () => {{
    output.value = JSON.stringify(review, null, 2);
    output.style.display = 'block';
    output.select();
  }});
}})();
</script>
</body>
</html>
"""


def main() -> int:
    args = parse_args()
    try:
        manifest = load_manifest(args.manifest)
        candidates = (
            human_candidates(manifest, args.self_review)
            if args.audience == "human"
            else manifest["candidates"]
        )
        themes = load_themes(args.globals_css)
        sizes = Sizes(hero=args.hero_sizes, list=args.list_sizes)
        document = build_document(args.manifest, manifest, candidates, themes, sizes)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        raise SystemExit(f"ERROR: {error}") from error

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(document, encoding="utf-8")
    print(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
