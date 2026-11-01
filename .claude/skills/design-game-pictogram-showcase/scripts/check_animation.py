#!/usr/bin/env python3
"""Check showcase pictogram SVGs against the receiving contract.

The checks are deterministic only: SVG structure, naming prefix, CSS selector
scope, play gating, and forbidden features. They do not judge whether the
motion conveys the game, whether start/end frames match, or whether it is good.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path

VIEW_BOX = (0.0, 0.0, 120.0, 120.0)
SMIL_ELEMENTS = {"animate", "animateMotion", "animateTransform", "animateColor", "set", "discard"}
FORBIDDEN_ELEMENTS = {"script", "foreignObject", "image", "iframe", "video", "audio"}
ALLOWED_VARIABLES = {"--game-pictogram-strong", "--game-pictogram-soft"}
PLAYBACK_VALUES = {"loop", "once"}
GAME_ID = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
REDUCED_MOTION_MEDIA = re.compile(
    r"^\(\s*prefers-reduced-motion\s*:\s*no-preference\s*\)$", re.IGNORECASE
)
PLAY_ATTRIBUTE = re.compile(
    r"\[\s*data-pictogram-motion\s*=\s*(?:\"play\"|'play'|play)\s*\]", re.IGNORECASE
)
MOTION_ATTRIBUTE = re.compile(r"data-pictogram-motion", re.IGNORECASE)
CLASS_TOKEN = re.compile(r"\.(-?[_a-zA-Z][\w-]*)")
VAR_REFERENCE = re.compile(r"var\(\s*(--[\w-]+)")
CUSTOM_PROPERTY_DECLARATION = re.compile(r"^--[\w-]+$")
CSS_URL = re.compile(r"url\(\s*['\"]?([^'\")\s]*)", re.IGNORECASE)
CSS_COMMENT = re.compile(r"/\*.*?\*/", re.DOTALL)
COMBINATORS = set(" \t\n\r>+~")


@dataclass(frozen=True)
class Candidate:
    candidate_id: str
    path: Path


@dataclass
class Report:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def error(self, message: str) -> None:
        if message not in self.errors:
            self.errors.append(message)

    def warn(self, message: str) -> None:
        if message not in self.warnings:
            self.warnings.append(message)


@dataclass
class CssBlock:
    prelude: str
    body: str


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check showcase pictogram SVGs against the pa-zzle receiving contract."
    )
    parser.add_argument("svgs", nargs="*", type=Path)
    parser.add_argument("--manifest", type=Path)
    parser.add_argument(
        "--game-id",
        help="game id for the pz-<game-id>- prefix; overrides manifest game_id",
    )
    return parser.parse_args()


def non_empty_string(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def candidates_from_manifest(path: Path) -> tuple[list[Candidate], str | None, list[str]]:
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return [], None, [f"cannot read manifest: {error}"]
    if not isinstance(manifest, dict):
        return [], None, ["manifest root must be an object"]

    errors: list[str] = []
    game_id = manifest.get("game_id")
    if not non_empty_string(game_id):
        errors.append("game_id must be a non-empty string")
        game_id = None

    base = manifest.get("base_pictogram")
    if base is not None and not non_empty_string(base):
        errors.append("base_pictogram must be a non-empty string when present")
    elif isinstance(base, str):
        base_path = Path(base) if Path(base).is_absolute() else path.parent / base
        if not base_path.is_file():
            errors.append(f"base_pictogram not found: {base_path}")

    entries = manifest.get("candidates")
    if not isinstance(entries, list) or not entries:
        return [], game_id, [*errors, "manifest candidates must be a non-empty array"]

    candidates: list[Candidate] = []
    seen_ids: set[str] = set()
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            errors.append(f"candidate[{index}] must be an object")
            continue
        candidate_id = entry.get("id")
        if not non_empty_string(candidate_id):
            errors.append(f"candidate[{index}].id must be a non-empty string")
            continue
        if candidate_id in seen_ids:
            errors.append(f"duplicate candidate id: {candidate_id}")
            continue
        seen_ids.add(candidate_id)

        for key in ("hypothesis", "aim_play", "aim_payoff", "static_pose"):
            if not non_empty_string(entry.get(key)):
                errors.append(f"{candidate_id}: {key} must be a non-empty string")
        if entry.get("playback") not in PLAYBACK_VALUES:
            errors.append(f"{candidate_id}: playback must be loop or once")

        file_value = entry.get("file")
        if not non_empty_string(file_value):
            errors.append(f"{candidate_id}: file must be a non-empty string")
            continue
        svg_path = Path(file_value)
        if not svg_path.is_absolute():
            svg_path = path.parent / svg_path
        candidates.append(Candidate(candidate_id, svg_path))

    return candidates, game_id, errors


def strip_strings(text: str) -> str:
    return re.sub(r"\"[^\"]*\"|'[^']*'", '""', text)


def split_blocks(css: str) -> tuple[list[CssBlock], str]:
    blocks: list[CssBlock] = []
    loose: list[str] = []
    depth = 0
    quote: str | None = None
    prelude_start = 0
    body_start = 0
    prelude = ""
    for index, char in enumerate(css):
        if quote:
            if char == quote and css[index - 1] != "\\":
                quote = None
            continue
        if char in "\"'":
            quote = char
        elif char == "{":
            if depth == 0:
                prelude = css[prelude_start:index].strip()
                body_start = index + 1
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                blocks.append(CssBlock(prelude, css[body_start:index]))
                prelude_start = index + 1
            elif depth < 0:
                depth = 0
                prelude_start = index + 1
        elif char == ";" and depth == 0:
            loose.append(css[prelude_start:index].strip())
            prelude_start = index + 1
    loose.append(css[prelude_start:].strip())
    return blocks, " ".join(item for item in loose if item)


def split_top_level(text: str, separator: str) -> list[str]:
    parts: list[str] = []
    depth = 0
    quote: str | None = None
    current: list[str] = []
    for char in text:
        if quote:
            current.append(char)
            if char == quote:
                quote = None
            continue
        if char in "\"'":
            quote = char
        elif char in "([":
            depth += 1
        elif char in ")]":
            depth -= 1
        if char == separator and depth == 0:
            parts.append("".join(current))
            current = []
            continue
        current.append(char)
    parts.append("".join(current))
    return [part.strip() for part in parts if part.strip()]


def compounds(selector: str) -> list[str]:
    result: list[str] = []
    current: list[str] = []
    depth = 0
    quote: str | None = None
    for char in selector.strip():
        if quote:
            current.append(char)
            if char == quote:
                quote = None
            continue
        if char in "\"'":
            quote = char
        elif char in "([":
            depth += 1
        elif char in ")]":
            depth -= 1
        if depth == 0 and char in COMBINATORS:
            if current:
                result.append("".join(current))
                current = []
            continue
        current.append(char)
    if current:
        result.append("".join(current))
    return result


def class_names(selector: str) -> list[str]:
    without_attributes = re.sub(r"\[[^\]]*\]", "", strip_strings(selector))
    return CLASS_TOKEN.findall(without_attributes)


def declarations(body: str) -> list[tuple[str, str]]:
    result: list[tuple[str, str]] = []
    for item in split_top_level(body, ";"):
        if ":" not in item:
            continue
        name, value = item.split(":", 1)
        result.append((name.strip().lower(), value.strip()))
    return result


def check_declarations(
    body: str, prefix: str, report: Report, *, play_gated: bool, where: str
) -> bool:
    animated = False
    for name, value in declarations(body):
        if name.startswith("transition"):
            report.error(f"{where}: transition is forbidden; use gated CSS animation")
        if name.startswith("animation"):
            if name in {"animation", "animation-name"} and value.lower() != "none":
                animated = True
            if not play_gated:
                report.error(
                    f"{where}: {name} must be inside @media (prefers-reduced-motion: no-preference) "
                    'and gated by an ancestor [data-pictogram-motion="play"]'
                )
        if CUSTOM_PROPERTY_DECLARATION.match(name) and not name.startswith(f"--{prefix}"):
            report.error(f"{where}: custom property must start with --{prefix}: {name}")
        check_css_values(value, prefix, report, where)
    return animated


def check_css_values(value: str, prefix: str, report: Report, where: str) -> None:
    for target in CSS_URL.findall(value):
        if not target.startswith("#"):
            report.error(f"{where}: external CSS reference is forbidden: {target or '(empty)'}")
        elif not target[1:].startswith(prefix):
            report.error(f"{where}: referenced id must start with {prefix}: {target}")
    for variable in VAR_REFERENCE.findall(value):
        if variable not in ALLOWED_VARIABLES and not variable.startswith(f"--{prefix}"):
            report.error(
                f"{where}: only --game-pictogram-strong/soft or --{prefix}* variables are allowed: {variable}"
            )


def check_style_rule(
    block: CssBlock, prefix: str, report: Report, *, in_motion_media: bool
) -> bool:
    selectors = split_top_level(block.prelude, ",")
    if not selectors:
        report.error("<style>: empty selector")
        return False

    gated_flags: list[bool] = []
    for selector in selectors:
        parts = compounds(selector)
        if not parts:
            report.error(f"<style>: empty selector in {block.prelude!r}")
            continue
        subject = parts[-1]
        subject_classes = class_names(subject)
        if not any(name.startswith(prefix) for name in subject_classes):
            report.error(
                f"<style>: selector would leak outside the SVG; its target must have a {prefix}* class: {selector}"
            )
        for name in class_names(selector):
            if not name.startswith(prefix):
                report.error(f"<style>: class name must start with {prefix}: .{name}")
        if MOTION_ATTRIBUTE.search(subject):
            report.error(
                f'<style>: [data-pictogram-motion="play"] must be on an ancestor, not the target: {selector}'
            )
        gated = any(PLAY_ATTRIBUTE.search(part) for part in parts[:-1])
        if MOTION_ATTRIBUTE.search(selector) and not PLAY_ATTRIBUTE.search(selector):
            report.error(f'<style>: data-pictogram-motion must be [data-pictogram-motion="play"]: {selector}')
        if MOTION_ATTRIBUTE.search(selector) and not in_motion_media:
            report.error(
                "<style>: rules using data-pictogram-motion must be inside "
                f"@media (prefers-reduced-motion: no-preference): {selector}"
            )
        if in_motion_media and not gated:
            report.error(
                "<style>: every rule inside the reduced-motion media must be gated by an ancestor "
                f'[data-pictogram-motion="play"], or it changes the static state: {selector}'
            )
        gated_flags.append(gated)

    play_gated = in_motion_media and bool(gated_flags) and all(gated_flags)
    return check_declarations(
        block.body, prefix, report, play_gated=play_gated, where=f"<style> {block.prelude}"
    )


def check_keyframes(block: CssBlock, prefix: str, report: Report) -> None:
    name = block.prelude.split(None, 1)[1].strip() if " " in block.prelude.strip() else ""
    name = name.strip("\"'")
    if not name.startswith(prefix):
        report.error(f"<style>: keyframes name must start with {prefix}: {name or '(empty)'}")
    frames, _ = split_blocks(block.body)
    for frame in frames:
        for prop, value in declarations(frame.body):
            if prop.startswith("animation") or prop.startswith("transition"):
                report.error(f"<style>: {prop} inside @keyframes {name} is not allowed")
            check_css_values(value, prefix, report, f"@keyframes {name}")


def check_stylesheet(css: str, prefix: str, report: Report) -> bool:
    css = CSS_COMMENT.sub("", css)
    blocks, loose = split_blocks(css)
    if loose:
        report.error(f"<style>: unsupported statement outside rules: {loose[:80]}")

    animated = False
    for block in blocks:
        prelude = block.prelude
        lowered = prelude.lower()
        if lowered.startswith("@media"):
            condition = prelude[len("@media") :].strip()
            if not REDUCED_MOTION_MEDIA.match(condition):
                report.error(
                    "<style>: only @media (prefers-reduced-motion: no-preference) is allowed: "
                    f"{prelude}"
                )
                continue
            inner_blocks, inner_loose = split_blocks(block.body)
            if inner_loose:
                report.error(f"<style>: unsupported statement in {prelude}: {inner_loose[:80]}")
            for inner in inner_blocks:
                inner_lowered = inner.prelude.lower()
                if re.match(r"@(-webkit-)?keyframes\b", inner_lowered):
                    check_keyframes(inner, prefix, report)
                elif inner_lowered.startswith("@"):
                    report.error(f"<style>: nested at-rule is not allowed: {inner.prelude}")
                else:
                    animated |= check_style_rule(inner, prefix, report, in_motion_media=True)
        elif re.match(r"@(-webkit-)?keyframes\b", lowered):
            check_keyframes(block, prefix, report)
        elif lowered.startswith("@"):
            report.error(f"<style>: at-rule is not allowed: {prelude}")
        else:
            animated |= check_style_rule(block, prefix, report, in_motion_media=False)
    return animated


def parse_view_box(value: str) -> tuple[float, ...] | None:
    try:
        return tuple(float(part) for part in re.split(r"[\s,]+", value.strip()))
    except ValueError:
        return None


def check_svg(candidate: Candidate, game_id: str) -> Report:
    report = Report()
    prefix = f"pz-{game_id}-"
    try:
        root = ET.parse(candidate.path).getroot()
    except (OSError, ET.ParseError) as error:
        report.error(f"cannot parse SVG: {error}")
        return report

    if local_name(root.tag) != "svg":
        report.error("root element is not <svg>")
    if parse_view_box(root.attrib.get("viewBox", "")) != VIEW_BOX:
        report.error('viewBox must be "0 0 120 120"')

    ids: set[str] = set()
    animated = False
    style_found = False
    uses_strong = False

    for element in root.iter():
        name = local_name(element.tag)
        if name in SMIL_ELEMENTS:
            report.error(f"SMIL <{name}> is forbidden; use gated CSS animation")
        if name in FORBIDDEN_ELEMENTS:
            report.error(f"<{name}> is forbidden")

        element_id = element.attrib.get("id")
        if element_id:
            if element_id in ids:
                report.error(f"duplicate element id: {element_id}")
            ids.add(element_id)
            if not element_id.startswith(prefix):
                report.error(f"id must start with {prefix}: {element_id}")
            report.warn(
                f"id is used ({element_id}); confirm in self-review that two inline copies do not break"
            )

        for attribute, value in element.attrib.items():
            attribute_name = local_name(attribute).lower()
            if "var(--game-pictogram-strong)" in value.replace(" ", ""):
                uses_strong = True
            if attribute_name.startswith("on"):
                report.error(f"event handler attribute is forbidden: {attribute_name}")
            if attribute_name in {"href", "src"}:
                target = value.strip()
                if not target.startswith("#"):
                    report.error(f"external reference is forbidden: {target}")
                elif not target[1:].startswith(prefix):
                    report.error(f"referenced id must start with {prefix}: {target}")
            if attribute_name == "data-pictogram-motion":
                report.error("the SVG must not set data-pictogram-motion; the host page sets it")
            if attribute_name == "class":
                for token in value.split():
                    if not token.startswith(prefix):
                        report.error(f"class name must start with {prefix}: {token}")
            if attribute_name == "style":
                for prop, prop_value in declarations(value):
                    if prop.startswith("animation") or prop.startswith("transition"):
                        report.error(
                            f"{prop} in a style attribute cannot be gated; move it into <style>"
                        )
                    check_css_values(prop_value, prefix, report, "style attribute")
            elif attribute_name not in {"href", "src", "class", "id"}:
                check_css_values(value, prefix, report, f"{name}@{attribute_name}")

        if name == "style":
            style_found = True
            text = "".join(element.itertext())
            if "var(--game-pictogram-strong)" in text.replace(" ", ""):
                uses_strong = True
            if re.search(r"@import\b", text, re.IGNORECASE):
                report.error("<style>: @import is forbidden")
            animated |= check_stylesheet(text, prefix, report)

    if not style_found:
        report.error("no <style> element; animation must be written as CSS in <style>")
    if not animated:
        report.error(
            "no gated CSS animation was detected "
            '(@media (prefers-reduced-motion: no-preference) { [data-pictogram-motion="play"] .'
            f"{prefix}... {{ animation: ... }} }})"
        )
    if not uses_strong:
        report.error("var(--game-pictogram-strong) is not used for the foreground lines")

    return report


def main() -> int:
    args = parse_args()
    manifest_errors: list[str] = []
    candidates: list[Candidate] = []
    game_id: str | None = None

    if args.manifest:
        candidates, game_id, manifest_errors = candidates_from_manifest(args.manifest)
    candidates.extend(Candidate(path.stem, path) for path in args.svgs)
    if args.game_id:
        game_id = args.game_id

    if not candidates:
        print("ERROR: provide SVG paths or --manifest", file=sys.stderr)
        return 2
    if not game_id:
        print("ERROR: provide --game-id or manifest game_id", file=sys.stderr)
        return 2
    if not GAME_ID.match(game_id):
        print(f"ERROR: invalid game id: {game_id}", file=sys.stderr)
        return 2

    failed = False
    for error in manifest_errors:
        failed = True
        print(f"FAIL manifest: {error}", file=sys.stderr)

    for candidate in candidates:
        report = check_svg(candidate, game_id)
        print(f"candidate: {candidate.candidate_id}")
        print(f"file: {candidate.path}")
        for warning in report.warnings:
            print(f"WARN: {warning}")
        if report.errors:
            failed = True
            for error in report.errors:
                print(f"FAIL: {error}", file=sys.stderr)
        else:
            print("PASS")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
