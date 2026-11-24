"""送迎パーキング 調査: スマホ操作（一画面に収まる盤面と乗客の列の上限の見積もり）。

製品のプレイ画面の枠（GamePlayFrame）の実測値を定数に置き、
「乗客の列 → 待機枠と戻す操作の1行 → 盤面」を縦に積んだときの、
盤面のマスと車の短辺の大きさを計算する。標準ライブラリだけで書く。

実測（2026-11-22、開発サーバー、Playwright の devices['iPhone SE'] と devices['iPhone 13']）:
- 枠の上: BrandIdentityHeader 28px + PlayHeader 72px = 100px（全11ゲームで main の上端が 100）
- 枠の下: BrowserBottomSurface 12px（足場の無いゲームで main の下端が vh-12）
- パーキングジャムの main は左右 px-3（12px）、上下 py-2（8px）。足場（footer）は h-28（112px）
- パーキングジャムの盤面: マス 100、車の短辺 80（マスの縁から 10 ずつ内側）、プレイの余白 90（0.9 マス）
- 戻す操作（UndoButton）は size-12（48px）

限界: 文字の折り返し・端末の安全域（ノッチ）・ブラウザのツールバーの出入りは入れていない。
iPhone 13 の高さ 664 は Playwright の端末定義の値で、Safari のツールバーが出た状態の実機より大きいことがある。
"""

from __future__ import annotations

import json
import math
import sys

DEVICES = {"iPhone SE": (320, 568), "iPhone 13": (390, 664)}
FRAME_TOP = 100
FRAME_BOTTOM = 12
MAIN_PAD_X = 12
MAIN_PAD_Y = 8
GAP = 8
UNDO = 48
BAY_ROW = 48  # 待機枠と戻す操作を同じ1行に置く（詰将棋が持駒の行に戻す操作を置く前例）
CAR_SHORT_RATIO = 0.8

# 既存の下限: パーキングジャムの 8x8 を iPhone SE で表示したときの車の短辺（実測 24.2px、マス 30.2px）
EXISTING_MIN_CAR_SHORT = 24.2

MARGINS = {"play": 0.9, "figure": 0.5}


def queue_rows(length: int, width: float, chip: int, gap: int) -> int:
    per_row = max(1, math.floor((width + gap) / (chip + gap)))
    return math.ceil(length / per_row)


def queue_height(length: int, width: float, chip: int, gap: int) -> int:
    rows = queue_rows(length, width, chip, gap)
    return rows * chip + (rows - 1) * gap


def layout(device: str, board: int, queue: int, chip: int, chip_gap: int, margin: float, separate_footer: bool) -> dict:
    vw, vh = DEVICES[device]
    width = vw - 2 * MAIN_PAD_X
    total = vh - FRAME_TOP - FRAME_BOTTOM
    q = queue_height(queue, width, chip, chip_gap)
    if separate_footer:
        # パーキングジャムと同じく、戻す操作を盤面の下の足場（112px）に置き、待機枠は別の行に置く
        rest = total - 112 - 2 * MAIN_PAD_Y - q - GAP - BAY_ROW - GAP
    else:
        rest = total - 2 * MAIN_PAD_Y - q - GAP - BAY_ROW - GAP
    span = board + 2 * margin
    cell = min(width, rest) / span
    return {
        "queueRows": queue_rows(queue, width, chip, chip_gap),
        "queueHeight": q,
        "boardBox": [width, rest],
        "cell": round(cell, 1),
        "carShort": round(cell * CAR_SHORT_RATIO, 1),
        "boardLimitedBy": "height" if rest < width else "width",
    }


def max_queue(device: str, board: int, chip: int, chip_gap: int, margin: float, separate_footer: bool, floor: float) -> int:
    best = 0
    for length in range(1, 200):
        if layout(device, board, length, chip, chip_gap, margin, separate_footer)["carShort"] >= floor:
            best = length
        else:
            break
    return best


def main() -> dict:
    result: dict = {"conditions": {
        "frameTop": FRAME_TOP, "frameBottom": FRAME_BOTTOM, "mainPadX": MAIN_PAD_X, "mainPadY": MAIN_PAD_Y,
        "gap": GAP, "bayRow": BAY_ROW, "carShortRatio": CAR_SHORT_RATIO, "existingMinCarShort": EXISTING_MIN_CAR_SHORT,
        "margins": MARGINS,
    }}
    # 1. 列が 20 人（2 行）のときの盤面ごとの車の短辺
    table = []
    for device in DEVICES:
        for margin_name, margin in MARGINS.items():
            for board in range(5, 10):
                for separate in (False, True):
                    row = layout(device, board, 20, 24, 4, margin, separate)
                    table.append({"device": device, "margin": margin_name, "board": board,
                                  "undo": "footer" if separate else "bayRow", **row})
    result["queue20"] = table
    # 2. 既存の下限（24.2px）を守れる列の長さの上限
    limits = []
    for device in DEVICES:
        for margin_name, margin in MARGINS.items():
            for chip, chip_gap in ((24, 4), (20, 3)):
                for board in range(5, 10):
                    for separate in (False, True):
                        limits.append({"device": device, "margin": margin_name, "chip": chip, "board": board,
                                       "undo": "footer" if separate else "bayRow",
                                       "maxQueue": max_queue(device, board, chip, chip_gap, margin, separate, EXISTING_MIN_CAR_SHORT)})
    result["maxQueueAtExistingMin"] = limits
    # 3. 列の長さごとの行数（iPhone SE、24px の札）
    result["queueRowsSE"] = {n: queue_rows(n, 320 - 2 * MAIN_PAD_X, 24, 4) for n in (16, 20, 24, 30, 36, 40, 48)}
    return result


if __name__ == "__main__":
    json.dump(main(), sys.stdout, ensure_ascii=False, indent=1)
    sys.stdout.write("\n")
