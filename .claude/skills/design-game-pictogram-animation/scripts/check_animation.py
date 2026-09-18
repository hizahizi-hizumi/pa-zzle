#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

ANIMATION_ELEMENTS = {"animate", "animateMotion", "animateTransform", "set"}
FORBIDDEN_ELEMENTS = {"script", "foreignObject"}
CSS_IMPORT = re.compile(r"@import\b", re.IGNORECASE)
CSS_URL = re.compile(r"url\(\s*['\"]?([^'\")\s]+)", re.IGNORECASE)
CSS_ANIMATION = re.compile(r"@keyframes\b|(?:^|[;{\s])animation(?:-[\w-]+)?\s*:", re.IGNORECASE)


@dataclass(frozen=True)
class Candidate:
    candidate_id: str
    path: Path


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check deterministic structural constraints of animated SVG pictograms."
    )
    parser.add_argument("svgs", nargs="*", type=Path)
    parser.add_argument("--manifest", type=Path)
    return parser.parse_args()


def candidates_from_manifest(path: Path) -> tuple[list[Candidate], list[str]]:
    errors: list[str] = []
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return [], [f"cannot read manifest: {error}"]

    entries = manifest.get("candidates")
    if not isinstance(entries, list) or not entries:
        return [], ["manifest candidates must be a non-empty array"]

    candidates: list[Candidate] = []
    seen_ids: set[str] = set()
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            errors.append(f"candidate[{index}] must be an object")
            continue

        candidate_id = entry.get("id")
        file_value = entry.get("file")
        hypothesis = entry.get("hypothesis")
        interesting_point = entry.get("interesting_point")

        if not isinstance(candidate_id, str) or not candidate_id.strip():
            errors.append(f"candidate[{index}].id must be a non-empty string")
            continue
        if candidate_id in seen_ids:
            errors.append(f"duplicate candidate id: {candidate_id}")
            continue
        seen_ids.add(candidate_id)

        if not isinstance(file_value, str) or not file_value.strip():
            errors.append(f"{candidate_id}: file must be a non-empty string")
            continue
        if not isinstance(hypothesis, str) or not hypothesis.strip():
            errors.append(f"{candidate_id}: hypothesis must be a non-empty string")
        if not isinstance(interesting_point, str) or not interesting_point.strip():
            errors.append(f"{candidate_id}: interesting_point must be a non-empty string")

        svg_path = Path(file_value)
        if not svg_path.is_absolute():
            svg_path = path.parent / svg_path
        candidates.append(Candidate(candidate_id, svg_path))

    return candidates, errors


def direct_candidates(paths: list[Path]) -> list[Candidate]:
    return [Candidate(path.stem, path) for path in paths]


def href_is_external(value: str) -> bool:
    stripped = value.strip()
    return bool(stripped and not stripped.startswith("#"))


def css_has_external_reference(value: str) -> bool:
    if CSS_IMPORT.search(value):
        return True
    return any(not target.startswith("#") for target in CSS_URL.findall(value))


def check_svg(candidate: Candidate) -> list[str]:
    errors: list[str] = []
    try:
        root = ET.parse(candidate.path).getroot()
    except (OSError, ET.ParseError) as error:
        return [f"cannot parse SVG: {error}"]

    if local_name(root.tag) != "svg":
        errors.append("root element is not <svg>")
    if not root.attrib.get("viewBox"):
        errors.append("viewBox is required")

    ids: set[str] = set()
    animation_found = False

    for element in root.iter():
        name = local_name(element.tag)
        if name in FORBIDDEN_ELEMENTS:
            errors.append(f"<{name}> is forbidden")
        if name in ANIMATION_ELEMENTS:
            animation_found = True

        element_id = element.attrib.get("id")
        if element_id:
            if element_id in ids:
                errors.append(f"duplicate element id: {element_id}")
            ids.add(element_id)

        for attribute, value in element.attrib.items():
            attribute_name = local_name(attribute).lower()
            if attribute_name.startswith("on"):
                errors.append(f"event handler attribute is forbidden: {attribute_name}")
            if attribute_name in {"href", "src"} and href_is_external(value):
                errors.append(f"external reference is forbidden: {value}")
            if attribute_name == "style" and css_has_external_reference(value):
                errors.append("external CSS reference is forbidden")
            if attribute_name == "style" and CSS_ANIMATION.search(value):
                animation_found = True

        if name == "style" and element.text:
            if css_has_external_reference(element.text):
                errors.append("external CSS reference is forbidden")
            if CSS_ANIMATION.search(element.text):
                animation_found = True

    if not animation_found:
        errors.append("no SVG or CSS animation was detected")

    return list(dict.fromkeys(errors))


def main() -> int:
    args = parse_args()
    manifest_errors: list[str] = []

    if args.manifest:
        candidates, manifest_errors = candidates_from_manifest(args.manifest)
        candidates.extend(direct_candidates(args.svgs))
    else:
        candidates = direct_candidates(args.svgs)

    if not candidates:
        print("ERROR: provide animated SVG paths or --manifest", file=sys.stderr)
        return 2

    failed = False
    for error in manifest_errors:
        failed = True
        print(f"FAIL manifest: {error}", file=sys.stderr)

    for candidate in candidates:
        errors = check_svg(candidate)
        print(f"candidate: {candidate.candidate_id}")
        print(f"file: {candidate.path}")
        if errors:
            failed = True
            for error in errors:
                print(f"FAIL: {error}", file=sys.stderr)
        else:
            print("PASS")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
