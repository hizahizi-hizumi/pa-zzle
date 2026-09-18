#!/usr/bin/env python3

from __future__ import annotations

import argparse
import html
import json
from collections import defaultdict
from pathlib import Path
from typing import Any

from check_self_review import load_json as load_self_review_json
from check_self_review import validate as validate_self_review

DECISIONS = (
    ("candidate", "候補"),
    ("explore", "掘る"),
    ("part", "一部"),
    ("reject", "除外"),
)
PREVIEW_STYLE = "<style>html,body{margin:0;width:100%;height:100%;display:grid;place-items:center;overflow:hidden}svg{width:100%;height:100%;max-width:100%;max-height:100%}.paused *{animation-play-state:paused!important}</style>"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a self-review or human-review gallery for animated SVG pictograms."
    )
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--size", type=int, default=112)
    parser.add_argument("--audience", choices=("self", "human"), default="self")
    parser.add_argument("--self-review", type=Path)
    return parser.parse_args()


def load_manifest(path: Path) -> dict[str, Any]:
    manifest = json.loads(path.read_text(encoding="utf-8"))
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
        if isinstance(candidate, dict)
        and reviews[candidate["id"]]["result"] == "pass"
    ]
    if not candidates:
        raise ValueError("human review requires at least one self-reviewed pass candidate")
    return candidates


def candidate_svg(manifest_path: Path, candidate: dict[str, Any]) -> str:
    file_value = candidate.get("file")
    if not isinstance(file_value, str) or not file_value.strip():
        raise ValueError(f"candidate {candidate.get('id', '(unknown)')} has no file")
    path = Path(file_value)
    if not path.is_absolute():
        path = manifest_path.parent / path
    return path.read_text(encoding="utf-8")


def preview_document(svg: str) -> str:
    return f"<!doctype html><html><head>{PREVIEW_STYLE}</head><body>{svg}</body></html>"


def decision_buttons(candidate_id: str) -> str:
    return "".join(
        f'<button type="button" class="decision" data-id="{html.escape(candidate_id)}" '
        f'data-decision="{value}">{label}</button>'
        for value, label in DECISIONS
    )


def candidate_card(manifest_path: Path, candidate: dict[str, Any], size: int) -> str:
    candidate_id = str(candidate.get("id", "")).strip()
    hypothesis = str(candidate.get("hypothesis", "")).strip()
    interesting_point = str(candidate.get("interesting_point", "")).strip()
    notes = str(candidate.get("notes", "")).strip()
    if not candidate_id or not hypothesis or not interesting_point:
        raise ValueError("candidate id, hypothesis, and interesting_point are required")

    svg = candidate_svg(manifest_path, candidate)
    preview_srcdoc = html.escape(preview_document(svg), quote=True)
    notes_html = (
        f'<p class="notes"><strong>補足:</strong> {html.escape(notes)}</p>' if notes else ""
    )
    escaped_id = html.escape(candidate_id)
    return f"""
<article class="card" data-candidate-id="{escaped_id}">
  <div class="art" style="--art-size:{size}px">
    <iframe class="preview" title="{escaped_id} animation preview" sandbox="allow-same-origin" srcdoc="{preview_srcdoc}"></iframe>
  </div>
  <template class="svg-source">{svg}</template>
  <div class="body">
    <div class="title-row">
      <h3>{escaped_id}</h3>
      <button type="button" class="replay-one">再生</button>
    </div>
    <p><strong>案:</strong> {html.escape(hypothesis)}</p>
    <p><strong>面白さの核:</strong> {html.escape(interesting_point)}</p>
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


def family_section(
    manifest_path: Path, family: str, candidates: list[dict[str, Any]], size: int
) -> str:
    cards = "\n".join(candidate_card(manifest_path, candidate, size) for candidate in candidates)
    return f"""
<section class="family">
  <h2>{html.escape(family)}</h2>
  <div class="grid">{cards}</div>
</section>
"""


def build_document(
    manifest_path: Path, title: str, candidates: list[dict[str, Any]], size: int
) -> str:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for candidate in candidates:
        if not isinstance(candidate, dict):
            raise ValueError("each candidate must be an object")
        grouped[str(candidate.get("family") or "未分類")].append(candidate)

    sections = "\n".join(
        family_section(manifest_path, family, family_candidates, size)
        for family, family_candidates in grouped.items()
    )
    storage_key = "pictogram-animation-review:" + str(manifest_path.resolve())

    return f"""<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<style>
  :root {{ font-family: system-ui, sans-serif; color: #151515; background: #f6f6f6; }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; padding: 24px; }}
  header {{ position: sticky; top: 0; z-index: 10; margin: -24px -24px 24px; padding: 16px 24px; background: rgba(246,246,246,.96); border-bottom: 1px solid #ddd; }}
  h1 {{ margin: 0 0 12px; font-size: 22px; }}
  .toolbar {{ display: flex; flex-wrap: wrap; gap: 8px; }}
  button {{ font: inherit; border: 1px solid #bbb; border-radius: 8px; background: #fff; padding: 7px 10px; cursor: pointer; }}
  button:hover {{ background: #eee; }}
  .family {{ margin-bottom: 36px; }}
  .family > h2 {{ font-size: 18px; margin: 0 0 12px; }}
  .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 14px; }}
  .card {{ min-width: 0; border: 1px solid #ddd; border-radius: 12px; overflow: hidden; background: #fff; }}
  .art {{ height: calc(var(--art-size) + 56px); display: grid; place-items: center; background: #fafafa; overflow: hidden; }}
  .preview {{ width: var(--art-size); height: var(--art-size); border: 0; background: transparent; }}
  .body {{ padding: 14px; border-top: 1px solid #e5e5e5; }}
  .title-row {{ display: flex; gap: 8px; align-items: center; justify-content: space-between }}
  h3 {{ margin: 0; font-size: 15px; }}
  p {{ margin: 9px 0 0; font-size: 13px; line-height: 1.5; }}
  .notes {{ color: #555; }}
  .decisions {{ display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }}
  .decision.active {{ border-color: #222; background: #222; color: #fff; }}
  .note-label {{ display: grid; gap: 5px; margin-top: 10px; font-size: 12px; font-weight: 600; }}
  textarea {{ width: 100%; resize: vertical; border: 1px solid #ccc; border-radius: 8px; padding: 7px; font: inherit; font-weight: 400; }}
  #review-output {{ display: none; width: 100%; min-height: 180px; margin-top: 12px; }}
  @media (max-width: 560px) {{ body {{ padding: 14px; }} header {{ margin: -14px -14px 18px; padding: 12px 14px; }} .grid {{ grid-template-columns: 1fr; }} }}
</style>
</head>
<body>
<header>
  <h1>{html.escape(title)}</h1>
  <div class="toolbar">
    <button type="button" id="replay-all">すべて再生</button>
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
  const frameStyle = {json.dumps(PREVIEW_STYLE)};
  let paused = false;
  let review = {{}};

  try {{ review = JSON.parse(localStorage.getItem(storageKey) || '{{}}'); }} catch {{ review = {{}}; }}
  const save = () => {{ try {{ localStorage.setItem(storageKey, JSON.stringify(review)); }} catch {{}} }};

  const applyPause = (card) => {{
    const frame = card.querySelector('.preview');
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.documentElement.classList.toggle('paused', paused);
    const svg = doc.querySelector('svg');
    if (!svg) return;
    if (paused && typeof svg.pauseAnimations === 'function') svg.pauseAnimations();
    if (!paused && typeof svg.unpauseAnimations === 'function') svg.unpauseAnimations();
  }};

  const replay = (card) => {{
    const frame = card.querySelector('.preview');
    const source = card.querySelector('.svg-source').innerHTML;
    frame.onload = () => applyPause(card);
    frame.srcdoc = '<!doctype html><html><head>' + frameStyle + '</head><body>' + source + '</body></html>';
  }};

  document.querySelectorAll('.card').forEach((card) => {{
    const id = card.dataset.candidateId;
    const state = review[id] || {{}};
    if (state.decision) card.querySelector(`[data-decision="${{state.decision}}"]`)?.classList.add('active');
    card.querySelector('.review-note').value = state.note || '';
  }});

  document.getElementById('replay-all').addEventListener('click', () => document.querySelectorAll('.card').forEach(replay));
  document.getElementById('pause-all').addEventListener('click', (event) => {{
    paused = !paused;
    document.querySelectorAll('.card').forEach(applyPause);
    event.currentTarget.textContent = paused ? '再開' : '一時停止';
  }});
  document.querySelectorAll('.replay-one').forEach((button) => button.addEventListener('click', () => replay(button.closest('.card'))));
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
        title = str(manifest.get("title") or "Pictogram animation review")
        document = build_document(args.manifest, title, candidates, args.size)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        raise SystemExit(f"ERROR: {error}") from error

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(document, encoding="utf-8")
    print(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
