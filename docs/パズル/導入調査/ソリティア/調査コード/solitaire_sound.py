"""ソリティア導入調査（音）の計測。

1. 同梱している効果音（frontend/src/**/*.flac）の本数・大きさ・長さ・形式を、ゲームごとにまとめる。
   アプリはタイトルでこれらすべてを読み込んでから入る（frontend/src/frontend.tsx の import.meta.glob、
   SPEC-005、frontend/src/lib/app-launch.ts の上限 4000ms）。FLAC の STREAMINFO とメタデータのブロックを
   標準ライブラリだけで読む。--levels を付けると ffmpeg で PCM に戻し、ピークと 50ms 窓の最大 RMS も測る
   （ffmpeg が要る。無ければ飛ばす）。
2. 4秒で全部を読み込むのに要る下りの帯域を、今の合計と、ソリティアの候補を足した合計で試算する。
   通信の往復・同時接続・デコードの時間は入れていない算術の試算で、回線での計測ではない。
3. ソリティア（列は全部表、山札は裏で1枚ずつ何周でも）の1局で、音を付けうる操作が何回起きるかを、
   認識合わせの試算（リポジトリには置いていない）の配り方・素朴な解き方（置けたら置く・無ければめくる）・DFS を写して数える。

    python3 docs/パズル/導入調査/ソリティア/調査コード/solitaire_sound.py [--levels] [--greedy-seeds 1000] [--dfs-seeds 100] [--dfs-limit 30000]

seed は 0 から順に固定する。乱数は random.Random(seed) だけで、同じ版の Python なら同じ結果になる。
"""

from __future__ import annotations

import argparse
import array
import math
import os
import shutil
import statistics
import subprocess
import sys
import random
from collections import Counter, defaultdict
from pathlib import Path

REPOSITORY = Path(__file__).resolve().parents[5]
SOURCE = REPOSITORY / "frontend/src"
SOUND_LOADING_LIMIT_MS = 4000  # frontend/src/lib/app-launch.ts

# ---------------------------------------------------------------------------
# 1. 同梱している効果音
# ---------------------------------------------------------------------------

# ファイル名から役割を分ける（DESIGN.md「効果音の強さ」の段階）。分け方はこの調査のためのもの。
REJECTED_NAMES = {"blocked", "invalid", "rejected"}
MISTAKE_NAMES = {"mistake-entered", "mine-stepped", "refuted"}


def role_of(owner: str, stem: str) -> str:
    if owner == "(アプリ)":
        return "アプリ"
    if stem.startswith("clear"):
        return "クリア"
    if stem in REJECTED_NAMES:
        return "不成立"
    if stem in MISTAKE_NAMES:
        return "ミス"
    return "操作"


def read_flac_header(path: Path) -> dict:
    with path.open("rb") as file:
        if file.read(4) != b"fLaC":
            raise ValueError(f"FLAC ではない: {path}")
        blocks = []
        info = None
        while True:
            header = file.read(4)
            last = header[0] & 0x80
            block_type = header[0] & 0x7F
            length = int.from_bytes(header[1:4], "big")
            body = file.read(length)
            blocks.append((block_type, length))
            if block_type == 0:
                bits = int.from_bytes(body[10:18], "big")
                sample_rate = bits >> 44
                channels = ((bits >> 41) & 0x7) + 1
                bits_per_sample = ((bits >> 36) & 0x1F) + 1
                total_samples = bits & 0xFFFFFFFFF
                info = {
                    "sample_rate": sample_rate,
                    "channels": channels,
                    "bits": bits_per_sample,
                    "seconds": total_samples / sample_rate if sample_rate else 0.0,
                }
            if last:
                break
    assert info is not None
    info["metadata_blocks"] = blocks
    info["has_padding"] = any(block_type == 1 for block_type, _ in blocks)
    info["padding_bytes"] = sum(4 + length for block_type, length in blocks if block_type == 1)
    info["metadata_bytes"] = 4 + sum(4 + length for _, length in blocks)
    return info


def measure_levels(path: Path) -> tuple[float, float] | None:
    """ピーク（dBFS）と 50ms 窓の最大 RMS（dBFS）。ffmpeg で 48kHz・モノラル・16bit に戻して測る。"""
    if shutil.which("ffmpeg") is None:
        return None
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-f", "s16le", "-ac", "1", "-ar", "48000", "-"],
        check=True,
        capture_output=True,
    ).stdout
    samples = array.array("h")
    samples.frombytes(raw)
    if sys.byteorder == "big":
        samples.byteswap()
    if not samples:
        return None
    peak = max(abs(value) for value in samples) / 32768
    window = 2400  # 50ms
    squares = [(value / 32768) ** 2 for value in samples]
    running = sum(squares[:window])
    best = running
    for index in range(window, len(squares)):
        running += squares[index] - squares[index - window]
        best = max(best, running)
    rms = math.sqrt(max(best, 0.0) / min(window, len(squares)))

    def to_db(value: float) -> float:
        return 20 * math.log10(value) if value > 0 else -math.inf

    return to_db(peak), to_db(rms)


def collect_sounds(with_levels: bool) -> list[dict]:
    rows = []
    for path in sorted(SOURCE.glob("**/*.flac")):
        relative = path.relative_to(SOURCE)
        parts = relative.parts
        owner = parts[1] if parts[0] == "games" else "(アプリ)"
        header = read_flac_header(path)
        row = {
            "owner": owner,
            "name": path.stem,
            "role": role_of(owner, path.stem),
            "bytes": os.path.getsize(path),
            **header,
        }
        if with_levels:
            levels = measure_levels(path)
            row["peak_db"], row["rms50_db"] = levels if levels else (None, None)
        rows.append(row)
    return rows


def report_sounds(rows: list[dict], with_levels: bool) -> dict:
    print("## 1. 同梱している効果音（frontend/src/**/*.flac）")
    formats = Counter((row["sample_rate"], row["channels"], row["bits"]) for row in rows)
    padded = [row for row in rows if row["has_padding"]]
    print(f"ファイル数 {len(rows)}。形式（Hz, ch, bit）: {dict(formats)}。PADDING あり: {len(padded)} 本"
          f"（{', '.join(sorted({row['owner'] for row in padded}))}）、PADDING の合計 "
          f"{sum(row['padding_bytes'] for row in rows) / 1000:.1f} KB")
    print()
    print("| 持ち主 | 本数 | 合計 KB | PADDING を除いた KB | 1本の平均 KB | 合計秒 | 操作 | 不成立 | ミス | クリア | アプリ |")
    print("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|")
    by_owner: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        by_owner[row["owner"]].append(row)
    summary = {}
    for owner in sorted(by_owner, key=lambda name: (name == "(アプリ)", name)):
        group = by_owner[owner]
        total = sum(row["bytes"] for row in group)
        unpadded = total - sum(row["padding_bytes"] for row in group)
        seconds = sum(row["seconds"] for row in group)
        roles = Counter(row["role"] for row in group)
        summary[owner] = {"count": len(group), "bytes": total, "unpadded": unpadded, "seconds": seconds, "roles": roles}
        print(f"| {owner} | {len(group)} | {total / 1000:.1f} | {unpadded / 1000:.1f} | {total / len(group) / 1000:.1f} | "
              f"{seconds:.2f} | {roles['操作']} | {roles['不成立']} | {roles['ミス']} | {roles['クリア']} | {roles['アプリ']} |")
    all_bytes = sum(row["bytes"] for row in rows)
    all_unpadded = all_bytes - sum(row["padding_bytes"] for row in rows)
    print(f"| 合計 | {len(rows)} | {all_bytes / 1000:.1f} | {all_unpadded / 1000:.1f} | {all_bytes / len(rows) / 1000:.1f} | "
          f"{sum(row['seconds'] for row in rows):.2f} | | | | | |")
    games = {owner: value for owner, value in summary.items() if owner != "(アプリ)"}
    counts = sorted(value["count"] for value in games.values())
    sizes = sorted(value["bytes"] for value in games.values())
    unpadded_sizes = sorted(value["unpadded"] for value in games.values())
    print()
    print(f"ゲーム {len(games)} 個: 本数 最小 {counts[0]}・中央 {statistics.median(counts)}・最大 {counts[-1]}、"
          f"合計 KB 最小 {sizes[0] / 1000:.1f}・中央 {statistics.median(sizes) / 1000:.1f}・最大 {sizes[-1] / 1000:.1f}、"
          f"PADDING を除くと 中央 {statistics.median(unpadded_sizes) / 1000:.1f}・最大 {unpadded_sizes[-1] / 1000:.1f}")
    print(f"ゲームの音が全体に占める割合: {sum(sizes) / all_bytes:.1%}")

    print()
    print("### 役割ごとの1本（ゲームの音だけ）")
    print("| 役割 | 本数 | KB 中央 | KB 最大 | 秒 中央 | 秒 最大 | PADDING を除いた KB/秒 中央 |")
    print("|---|---:|---:|---:|---:|---:|---:|")
    for role in ("操作", "不成立", "ミス", "クリア"):
        group = [row for row in rows if row["role"] == role]
        kb = sorted(row["bytes"] / 1000 for row in group)
        sec = sorted(row["seconds"] for row in group)
        rate = sorted((row["bytes"] - row["padding_bytes"]) / 1000 / row["seconds"] for row in group if row["seconds"] > 0)
        print(f"| {role} | {len(group)} | {statistics.median(kb):.1f} | {kb[-1]:.1f} | "
              f"{statistics.median(sec):.3f} | {sec[-1]:.3f} | {statistics.median(rate):.1f} |")

    print()
    print("### 1本ずつ")
    header = "| 持ち主 | 名前 | 役割 | KB | 秒 |"
    rule = "|---|---|---|---:|---:|"
    if with_levels:
        header += " ピーク dBFS | 50ms 最大 RMS dBFS |"
        rule += "---:|---:|"
    print(header)
    print(rule)
    for row in sorted(rows, key=lambda row: (row["owner"] == "(アプリ)", row["owner"], row["name"])):
        line = (f"| {row['owner']} | {row['name']} | {row['role']} | {row['bytes'] / 1000:.1f} | "
                f"{row['seconds']:.3f} |")
        if with_levels:
            peak, rms = row.get("peak_db"), row.get("rms50_db")
            line += f" {peak:.1f} | {rms:.1f} |" if peak is not None else " - | - |"
        print(line)

    if with_levels:
        print()
        print("### 役割ごとの大きさ（ゲームの音だけ、50ms 最大 RMS dBFS）")
        for role in ("操作", "不成立", "ミス", "クリア"):
            values = sorted(row["rms50_db"] for row in rows if row["role"] == role and row.get("rms50_db") is not None)
            if values:
                print(f"- {role}: 最小 {values[0]:.1f}・中央 {statistics.median(values):.1f}・最大 {values[-1]:.1f}（{len(values)} 本）")
    return {"all_bytes": all_bytes, "all_unpadded": all_unpadded, "all_count": len(rows), "games": games}


def report_budget(totals: dict) -> None:
    print()
    print("## 2. 4秒で全部を読み込むのに要る下りの帯域（算術の試算）")
    print("往復・同時接続・デコードを入れない。bytes×8 / 4秒。")
    base = totals["all_bytes"]
    games = totals["games"]
    sizes = sorted(value["bytes"] for value in games.values())
    candidates = {
        "今": 0,
        "+ゲームの中央": statistics.median(sizes),
        "+ゲームの最大": sizes[-1],
        "+60KB": 60_000,
        "+100KB": 100_000,
    }
    print("| 場合 | 合計 KB | 要る帯域 kbps | 今からの増え |")
    print("|---|---:|---:|---:|")
    for label, extra in candidates.items():
        total = base + extra
        kbps = total * 8 / (SOUND_LOADING_LIMIT_MS / 1000) / 1000
        print(f"| {label} | {total / 1000:.1f} | {kbps:.0f} | {extra / base:+.1%} |")
    unpadded = totals["all_unpadded"]
    kbps = unpadded * 8 / (SOUND_LOADING_LIMIT_MS / 1000) / 1000
    print(f"| （参考）今から PADDING を除いた | {unpadded / 1000:.1f} | {kbps:.0f} | {(unpadded - base) / base:+.1%} |")


# ---------------------------------------------------------------------------
# 3. ソリティアの1局で起きる操作（認識合わせの試算を写して、操作を数えるように直した）
# card = suit*13 + (rank-1)。suit: 0♠ 1♥ 2♦ 3♣。赤は 1,2。
# ---------------------------------------------------------------------------


def rank(card: int) -> int:
    return card % 13 + 1


def suit(card: int) -> int:
    return card // 13


def red(card: int) -> bool:
    return suit(card) in (1, 2)


def deal(seed: int):
    generator = random.Random(seed)
    deck = list(range(52))
    generator.shuffle(deck)
    tableau = []
    index = 0
    for size in range(1, 8):
        tableau.append(tuple(deck[index:index + size]))
        index += size
    stock = tuple(deck[index:])  # stock[0] が次にめくる札
    return tableau, stock


def runs_start(column) -> int:
    index = len(column) - 1
    while index > 0:
        upper, lower = column[index - 1], column[index]
        if rank(upper) == rank(lower) + 1 and red(upper) != red(lower):
            index -= 1
        else:
            break
    return index


def can_stack(card: int, onto: int) -> bool:
    return rank(onto) == rank(card) + 1 and red(onto) != red(card)


def greedy_operations(tableau, stock):
    """素朴な遊び方（置けたら置く・無ければめくる）。解けたら操作の列を返し、詰んだら None。

    操作の名前: to_foundation（列か捨て札から組札へ）、to_tableau（列か捨て札から列へ。n は動かした枚数）、
    flip（山札を1枚めくる）、recycle（捨て札を山札へ戻す）。
    """
    waste = ()
    foundation = [0] * 4
    tableau = list(tableau)
    seen = set()
    operations = []
    while True:
        if sum(foundation) == 52:
            return operations
        key = (tuple(sorted(tableau)), stock, waste, tuple(foundation))
        if key in seen:
            return None
        seen.add(key)
        done = False
        for index, column in enumerate(tableau):
            if column and foundation[suit(column[-1])] == rank(column[-1]) - 1:
                foundation[suit(column[-1])] += 1
                tableau[index] = column[:-1]
                operations.append(("to_foundation", 1))
                done = True
                break
        if done:
            continue
        if waste and foundation[suit(waste[-1])] == rank(waste[-1]) - 1:
            foundation[suit(waste[-1])] += 1
            waste = waste[:-1]
            operations.append(("to_foundation", 1))
            continue
        for index, column in enumerate(tableau):
            if not column:
                continue
            start = runs_start(column)
            card = column[start]
            for target, destination in enumerate(tableau):
                if index == target:
                    continue
                if (destination and can_stack(card, destination[-1])) or (
                    not destination and rank(card) == 13 and start > 0
                ):
                    tableau[target] = destination + column[start:]
                    tableau[index] = column[:start]
                    operations.append(("to_tableau", len(column) - start))
                    done = True
                    break
            if done:
                break
        if done:
            continue
        if waste:
            card = waste[-1]
            for target, destination in enumerate(tableau):
                if (destination and can_stack(card, destination[-1])) or (not destination and rank(card) == 13):
                    tableau[target] = destination + (card,)
                    waste = waste[:-1]
                    operations.append(("to_tableau", 1))
                    done = True
                    break
        if done:
            continue
        if stock:
            waste = waste + (stock[0],)
            stock = stock[1:]
            operations.append(("flip", 1))
            continue
        if waste:
            stock = waste
            waste = ()
            operations.append(("recycle", len(stock)))
            continue
        return None


def safe_auto(card: int, foundation) -> bool:
    value = rank(card)
    if foundation[suit(card)] != value - 1:
        return False
    if value <= 2:
        return True
    opposite = (1, 2) if not red(card) else (0, 3)
    return all(foundation[other] >= value - 1 for other in opposite)


def dfs_operations(tableau, stock, limit: int):
    """認識合わせの試算の DFS（安全な組札送りは自動）で見つけた解の操作の列。打ち切りは 'unknown'、解けないなら 'lose'。

    自動の組札送りも、遊ぶ人が1枚ずつ運ぶ操作として数える（自動で運ぶかは決まっていない）。
    組札から列へ戻す操作（from_foundation）を含む。解は最短でも人の解き方でもない。
    """
    sys.setrecursionlimit(100000)
    seen = set()
    nodes = [0]

    def auto(tableau, waste, foundation):
        tableau = list(tableau)
        waste = list(waste)
        foundation = list(foundation)
        count = 0
        moved = True
        while moved:
            moved = False
            for index, column in enumerate(tableau):
                if column and safe_auto(column[-1], foundation):
                    foundation[suit(column[-1])] += 1
                    tableau[index] = column[:-1]
                    moved = True
                    count += 1
            if waste and safe_auto(waste[-1], foundation):
                foundation[suit(waste[-1])] += 1
                waste.pop()
                moved = True
                count += 1
        return tuple(tableau), tuple(waste), tuple(foundation), count

    def moves(tableau, stock, waste, foundation):
        out = []
        for index, column in enumerate(tableau):
            if column and foundation[suit(column[-1])] == rank(column[-1]) - 1:
                next_foundation = list(foundation)
                next_foundation[suit(column[-1])] += 1
                next_tableau = list(tableau)
                next_tableau[index] = column[:-1]
                out.append((0, ("to_foundation", 1), tuple(next_tableau), stock, waste, tuple(next_foundation)))
        if waste and foundation[suit(waste[-1])] == rank(waste[-1]) - 1:
            next_foundation = list(foundation)
            next_foundation[suit(waste[-1])] += 1
            out.append((0, ("to_foundation", 1), tableau, stock, waste[:-1], tuple(next_foundation)))
        for index, column in enumerate(tableau):
            if not column:
                continue
            start = runs_start(column)
            for cut in range(start, len(column)):
                card = column[cut]
                for target, destination in enumerate(tableau):
                    if index == target:
                        continue
                    if destination:
                        if not can_stack(card, destination[-1]):
                            continue
                    elif rank(card) != 13 or cut == 0:
                        continue
                    next_tableau = list(tableau)
                    next_tableau[index] = column[:cut]
                    next_tableau[target] = destination + column[cut:]
                    priority = 1 if cut == start else 3
                    out.append((priority, ("to_tableau", len(column) - cut), tuple(next_tableau), stock, waste, foundation))
        if waste:
            card = waste[-1]
            for target, destination in enumerate(tableau):
                if (destination and can_stack(card, destination[-1])) or (not destination and rank(card) == 13):
                    next_tableau = list(tableau)
                    next_tableau[target] = destination + (card,)
                    out.append((2, ("to_tableau", 1), tuple(next_tableau), stock, waste[:-1], foundation))
        for pile in range(4):
            if foundation[pile] >= 3:
                card = pile * 13 + foundation[pile] - 1
                for target, destination in enumerate(tableau):
                    if destination and can_stack(card, destination[-1]):
                        next_foundation = list(foundation)
                        next_foundation[pile] -= 1
                        next_tableau = list(tableau)
                        next_tableau[target] = destination + (card,)
                        out.append((5, ("from_foundation", 1), tuple(next_tableau), stock, waste, tuple(next_foundation)))
        if stock:
            out.append((4, ("flip", 1), tableau, stock[1:], waste + (stock[0],), foundation))
        elif waste:
            out.append((6, ("recycle", len(waste)), tableau, tuple(waste), (), foundation))
        out.sort(key=lambda move: move[0])
        return out

    def dfs(tableau, stock, waste, foundation, path):
        tableau, waste, foundation, automatic = auto(tableau, waste, foundation)
        path = path + [("to_foundation", 1)] * automatic
        if sum(foundation) == 52:
            return path
        key = (tuple(sorted(tableau)), stock, waste, foundation)
        if key in seen:
            return None
        seen.add(key)
        nodes[0] += 1
        if nodes[0] > limit:
            raise TimeoutError
        for move in moves(tableau, stock, waste, foundation):
            found = dfs(*move[2:], path + [move[1]])
            if found is not None:
                return found
        return None

    try:
        found = dfs(tableau, stock, (), (0, 0, 0, 0), [])
        return found if found is not None else "lose"
    except TimeoutError:
        return "unknown"


SOUND_KINDS = {
    "to_foundation": "組札へ運ぶ",
    "to_tableau": "列へ置く",
    "from_foundation": "組札から列へ戻す",
    "flip": "山札をめくる",
    "recycle": "山札を戻す",
}


def summarize_operations(label: str, plays: list[list[tuple[str, int]]]) -> None:
    print()
    print(f"### {label}（{len(plays)} 局）")
    if not plays:
        print("解けた局が無い")
        return
    totals = [len(play) for play in plays]
    print(f"1局の操作: 中央 {statistics.median(totals)}・最小 {min(totals)}・最大 {max(totals)}")
    print("| 操作 | 1局の回数 中央 | 最小 | 最大 | 全操作に占める割合 |")
    print("|---|---:|---:|---:|---:|")
    all_count = sum(totals)
    for kind, name in SOUND_KINDS.items():
        per_play = [sum(1 for operation, _ in play if operation == kind) for play in plays]
        share = sum(per_play) / all_count
        print(f"| {name} | {statistics.median(per_play)} | {min(per_play)} | {max(per_play)} | {share:.1%} |")
    multi = [sum(1 for operation, size in play if operation == "to_tableau" and size >= 2) for play in plays]
    print(f"列へ置くうち2枚以上をまとめて動かす: 1局の中央 {statistics.median(multi)}・最大 {max(multi)}")
    sizes = Counter(size for play in plays for operation, size in play if operation == "to_tableau")
    print(f"列へ置く枚数の分布: {dict(sorted(sizes.items()))}")
    flip_streaks = []
    same_streaks = []
    for play in plays:
        longest_flip = 0
        longest_same = 0
        current_flip = 0
        current_same = 0
        previous = None
        for operation, _ in play:
            current_flip = current_flip + 1 if operation == "flip" else 0
            longest_flip = max(longest_flip, current_flip)
            current_same = current_same + 1 if operation == previous else 1
            longest_same = max(longest_same, current_same)
            previous = operation
        flip_streaks.append(longest_flip)
        same_streaks.append(longest_same)
    print(f"めくるが続く最長: 1局の中央 {statistics.median(flip_streaks)}・最大 {max(flip_streaks)}")
    print(f"同じ種類の操作が続く最長: 1局の中央 {statistics.median(same_streaks)}・最大 {max(same_streaks)}")
    to_foundation_streaks = []
    for play in plays:
        longest = 0
        current = 0
        for operation, _ in play:
            current = current + 1 if operation == "to_foundation" else 0
            longest = max(longest, current)
        to_foundation_streaks.append(longest)
    print(f"組札へ運ぶが続く最長: 1局の中央 {statistics.median(to_foundation_streaks)}・最大 {max(to_foundation_streaks)}")
    tails = []
    for play in plays:
        tail = 0
        for operation, _ in reversed(play):
            if operation != "to_foundation":
                break
            tail += 1
        tails.append(tail)
    print(f"最後に組札へ運ぶだけが続く手数（自動で運ぶなら一度に動く枚数の目安）: 中央 {statistics.median(tails)}・最小 {min(tails)}・最大 {max(tails)}")


def report_operations(greedy_seeds: int, dfs_seeds: int, dfs_limit: int) -> None:
    print()
    print("## 3. ソリティアの1局で起きる操作")
    print(f"配り方: seed 0〜{greedy_seeds - 1} を random.Random(seed).shuffle。列は1〜7枚で全部表、残り24枚が山札。")
    greedy_plays = []
    for seed in range(greedy_seeds):
        tableau, stock = deal(seed)
        operations = greedy_operations(tableau, stock)
        if operations is not None:
            greedy_plays.append(operations)
    print(f"素朴な解き方で解けた: {len(greedy_plays)} / {greedy_seeds}")
    summarize_operations("素朴な解き方で解けた局", greedy_plays)

    dfs_plays = []
    results = Counter()
    for seed in range(dfs_seeds):
        tableau, stock = deal(seed)
        found = dfs_operations(tableau, stock, dfs_limit)
        if isinstance(found, list):
            results["win"] += 1
            dfs_plays.append(found)
        else:
            results[found] += 1
    print()
    print(f"DFS（seed 0〜{dfs_seeds - 1}、{dfs_limit} 局面で打ち切り）: {dict(results)}")
    summarize_operations("DFS で見つけた解（人の解き方ではない）", dfs_plays)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--levels", action="store_true", help="ffmpeg でピークと 50ms 最大 RMS も測る")
    parser.add_argument("--greedy-seeds", type=int, default=1000)
    parser.add_argument("--dfs-seeds", type=int, default=100)
    parser.add_argument("--dfs-limit", type=int, default=30000)
    parser.add_argument("--skip-operations", action="store_true")
    arguments = parser.parse_args()

    rows = collect_sounds(arguments.levels)
    totals = report_sounds(rows, arguments.levels)
    report_budget(totals)
    if not arguments.skip_operations:
        report_operations(arguments.greedy_seeds, arguments.dfs_seeds, arguments.dfs_limit)


if __name__ == "__main__":
    main()
