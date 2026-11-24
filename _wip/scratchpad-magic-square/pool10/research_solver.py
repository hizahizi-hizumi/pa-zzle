"""調査コード magic_square_difficulty.py から写した関数（Geometry・geo_of・line_allowed_masks・count_solutions・
random_magic_square・all_squares4 と、補助の bits・popcount）を読み込む。写しは difficulty-functions.py。"""
import pathlib
import random

HERE = pathlib.Path(__file__).parent


def bits(m: int):
    while m:
        low = m & -m
        yield low.bit_length() - 1
        m ^= low


def popcount(m: int) -> int:
    return m.bit_count()


namespace = {"random": random, "bits": bits, "popcount": popcount, "GEOS": {}, "_SQUARES4": None}
exec((HERE / "difficulty-functions.py").read_text(encoding="utf-8"), namespace)
geo_of = namespace["geo_of"]
count_solutions = namespace["count_solutions"]
all_squares4 = namespace["all_squares4"]
random_magic_square = namespace["random_magic_square"]
