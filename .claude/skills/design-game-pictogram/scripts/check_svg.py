#!/usr/bin/env python3

from __future__ import annotations

import argparse
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

PAINT_ATTRIBUTES = ("fill", "stroke", "color", "stop-color", "flood-color")
NON_COLORS = {"", "none", "transparent", "inherit", "initial", "unset"}
EXTERNAL_SCHEMES = ("http://", "https://", "//", "data:")
FORBIDDEN_ELEMENTS = {"script", "foreignObject"}
STYLE_DECLARATION = re.compile(r"\s*([^:;]+)\s*:\s*([^;]+)")


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def normalized_paint(value: str) -> str | None:
    value = value.strip().lower()
    if value in NON_COLORS:
        return None
    return value


def style_values(style: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for declaration in style.split(";"):
        match = STYLE_DECLARATION.fullmatch(declaration)
        if match:
            values[match.group(1).strip().lower()] = match.group(2).strip()
    return values


def collect_paints(root: ET.Element) -> set[str]:
    paints: set[str] = set()
    for element in root.iter():
        for attribute in PAINT_ATTRIBUTES:
            value = element.attrib.get(attribute)
            if value is not None:
                paint = normalized_paint(value)
                if paint is not None:
                    paints.add(paint)
        style = element.attrib.get("style")
        if style:
            declarations = style_values(style)
            for attribute in PAINT_ATTRIBUTES:
                value = declarations.get(attribute)
                if value is not None:
                    paint = normalized_paint(value)
                    if paint is not None:
                        paints.add(paint)
    return paints


def has_external_image(root: ET.Element) -> bool:
    for element in root.iter():
        if local_name(element.tag) != "image":
            continue
        href = element.attrib.get("href") or element.attrib.get(
            "{http://www.w3.org/1999/xlink}href", ""
        )
        if href.strip().lower().startswith(EXTERNAL_SCHEMES):
            return True
    return False


def unsafe_svg_features(root: ET.Element) -> list[str]:
    errors: list[str] = []
    for element in root.iter():
        name = local_name(element.tag)
        if name in FORBIDDEN_ELEMENTS:
            errors.append(f"<{name}> is not allowed in pictogram SVGs")
        for attribute in element.attrib:
            if local_name(attribute).lower().startswith("on"):
                errors.append(f"event attribute {attribute!r} is not allowed")
    return errors


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check deterministic structural constraints of one SVG pictogram."
    )
    parser.add_argument("svg", type=Path)
    parser.add_argument("--max-colors", type=int)
    parser.add_argument("--forbid-gradients", action="store_true")
    parser.add_argument("--forbid-filters", action="store_true")
    parser.add_argument("--forbid-external-images", action="store_true")
    parser.add_argument("--forbid-text", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    errors: list[str] = []

    try:
        root = ET.parse(args.svg).getroot()
    except (OSError, ET.ParseError) as error:
        print(f"ERROR: cannot parse SVG: {error}", file=sys.stderr)
        return 2

    if local_name(root.tag) != "svg":
        errors.append("root element is not <svg>")

    if not root.attrib.get("viewBox"):
        errors.append("viewBox is required")

    errors.extend(unsafe_svg_features(root))

    paints = collect_paints(root)
    if args.max_colors is not None and len(paints) > args.max_colors:
        errors.append(
            f"paint token count {len(paints)} exceeds --max-colors {args.max_colors}: "
            + ", ".join(sorted(paints))
        )

    element_names = {local_name(element.tag) for element in root.iter()}
    if args.forbid_gradients and ({"linearGradient", "radialGradient"} & element_names):
        errors.append("gradient elements are forbidden")
    if args.forbid_filters and "filter" in element_names:
        errors.append("filter elements are forbidden")
    if args.forbid_text and "text" in element_names:
        errors.append("<text> is forbidden; use geometry when exact stroke control is required")
    if args.forbid_external_images and has_external_image(root):
        errors.append("external or data-URI <image> is forbidden")

    print(f"file: {args.svg}")
    print(f"viewBox: {root.attrib.get('viewBox', '(none)')}")
    print(f"paint tokens ({len(paints)}): {', '.join(sorted(paints)) or '(none)'}")

    if errors:
        for error in errors:
            print(f"FAIL: {error}", file=sys.stderr)
        return 1

    print("PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
