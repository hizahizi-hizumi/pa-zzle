#!/usr/bin/env python3

from __future__ import annotations

import argparse
import html
import json
from collections import defaultdict
from pathlib import Path
from typing import Any

DECISIONS = (
    ("candidate", "å€™è£œ"),
    ("explore", "æ˜ã‚‹"),
    ("part", "ä¸€éƒ¨"),
    ("reject", "é™¤å¤–"),
)

PREVIEW_STYLE = "<style>html,body{margin:0;width:100%;height:100%;display:grid;place-items:center;overflow:hidden}svg{width:100%;height:100%;max-width:100%;max-height:100%}.paused *{animation-play-state:paused!important}</style>"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate an interactive review gallery for animated SVG pictograms."
    )
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--size", type=int, default=112)
    return parser.parse_args()


def load_manifest(path: Path) -> dict[str, Any]:
    manifest = json.loads(path.read_text(encoding="utf-8"))
    candidates = manifest.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        raise ValueError("manifest candidates must be a non-empty array")
    return manifest


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
    buttons = []
    for value, label in DECISIONS:
        buttons.append(
            f'<button type="button" class="decision" data-id="{html.escape(candidate_id)}" '
            f'data-decision="{value}">{label}</button>'
        )
    return "".join(buttons)


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
        f'<p class="notes"><strong>è£œè¶³:</strong> {html.escape(notes)}</p>' if notes else ""
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
      <button type="button" class="replay-one" data-id="{escaped_id}">å†ç”Ÿ</button>
    </div>
    <p><strong>æ¡ˆ:</strong> {html.escape(hypothesis)}</p>
    <p><strong>é¢ç™½ã•ã®æ ¸:</strong> {html.escape(interesting_point)}</p>
    {notes_html}
    <div class="decisions" role="group" aria-label="{escaped_id} ã®ãƒ¬ãƒ“ãƒ¥ãƒ¼">
      {decision_buttons(candidate_id)}
    </div>
    <label class="note-label">ãƒ¡ãƒ¢
      <textarea class="review-note" data-id="{escaped_id}" rows="2"></textarea>
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


def build_document(manifest_path: Path, manifest: dict[str, Any], size: int) -> str:
    title = str(manifest.get("title") or "Pictogram animation review")
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for candidate in manifest["candidates"]:
        if not isinstance(candidate, dict):
            raise ValueError("each candidate must be an object")
        family = str(candidate.get("family") or "æœªåˆ†é¡")
        grouped[family].append(candidate)

    sections = "\n".join(
        family_section(manifest_path, family, candidates, size)
        for family, candidates in grouped.items()
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
  .title-row {{ display: flex; gap: 8px; align-items: center; justify-content: space-between; }}
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
    <button type="button" id="replay-all">ã™ã¹ã¦å†ç”Ÿ</button>
    <button type="button" id="pause-all">ä¸€æ™‚åœæ­¢</button>
    <button type="button" id="show-review">ãƒ¬ãƒ“ãƒ¥ãƒ¼JSONã‚’è¡¨ç¤º</button>
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
    if (state.decision) {{
      card.querySelector(`[data-decision="${{state.decision}}"]`)?.classList.add('active');
    }}
    card.querySelectoŠ	Ëœ™]šY]Ë[›İIÊK˜[YHHİ]K››İH	ÉÎÂˆ™\^JØ\™
NÂˆ_JNÂ‚ˆØİ[Y[™Ù][[Y[RY
	Ü™\^KX[	ÊK˜Y]™[\İ[™\Š	ØÛXÚÉË

HOˆŞÂˆØİ[Y[œ]Y\TÙ[XİÜ[
	Ë˜Ø\™	ÊK™›Ü‘XXÚ
™\^JNÂˆ_JNÂ‚ˆØİ[Y[™Ù][[Y[RY
	Ü]\ÙKX[	ÊK˜Y]™[\İ[™\Š	ØÛXÚÉË
]™[
HOˆŞÂˆ]\ÙYH\]\ÙYÂˆØİ[Y[œ]Y\TÙ[XİÜ[
	Ë˜Ø\™	ÊK™›Ü‘XXÚ
\T]\ÙJNÂˆ]™[˜İ\œ™[\™Ù]^ÛÛ[H]\ÙYÈ	ùa£ze¢ÉÈˆ	ù. 9¦`¹`g9«h‰ÎÂˆ_JNÂ‚ˆØİ[Y[œ]Y\TÙ[XİÜ[
	Ëœ™\^K[Û™IÊK™›Ü‘XXÚ

]ÛŠHOˆŞÂˆ]Û‹˜Y]™[\İ[™\Š	ØÛXÚÉË

HOˆ™\^J]Û‹˜ÛÜÙ\İ
	Ë˜Ø\™	ÊJJNÂˆ_JNÂ‚ˆØİ[Y[œ]Y\TÙ[XİÜ[
	Ë™XÚ\Ú[Û‰ÊK™›Ü‘XXÚ

]ÛŠHOˆŞÂˆ]Û‹˜Y]™[\İ[™\Š	ØÛXÚÉË

HOˆŞÂˆÛÛœİYH]Û‹™]\Ù]šYÂˆÛÛœİ™^XÚ\Ú[ÛˆH]Û‹™]\Ù]™XÚ\Ú[ÛÂˆÛÛœİİ\œ™[XÚ\Ú[ÛˆH™]šY]ÖÚYOË™XÚ\Ú[ÛÂˆ™]šY]ÖÚYHHŞÈ‹‹Š™]šY]ÖÚYHŞß_JKXÚ\Ú[Ûˆİ\œ™[XÚ\Ú[ÛˆOOH™^XÚ\Ú[ÛˆÈ[ˆ™^XÚ\Ú[Ûˆ_NÂˆ]Û‹˜ÛÜÙ\İ
	Ë™XÚ\Ú[ÛœÉÊKœ]Y\TÙ[XİÜ[
	Ë™XÚ\Ú[Û‰ÊK™›Ü‘XXÚ

][JHOˆ][K˜Û\ÜÓ\İœ™[[İ™J	ØXİ]™IÊJNÂˆYˆ
™]šY]ÖÚYK™XÚ\Ú[ÛŠH]Û‹˜Û\ÜÓ\İ˜Y
	ØXİ]™IÊNÂˆØ]™J
NÂˆ_JNÂˆ_JNÂ‚ˆØİ[Y[œ]Y\TÙ[XİÜ[
	Ëœ™]šY]Ë[›İIÊK™›Ü‘XXÚ

^\™XJHOˆŞÂˆ^\™XK˜Y]™[\İ[™\Š	Ú[œ]	Ë

HOˆŞÂˆÛÛœİYH^\™XK™]\Ù]šYÂˆ™]šY]ÖÚYHHŞÈ‹‹Š™]šY]ÖÚYHŞß_JK›İNˆ^\™XK˜[YH_NÂˆØ]™J
NÂˆ_JNÂˆ_JNÂ‚ˆØİ[Y[™Ù][[Y[RY
	ÜÚİË\™]šY]ÉÊK˜Y]™[\İ[™\Š	ØÛXÚÉË

HOˆŞÂˆİ]]˜[YHH”ÓÓ‹œİš[™ÚYJ™]šY]Ë[ŠNÂˆİ]]œİ[K™\Ü^HH	Ø›ØÚÉÎÂˆİ]]œÙ[Xİ

NÂˆ_JNÂŸ_JJ
NÂÜØÜš\‚Ø›ÙO‚Ú[‚ˆˆˆ‚‚‚™YˆXZ[Š
HOˆ[‚ˆ\™ÜÈH\œÙWØ\™ÜÊ
BˆX[šY™\İHØYÛX[šY™\İ
\™ÜË›X[šY™\İ
BˆØİ[Y[HZ[ÙØİ[Y[
\™ÜË›X[šY™\İX[šY™\İ\™ÜËœÚ^™JBˆ\™ÜË›İ]]œ\™[›ZÙ\Š\™[ÏUYK^\İÛÚÏUYJBˆ\™ÜË›İ]]Üš]Wİ^
Øİ[Y[[˜ÛÙ[™ÏH]‹NŠBˆš[
\™ÜË›İ]]
Bˆ™]\›ˆ‚‚šYˆ×Û˜[YW×ÈOH—×ÛXZ[—×È‚ˆ˜Z\ÙHŞ\İ[Q^]
XZ[Š
JB