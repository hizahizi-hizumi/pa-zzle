"""覆面算の導入調査「音」: 既存の効果音の本数・大きさ・長さと、覆面算で鳴る操作の回数の見積もり。

1. 在庫: frontend/src 以下の FLAC（frontend/src/frontend.tsx の import.meta.glob が
   タイトルで全部読み込む対象）を、アプリ共通とゲームごとに数え、バイト数と、
   STREAMINFO から読んだ長さ・標本化周波数・チャンネル数・ビット深度を出す。
2. 頻度: 「× で候補を消し、決まってから ◯ を付ける」解き方を、列ごとの整合（繰り上がり込み）・
   違う文字は違う数字・10文字なら残り1つの数字・1段の仮定と矛盾 で模した解き手で解き、
   付ける ◯ と × の数を数える。表のタップの巡回の順（◯→×→空白 と ×→◯→空白）ごとに、
   それぞれの音が何回鳴るかを出す。問題は認識合わせの見本3問と、seed 固定で作った
   L1 型（3桁＋3桁＝4桁、6文字）・L5 型（5桁×3＝6桁、10文字）の一意解の問題。

標準ライブラリだけで動く。

    python3 docs/パズル/導入調査/覆面算/調査コード/fukumenzan_sound.py <リポジトリのルート>

限界:
- 解き手は人の推理の模型で、実際の人の × の付け方（全部付けるか、要る所だけか）は分からない。
  そこで × を「列の推理・残り1つ・先頭の0・仮定の矛盾で消した候補だけ」（模型A）と
  「◯ で使った数字の列の残りも全部」（模型B）の2通りで数える。
- 付け直し・空白へ戻す操作（迷い・誤り）は数えていない。実際の回数はこれより多い。
- 大きさはバイト数で、読み込みの待ちは回線を仮定した転送時間の計算（計測ではない）。
"""

from __future__ import annotations

import json
import random
import sys
from collections import defaultdict
from itertools import permutations
from pathlib import Path

SEED = 20261122
RANDOM_PUZZLES_PER_SHAPE = 40
SOUND_LOADING_LIMIT_MS = 4000  # frontend/src/lib/app-launch.ts の値（読んだ値）


# ---------------------------------------------------------------- 1. 在庫


def read_streaminfo(path: Path) -> dict[str, float]:
    data = path.read_bytes()
    if data[:4] != b"fLaC":
        raise ValueError(f"not FLAC: {path}")
    offset = 4
    while True:
        header = data[offset]
        block_type = header & 0x7F
        length = int.from_bytes(data[offset + 1 : offset + 4], "big")
        body = data[offset + 4 : offset + 4 + length]
        if block_type == 0:
            packed = int.from_bytes(body[10:18], "big")
            sample_rate = packed >> 44
            channels = ((packed >> 41) & 0x7) + 1
            bits = ((packed >> 36) & 0x1F) + 1
            total_samples = packed & ((1 << 36) - 1)
            return {
                "sample_rate": sample_rate,
                "channels": channels,
                "bits": bits,
                "seconds": total_samples / sample_rate,
            }
        if header & 0x80:
            raise ValueError(f"no STREAMINFO: {path}")
        offset += 4 + length


def group_of(relative: Path) -> str:
    parts = relative.parts
    if parts[0] == "games":
        return parts[1]
    return "app"


def is_clear_sound(name: str) -> bool:
    return name.startswith("clear")


def inventory(root: Path) -> dict:
    source = root / "frontend/src"
    groups: dict[str, list[dict]] = defaultdict(list)
    formats: dict[str, int] = defaultdict(int)
    for path in sorted(source.rglob("*.flac")):
        info = read_streaminfo(path)
        formats[f"{info['channels']}ch/{info['bits']}bit/{info['sample_rate']}Hz"] += 1
        groups[group_of(path.relative_to(source))].append(
            {
                "name": path.stem,
                "bytes": path.stat().st_size,
                "seconds": round(info["seconds"], 3),
            }
        )
    rows = []
    for group, files in sorted(groups.items()):
        clear = [f for f in files if is_clear_sound(f["name"])]
        operation = [f for f in files if not is_clear_sound(f["name"])]
        rows.append(
            {
                "group": group,
                "files": len(files),
                "bytes": sum(f["bytes"] for f in files),
                "seconds": round(sum(f["seconds"] for f in files), 2),
                "operation_files": len(operation),
                "operation_bytes": sum(f["bytes"] for f in operation),
                "clear_files": len(clear),
                "clear_bytes": sum(f["bytes"] for f in clear),
                "max_operation_seconds": max(
                    (f["seconds"] for f in operation), default=0
                ),
            }
        )
    total_bytes = sum(r["bytes"] for r in rows)
    total_files = sum(r["files"] for r in rows)
    games = [r for r in rows if r["group"] != "app"]
    game_bytes = sorted(r["bytes"] for r in games)
    game_files = sorted(r["files"] for r in games)
    median = lambda xs: (xs[len(xs) // 2] + xs[(len(xs) - 1) // 2]) / 2  # noqa: E731
    # 4秒の上限の中で転送し終えるのに要る帯域（転送だけ。往復の待ち・復号は含めない）
    needed_kbps = total_bytes * 8 / (SOUND_LOADING_LIMIT_MS / 1000) / 1000
    return {
        "rows": rows,
        "formats": dict(formats),
        "total_files": total_files,
        "total_bytes": total_bytes,
        "game_count": len(games),
        "game_bytes_median": median(game_bytes),
        "game_bytes_min": game_bytes[0],
        "game_bytes_max": game_bytes[-1],
        "game_files_median": median(game_files),
        "needed_kbps_for_limit": round(needed_kbps, 1),
    }


# ---------------------------------------------------------------- 2. 頻度


class Puzzle:
    def __init__(self, addends: list[str], result: str):
        self.addends = addends
        self.result = result
        self.letters = sorted(set("".join(addends) + result))
        self.leading = {w[0] for w in addends + [result] if len(w) > 1}
        self.columns = []
        for i in range(len(result)):
            terms = [w[-1 - i] for w in addends if i < len(w)]
            self.columns.append((terms, result[-1 - i]))
        self.carry_max = len(addends) - 1

    def label(self) -> str:
        return "+".join(self.addends) + "=" + self.result


def count_solutions(p: Puzzle, limit: int = 2) -> tuple[int, dict | None]:
    """列ごとの後戻り探索で解の数を limit まで数える。"""
    found = [0]
    first: list[dict | None] = [None]

    def column(i: int, carry: int, asg: dict, used: set) -> None:
        if found[0] >= limit:
            return
        if i == len(p.columns):
            if carry == 0:
                found[0] += 1
                if first[0] is None:
                    first[0] = dict(asg)
            return
        terms, res = p.columns[i]
        free = [ch for ch in dict.fromkeys(terms) if ch not in asg]
        for values in permutations([d for d in range(10) if d not in used], len(free)):
            ok = True
            for ch, v in zip(free, values):
                if v == 0 and ch in p.leading:
                    ok = False
                    break
            if not ok:
                continue
            local = dict(asg)
            local.update(zip(free, values))
            total = sum(local[ch] for ch in terms) + carry
            digit, nxt = total % 10, total // 10
            if res in local:
                if local[res] != digit:
                    continue
                column(i + 1, nxt, local, used | set(values))
            else:
                if digit in used or digit in values or (digit == 0 and res in p.leading):
                    continue
                local[res] = digit
                column(i + 1, nxt, local, used | set(values) | {digit})

    column(0, 0, {}, set())
    return found[0], first[0]


class Contradiction(Exception):
    pass


def propagate(p: Puzzle, dom: dict[str, set[int]], log: list | None) -> None:
    """列の整合・違う数字・残り1つを、変わらなくなるまで当てる。log に (種類, 文字, 数字) を足す。"""

    def remove(ch: str, d: int, kind: str) -> bool:
        if d in dom[ch]:
            dom[ch].discard(d)
            if log is not None:
                log.append((kind, ch, d))
            if not dom[ch]:
                raise Contradiction
            return True
        return False

    carries = {i: set(range(p.carry_max + 1)) for i in range(len(p.columns) + 1)}
    carries[0] = {0}
    carries[len(p.columns)] = {0}
    changed = True
    while changed:
        changed = False
        # 違う文字は違う数字（決まった文字の数字を、ほかの文字から消す）
        for ch in p.letters:
            if len(dom[ch]) == 1:
                d = next(iter(dom[ch]))
                for other in p.letters:
                    if other != ch and remove(other, d, "alldiff"):
                        changed = True
        # 列ごとの整合
        for i, (terms, res) in enumerate(p.columns):
            uniq = list(dict.fromkeys(terms))
            support = {ch: set() for ch in uniq + [res]}
            cin_support, cout_support = set(), set()
            for values in _product([sorted(dom[ch]) for ch in uniq]):
                if len(set(values)) != len(values):
                    continue
                asg = dict(zip(uniq, values))
                base = sum(asg[ch] for ch in terms)
                for cin in carries[i]:
                    total = base + cin
                    digit, cout = total % 10, total // 10
                    if cout not in carries[i + 1]:
                        continue
                    if res in asg:
                        if asg[res] != digit:
                            continue
                    else:
                        if digit not in dom[res] or digit in values:
                            continue
                    for ch, v in asg.items():
                        support[ch].add(v)
                    support[res].add(digit)
                    cin_support.add(cin)
                    cout_support.add(cout)
            for ch, sup in support.items():
                for d in sorted(dom[ch] - sup):
                    remove(ch, d, "column")
                    changed = True
            if not cin_support or not cout_support:
                raise Contradiction
            if cin_support != carries[i]:
                carries[i] = cin_support
                changed = True
            if cout_support != carries[i + 1]:
                carries[i + 1] = cout_support
                changed = True
        # 10文字なら、その数字が入れる文字が1つだけのとき決まる
        if len(p.letters) == 10:
            for d in range(10):
                holders = [ch for ch in p.letters if d in dom[ch]]
                if not holders:
                    raise Contradiction
                if len(holders) == 1 and len(dom[holders[0]]) > 1:
                    for other in sorted(dom[holders[0]] - {d}):
                        remove(holders[0], other, "hidden")
                    changed = True


def _product(lists):
    if not lists:
        yield ()
        return
    for head in lists[0]:
        for tail in _product(lists[1:]):
            yield (head,) + tail


def solve_like_player(p: Puzzle, solution: dict) -> dict:
    dom = {ch: set(range(10)) for ch in p.letters}
    log: list = []
    for ch in sorted(p.leading):
        dom[ch].discard(0)
        log.append(("leading", ch, 0))
    probes = 0
    guesses = 0
    while True:
        propagate(p, dom, log)
        open_letters = [ch for ch in p.letters if len(dom[ch]) > 1]
        if not open_letters:
            break
        open_letters.sort(key=lambda ch: (len(dom[ch]), ch))
        progressed = False
        for ch in open_letters:
            for v in sorted(dom[ch]):
                trial = {k: set(s) for k, s in dom.items()}
                trial[ch] = {v}
                probes += 1
                try:
                    propagate(p, trial, None)
                except Contradiction:
                    dom[ch].discard(v)
                    log.append(("probe", ch, v))
                    progressed = True
            if progressed:
                break
        if not progressed:
            ch = open_letters[0]
            guesses += 1
            for v in sorted(dom[ch] - {solution[ch]}):
                dom[ch].discard(v)
                log.append(("guess", ch, v))
    assert all(next(iter(dom[ch])) == solution[ch] for ch in p.letters)
    kinds: dict[str, int] = defaultdict(int)
    for kind, _, _ in log:
        kinds[kind] += 1
    circles = len(p.letters)
    marks_a = sum(kinds[k] for k in ("leading", "column", "hidden", "probe", "guess"))
    marks_b = marks_a + kinds["alldiff"]
    # 表を全部埋めた上限（使う文字の行 × 10列から ◯ を除く）
    marks_full = len(p.letters) * 9

    def taps(marks: int, order: str) -> dict:
        if order == "circle-first":  # 空白→◯→×→空白
            return {"circle_sound": circles + marks, "cross_sound": marks,
                    "taps": circles + 2 * marks}
        return {"circle_sound": circles, "cross_sound": circles + marks,
                "taps": 2 * circles + marks}  # 空白→×→◯→空白

    return {
        "puzzle": p.label(),
        "letters": len(p.letters),
        "removals_by_kind": dict(kinds),
        "probes": probes,
        "guesses": guesses,
        "circles": circles,
        "marks_model_a": marks_a,
        "marks_model_b": marks_b,
        "marks_full_table": marks_full,
        "circle_first_a": taps(marks_a, "circle-first"),
        "cross_first_a": taps(marks_a, "cross-first"),
        "circle_first_b": taps(marks_b, "circle-first"),
        "cross_first_b": taps(marks_b, "cross-first"),
    }


LETTER_POOL = "ABCDEFGHIJKLMNOPRSTUWXYZ"


def random_puzzle(rng: random.Random, widths: list[int], result_width: int,
                  letters: int) -> tuple[Puzzle, dict] | None:
    nums = [rng.randrange(10 ** (w - 1), 10 ** w) for w in widths]
    total = sum(nums)
    if len(str(total)) != result_width:
        return None
    digits = sorted(set("".join(map(str, nums + [total]))))
    if len(digits) != letters:
        return None
    names = rng.sample(LETTER_POOL, len(digits))
    mapping = dict(zip(digits, names))
    words = ["".join(mapping[c] for c in str(n)) for n in nums]
    result = "".join(mapping[c] for c in str(total))
    p = Puzzle(words, result)
    count, sol = count_solutions(p)
    if count != 1:
        return None
    return p, sol


def frequency() -> dict:
    samples = [
        ("見本", Puzzle(["EG", "GG"], "EAC")),
        ("図L1", Puzzle(["WFX", "TFM"], "CMMW")),
        ("図L5", Puzzle(["MFMEN", "DNEBM", "PBNEE"], "MALMRP")),
    ]
    results = []
    for name, p in samples:
        count, sol = count_solutions(p)
        assert count == 1, (name, count)
        r = solve_like_player(p, sol)
        r["source"] = name
        results.append(r)
    rng = random.Random(SEED)
    shapes = {"L1型": ([3, 3], 4, 6), "L5型": ([5, 5, 5], 6, 10)}
    summary = {}
    for shape, (widths, rw, letters) in shapes.items():
        rows = []
        attempts = 0
        while len(rows) < RANDOM_PUZZLES_PER_SHAPE:
            attempts += 1
            made = random_puzzle(rng, widths, rw, letters)
            if made is None:
                continue
            p, sol = made
            rows.append(solve_like_player(p, sol))
        summary[shape] = {
            "puzzles": len(rows),
            "attempts": attempts,
            **{
                key: _stats([r[key] for r in rows])
                for key in ("marks_model_a", "marks_model_b", "guesses")
            },
            **{
                f"{order}_{field}": _stats([r[order][field] for r in rows])
                for order in ("circle_first_a", "cross_first_a")
                for field in ("circle_sound", "cross_sound", "taps")
            },
        }
    return {"samples": results, "random": summary}


def _stats(xs: list[int]) -> dict:
    xs = sorted(xs)
    n = len(xs)
    return {"min": xs[0], "median": xs[n // 2], "p90": xs[int(n * 0.9)], "max": xs[-1]}


def main() -> None:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[5]
    out = {"seed": SEED, "inventory": inventory(root), "frequency": frequency()}
    print(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
