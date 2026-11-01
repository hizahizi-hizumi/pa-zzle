#!/usr/bin/env python3
"""Resolve the colors a play screen uses into values a showcase SVG can write.

Each argument is one of:
  - a Tailwind class or palette name (bg-blue-600, dark:text-red-500/70, blue-600, white): the value
    of --color-<name> in frontend/node_modules/tailwindcss/theme.css, converted to sRGB hex
  - an app token or a class that uses it (bg-background, text-muted-foreground, --border, ring): the
    :root (light) and .dark values in frontend/styles/globals.css, and whether var(--token) is allowed
  - a color literal (oklch(...), #rrggbb, rgb(...)): converted to sRGB hex

oklch values outside the sRGB gamut are clipped and marked, so the change can be noted in the manifest.
"""

from __future__ import annotations

import argparse
import math
import re
import sys
from pathlib import Path

from check_animation import APP_COLOR_TOKENS

REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_THEME_CSS = REPOSITORY_ROOT / "frontend/node_modules/tailwindcss/theme.css"
DEFAULT_GLOBALS_CSS = REPOSITORY_ROOT / "frontend/styles/globals.css"
OKLCH = re.compile(
    r"^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:/\s*([\d.]+)(%?))?\s*\)$", re.IGNORECASE
)
HEX = re.compile(r"^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$", re.IGNORECASE)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("names", nargs="+")
    parser.add_argument("--theme-css", type=Path, default=DEFAULT_THEME_CSS)
    parser.add_argument("--globals-css", type=Path, default=DEFAULT_GLOBALS_CSS)
    return parser.parse_args()


def custom_properties(css: str) -> dict[str, str]:
    return {name: value.strip() for name, value in re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", css)}


def block(css: str, selector: str) -> str:
    match = re.search(rf"(?m)^{re.escape(selector)}\s*\{{(.*?)^\}}", css, re.DOTALL)
    return match.group(1) if match else ""


def srgb_channel(linear: float) -> float:
    if linear <= 0.0031308:
        return 12.92 * linear
    return 1.055 * math.copysign(abs(linear) ** (1 / 2.4), linear) - 0.055


def oklch_to_srgb(lightness: float, chroma: float, hue: float) -> tuple[list[float], bool]:
    a = chroma * math.cos(math.radians(hue))
    b = chroma * math.sin(math.radians(hue))
    l_ = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m_ = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s_ = (lightness - 0.0894841775 * a - 1.2914855480 * b) ** 3
    linear = (
        4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
        -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
        -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_,
    )
    encoded = [srgb_channel(value) for value in linear]
    clipped = any(value < -0.002 or value > 1.002 for value in encoded)
    return [min(1.0, max(0.0, value)) for value in encoded], clipped


def to_hex(value: str, alpha_scale: float = 1.0) -> str:
    """sRGB hex of a literal color, or the literal itself when it is not oklch / hex."""
    value = value.strip()
    match = OKLCH.match(value)
    if match:
        lightness = float(match.group(1)) / (100 if match.group(2) else 1)
        rgb, clipped = oklch_to_srgb(lightness, float(match.group(3)), float(match.group(4)))
        alpha = 1.0
        if match.group(5):
            alpha = float(match.group(5)) / (100 if match.group(6) else 1)
        alpha *= alpha_scale
        text = "#" + "".join(f"{round(channel * 255):02x}" for channel in rgb)
        if alpha < 1:
            text += f"{round(alpha * 255):02x}"
        return text + (" (outside sRGB; clipped)" if clipped else "")
    if HEX.match(value) and alpha_scale < 1:
        digits = value[1:]
        if len(digits) in (3, 4):
            digits = "".join(char * 2 for char in digits)
        return f"#{digits[:6]}{round(alpha_scale * 255):02x}"
    return value if alpha_scale == 1 else f"{value} at opacity {alpha_scale:g}"


def candidates(name: str) -> list[str]:
    parts = name.split("-")
    return ["-".join(parts[index:]) for index in range(len(parts))]


def resolve(raw: str, palette: dict[str, str], light: dict[str, str], dark: dict[str, str]) -> str:
    if raw.startswith("--"):
        raw = raw[2:]
    if OKLCH.match(raw) or HEX.match(raw) or raw.lower().startswith("rgb"):
        return f"{raw} = {to_hex(raw)}"
    variants, _, utility = raw.rpartition(":")
    utility = utility.lstrip("!")
    name, _, opacity = utility.partition("/")
    alpha = float(opacity) / 100 if opacity else 1.0
    note = " (dark: variant: the value used in the dark theme)" if "dark" in variants.split(":") else ""
    for candidate in candidates(name):
        if f"--{candidate}" in light:
            allowed = candidate in APP_COLOR_TOKENS
            light_value = light[f"--{candidate}"]
            dark_value = dark.get(f"--{candidate}", light_value)
            usage = (
                f"write var(--{candidate})" + (f" with opacity {alpha:g}" if alpha < 1 else "")
                if allowed
                else "not an allowed app color token; write the values (switch with .dark if they differ)"
            )
            return (
                f"{raw} -> app token --{candidate}{note}: light {light_value} = {to_hex(light_value, alpha)}, "
                f"dark {dark_value} = {to_hex(dark_value, alpha)}; {usage}"
            )
        if f"--color-{candidate}" in palette:
            value = palette[f"--color-{candidate}"]
            return (
                f"{raw} -> Tailwind palette --color-{candidate}{note}: {value} = {to_hex(value, alpha)}; "
                "write the hex value (it is not a token)"
            )
    return f"{raw} -> not found in theme.css or globals.css"


def main() -> int:
    args = parse_args()
    try:
        palette = custom_properties(args.theme_css.read_text(encoding="utf-8"))
    except OSError as error:
        print(f"WARN: cannot read {args.theme_css} (install frontend dependencies): {error}", file=sys.stderr)
        palette = {}
    globals_css = args.globals_css.read_text(encoding="utf-8")
    light = custom_properties(block(globals_css, ":root"))
    dark = custom_properties(block(globals_css, ".dark"))
    for name in args.names:
        print(resolve(name, palette, light, dark))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
