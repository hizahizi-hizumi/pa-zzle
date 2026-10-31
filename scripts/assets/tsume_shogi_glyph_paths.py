"""詰将棋の駒の字と、盤の筋・段・札の字の輪郭を、書体から SVG のパスとして書き出す。

駒は Zen Antique Regular（400）、筋・段・札は Zen Old Mincho Medium（500）。どちらも @fontsource の
npm パッケージ（5.3.0）の woff2 から読む。パッケージは次のように取り出して、そのディレクトリを渡す。

    npm pack @fontsource/zen-antique@5.3.0 @fontsource/zen-old-mincho@5.3.0
    mkdir -p zen-antique zen-old-mincho
    tar -xzf fontsource-zen-antique-5.3.0.tgz -C zen-antique
    tar -xzf fontsource-zen-old-mincho-5.3.0.tgz -C zen-old-mincho
    uv run --with 'fonttools[woff]' python scripts/assets/tsume_shogi_glyph_paths.py \\
        --zen-antique zen-antique/package --zen-old-mincho zen-old-mincho/package

字形を見ても書体を見分けられないことがある（Yuji Syuku・Yuji Boku・Yuji Mai は配布元の TTF でも漢字の字形が同一で、
違うのは「と」だけ）。そのため書き出した字形からは、どの書体のファイルを読んだかを確かめられない。読み込んだ woff2 ごとに、
パッケージの名前と版、書体の PostScript 名と太さを確かめ、食い違えば書き出さずに止める。
"""

from __future__ import annotations

import argparse
import json
import math
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from fontTools.pens.basePen import BasePen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont

REPOSITORY = Path(__file__).resolve().parents[2]
BOARD_DIRECTORY = REPOSITORY / "frontend/src/games/tsume-shogi/ui/board"


@dataclass(frozen=True)
class FontSource:
    package: str
    version: str
    weight: int
    postscript_name: str
    file_prefix: str


PIECE_FONT = FontSource("@fontsource/zen-antique", "5.3.0", 400, "ZenAntique-Regular", "zen-antique")
LETTERING_FONT = FontSource(
    "@fontsource/zen-old-mincho", "5.3.0", 500, "ZenOldMincho-Medium", "zen-old-mincho"
)

PIECE_CHARACTERS = {
    "king": "玉",
    "rook": "飛",
    "bishop": "角",
    "gold": "金",
    "silver": "銀",
    "knight": "桂",
    "lance": "香",
    "pawn": "歩",
    "dragon": "龍",
    "horse": "馬",
    "promSilver": "全",
    "promKnight": "圭",
    "promLance": "杏",
    "promPawn": "と",
}
# 筋・段と、玉方の持駒の札に書く字。
LETTERING_CHARACTERS = "123456789一二三四五六七八九玉方の持駒残り全部"

# 駒の高さと底辺の幅、字の外接矩形の中心の頂点からの高さ（0.1mm）。`piece-shape.ts` と同じ値。
PIECE_BODIES = {
    "king": (315, 280),
    "rook": (305, 270),
    "bishop": (305, 270),
    "dragon": (305, 270),
    "horse": (305, 270),
    "gold": (295, 260),
    "silver": (295, 260),
    "promSilver": (295, 260),
    "knight": (285, 250),
    "promKnight": (285, 250),
    "lance": (280, 230),
    "promLance": (280, 230),
    "pawn": (270, 225),
    "promPawn": (270, 225),
}
GLYPH_CENTER_Y = {
    "king": 194.9,
    "rook": 184,
    "bishop": 178.2,
    "gold": 180.7,
    "silver": 177,
    "knight": 174.6,
    "lance": 178.5,
    "pawn": 167.1,
    "dragon": 186.8,
    "horse": 179.2,
    "promSilver": 180.7,
    "promKnight": 169.2,
    "promLance": 178.5,
    "promPawn": 140.1,
}
GLYPH_EM_RATIO = 0.72
HORIZONTAL_SQUEEZE = 0.88
# 面取り 0.9mm と、その内側の余白 1mm。
FACE_MARGIN = 19
SHRINK_STEP = 0.98
LETTERING_EM = 100


class FontMismatchError(Exception):
    pass


@dataclass
class Glyph:
    draw: Callable[[BasePen], None]
    bounds: tuple[float, float, float, float]
    units_per_em: int
    advance: int
    ascender: int
    descender: int


def read_package(directory: Path, source: FontSource) -> list[Path]:
    package = json.loads((directory / "package.json").read_text())
    if package["name"] != source.package or package["version"] != source.version:
        raise FontMismatchError(
            f"{directory}: {package['name']}@{package['version']} は {source.package}@{source.version} ではない"
        )
    files = sorted((directory / "files").glob(f"{source.file_prefix}-*-{source.weight}-normal.woff2"))
    if not files:
        raise FontMismatchError(f"{directory}: 太さ {source.weight} の woff2 が無い")
    return files


def check_font(font: TTFont, path: Path, source: FontSource) -> None:
    postscript_name = font["name"].getDebugName(6)
    weight = font["OS/2"].usWeightClass
    if postscript_name != source.postscript_name or weight != source.weight:
        raise FontMismatchError(
            f"{path.name}: {postscript_name}（{weight}）は {source.postscript_name}（{source.weight}）ではない"
        )


def load_glyphs(directory: Path, source: FontSource, characters: str) -> dict[str, Glyph]:
    glyphs: dict[str, Glyph] = {}
    for path in read_package(directory, source):
        font = TTFont(path)
        check_font(font, path, source)
        cmap = font.getBestCmap()
        glyph_set = font.getGlyphSet()
        for character in characters:
            if character in glyphs or ord(character) not in cmap:
                continue
            glyph = glyph_set[cmap[ord(character)]]
            bounds_pen = BoundsPen(glyph_set)
            glyph.draw(bounds_pen)
            glyphs[character] = Glyph(
                draw=glyph.draw,
                bounds=bounds_pen.bounds,
                units_per_em=font["head"].unitsPerEm,
                advance=glyph.width,
                ascender=font["OS/2"].sTypoAscender,
                descender=font["OS/2"].sTypoDescender,
            )
    missing = [character for character in characters if character not in glyphs]
    if missing:
        raise FontMismatchError(f"{source.package}: 字が無い {missing}")
    return glyphs


def format_tenths(value: int) -> str:
    """0.1 単位の整数を、先頭の 0 と末尾の .0 を省いた数にする（3 → .3、-25 → -2.5、10 → 1）。"""
    sign = "-" if value < 0 else ""
    whole, tenth = divmod(abs(value), 10)
    if tenth == 0:
        return f"{sign}{whole}"
    return f"{sign}{whole or ''}.{tenth}"


def join_numbers(numbers: list[int]) -> str:
    text = ""
    for number in numbers:
        formatted = format_tenths(number)
        if text and not formatted.startswith("-"):
            text += " "
        text += formatted
    return text


class RelativePathPen(BasePen):
    """座標を 0.1 単位に丸め、丸めた点からの相対座標でパスを書く。同じ命令が続くときは命令の文字を省く。"""

    def __init__(self, transform: Callable[[tuple[float, float]], tuple[float, float]]):
        super().__init__(None)
        self.transform = transform
        self.parts: list[str] = []
        self.current = (0, 0)
        self.start = (0, 0)
        self.last_command = ""

    def tenths(self, point: tuple[float, float]) -> tuple[int, int]:
        x, y = self.transform(point)
        return round(x * 10), round(y * 10)

    def emit(self, command: str, points: list[tuple[float, float]]) -> None:
        numbers: list[int] = []
        for point in points:
            x, y = self.tenths(point)
            numbers += [x - self.current[0], y - self.current[1]]
        self.current = self.tenths(points[-1])
        prefix = "" if command == self.last_command and command != "m" else command
        body = join_numbers(numbers)
        if not prefix and not body.startswith("-"):
            body = " " + body
        self.parts.append(prefix + body)
        self.last_command = command

    def _moveTo(self, point):
        self.emit("m", [point])
        self.start = self.current

    def _lineTo(self, point):
        self.emit("l", [point])

    def _qCurveToOne(self, control, point):
        self.emit("q", [control, point])

    def _curveToOne(self, control1, control2, point):
        self.emit("c", [control1, control2, point])

    def _closePath(self):
        self.parts.append("z")
        self.current = self.start
        self.last_command = "z"

    def path(self) -> str:
        return "".join(self.parts)


def pentagon_half_width(height: float, width: float, y: float) -> float:
    base_slope = 1 / math.tan(math.radians(81))
    roof_slope = math.tan(math.radians((180 - 144) / 2))
    shoulder_from_base = (height - (width / 2) * roof_slope) / (1 - base_slope * roof_slope)
    shoulder_x = width / 2 - base_slope * shoulder_from_base
    shoulder_y = height - shoulder_from_base
    if y <= 0 or y >= height:
        return 0
    if y < shoulder_y:
        return shoulder_x * y / shoulder_y
    return shoulder_x + (width / 2 - shoulder_x) * (y - shoulder_y) / (height - shoulder_y)


def piece_glyph_path(glyph: Glyph, piece_type: str) -> str:
    """字の大きさは駒の高さに比例させ、面取りの内側の余白に入らない字だけを縮める。字の外接矩形の中心を原点に置く。"""
    height, width = PIECE_BODIES[piece_type]
    center_y = GLYPH_CENTER_Y[piece_type]
    x0, y0, x1, y1 = glyph.bounds
    scale = height * GLYPH_EM_RATIO / glyph.units_per_em
    while True:
        half_width = (x1 - x0) / 2 * scale * HORIZONTAL_SQUEEZE
        half_height = (y1 - y0) / 2 * scale
        fits = all(
            half_width <= pentagon_half_width(height, width, y) - FACE_MARGIN
            for y in (center_y - half_height, center_y + half_height)
        ) and center_y + half_height <= height - FACE_MARGIN
        if fits:
            break
        scale *= SHRINK_STEP
    middle_x, middle_y = (x0 + x1) / 2, (y0 + y1) / 2
    pen = RelativePathPen(
        lambda point: ((point[0] - middle_x) * scale * HORIZONTAL_SQUEEZE, -(point[1] - middle_y) * scale)
    )
    glyph.draw(pen)
    return pen.path()


def lettering_glyph_path(glyph: Glyph) -> str:
    """1em を 100 にし、字送りの中心と、em の上下の中心を原点に置く。字ごとの位置の違いは書体のまま残す。"""
    scale = LETTERING_EM / glyph.units_per_em
    middle_x = glyph.advance / 2
    middle_y = (glyph.ascender + glyph.descender) / 2
    pen = RelativePathPen(lambda point: ((point[0] - middle_x) * scale, -(point[1] - middle_y) * scale))
    glyph.draw(pen)
    return pen.path()


PIECE_HEADER = """import type { TsumeShogiPieceType } from "@/games/tsume-shogi/puzzle/position";

/**
 * 駒に書く1文字の字形。0.1mm 単位の相対座標で、字の外接矩形の中心を原点に置く。駒の上の位置は `piece-shape.ts` が持つ。
 * 書体は Zen Antique Regular（Copyright 2021 The Zen Antique Project Authors、SIL Open Font License 1.1、
 * `@fontsource/zen-antique` 5.3.0 の 400）。fontTools で輪郭を読み、字形の横だけを 0.88 倍に詰め、線を足して太らせない。
 * 字の大きさは駒の高さに比例させ（1em ＝ 駒の高さ × 0.72）、面取りの内側から 1mm の余白に入らない字だけを縮めた。
 * 座標は 0.1 に丸めた。`scripts/assets/tsume_shogi_glyph_paths.py` が書き出す。
 * 実行時に書体を読み込まず、どの端末でも同じ字形で描くため、書体ではなく輪郭で持つ。
 * 書体の使用許諾は同じ階層の `piece-glyph-paths.OFL.txt` にある。
 */
export const tsumeShogiPieceGlyphPaths = {
"""
PIECE_FOOTER = "} as const satisfies Record<TsumeShogiPieceType, string>;\n"

LETTERING_HEADER = """/**
 * 盤の筋・段と、玉方の持駒の札に書く字の字形。1em を 100 とする相対座標で、字送りの中心と em の上下の中心を原点に置く。
 * 書体は Zen Old Mincho Medium（Copyright 2021 The Zen Old Mincho Project Authors、SIL Open Font License 1.1、
 * `@fontsource/zen-old-mincho` 5.3.0 の 500）。字形は変えず、座標を 0.1 に丸めた。
 * `scripts/assets/tsume_shogi_glyph_paths.py` が書き出す。
 * 書体の使用許諾は同じ階層の `lettering-glyph-paths.OFL.txt` にある。
 */
const letteringGlyphPaths: Readonly<Record<string, string>> = {
"""
LETTERING_FOOTER = """};

/** 1文字の字形。字形を持たない字は `null`。 */
export function getTsumeShogiLetteringGlyphPath(character: string): string | null {
  return letteringGlyphPaths[character] ?? null;
}
"""


def write_typescript(path: Path, header: str, entries: dict[str, str], footer: str) -> None:
    lines = [f"  {json.dumps(key, ensure_ascii=False)}:\n    {json.dumps(value)}," for key, value in entries.items()]
    path.write_text(header + "\n".join(lines) + "\n" + footer)


def write_license(path: Path, package_directory: Path) -> None:
    path.write_text((package_directory / "LICENSE").read_text())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--zen-antique", type=Path, required=True, help="@fontsource/zen-antique の package ディレクトリ")
    parser.add_argument("--zen-old-mincho", type=Path, required=True, help="@fontsource/zen-old-mincho の package ディレクトリ")
    arguments = parser.parse_args()

    piece_glyphs = load_glyphs(arguments.zen_antique, PIECE_FONT, "".join(PIECE_CHARACTERS.values()))
    lettering_glyphs = load_glyphs(arguments.zen_old_mincho, LETTERING_FONT, LETTERING_CHARACTERS)
    pieces = {
        piece_type: piece_glyph_path(piece_glyphs[character], piece_type)
        for piece_type, character in PIECE_CHARACTERS.items()
    }
    lettering = {character: lettering_glyph_path(lettering_glyphs[character]) for character in LETTERING_CHARACTERS}

    write_typescript(BOARD_DIRECTORY / "piece-glyph-paths.ts", PIECE_HEADER, pieces, PIECE_FOOTER)
    write_license(BOARD_DIRECTORY / "piece-glyph-paths.OFL.txt", arguments.zen_antique)
    write_typescript(BOARD_DIRECTORY / "lettering-glyph-paths.ts", LETTERING_HEADER, lettering, LETTERING_FOOTER)
    write_license(BOARD_DIRECTORY / "lettering-glyph-paths.OFL.txt", arguments.zen_old_mincho)


if __name__ == "__main__":
    main()
