"""覆面算（fukumenzan）の問題供給の調査コード。

標準ライブラリだけで、次を測る（seed 固定）。レベルの判定は同じディレクトリの fukumenzan_difficulty.py
（版6、採る案 P50nk18w の classify6）を使う。

- unique: 生成条件ごとに、生成器（数字の組を先に選ぶ。digit-set-first v1）が作る候補のうち一意解の割合と、
  1候補の生成＋一意性の確かめの秒。
- fixedn: 文字の数を固定して作ったとき（一意解でなければ同じ文字の数のまま作り直す）の、生成条件×文字の数ごとの
  レベルの収率と1候補の秒。今の生成器は作り直すたびに文字の数を引き直すので、少ない文字に寄る。
- space2: 2つ足し（L1 の盤面）の全ての式を数え上げ、文字の並び（文字の付け替えでそろえたもの）ごとに解の数を数える。
  一意解の並びの数、足す数の並べ替えでそろえた問題の数、--classify なら、そのうち L1 に当たる問題の数。
  L1 に入る問題がそもそも何問あるか（問題集の件数の上限）を出す。
- pool: fukumenzan_difficulty.py supply6 が書いた jsonl（生成＋判定の結果）を読み、レベルごとに
  同じ問題（文字の付け替え・足す数の並べ替えで同じ）の重なり、近い問題（1か所の文字だけ違う）の数、
  生成条件・文字の数の分かれ方、問題集にしたときの大きさ（JSON・gzip）を出す。
- repeat: 問題集の件数と遊んだ回数から、ランダム出題（GAME-002。初期状態は全状態が対象）で次の1問が
  遊んだことのある問題になる確率と、それまでに出た重なりの数を出す（計算）。
- expected: 移植の期待値（同じ問題のキー・近い問題のキー・2つ足しの数え上げの数）。

条件（件数・文字の数・打ち切り）は比較実験の条件で、完成仕様ではない。

使い方（<ルート> はリポジトリのルート）:
  S=<ルート>/docs/パズル/導入調査/覆面算/調査コード/fukumenzan_supply.py
  D=<ルート>/docs/パズル/導入調査/覆面算/調査コード/fukumenzan_difficulty.py
  python3 $S unique --per 300                                        # 一意解の割合（数秒）
  python3 $S fixedn --per 200 --out fixedn.jsonl                     # 文字の数を固定した収率（2並列で約3分）
  python3 $S space2 --lens 3,3 --classify                           # 3+3 の全数（数秒）
  python3 $S space2 --lens 4,3 --classify                           # 4+3 の全数（2並列で約1.5分）
  python3 $S space2 --lens 4,4 --classify                           # 4+4 の全数（数え上げ約2分＋判定。2並列で20分以上）
  python3 $D supply6 --conds 0,1,2,7,8,9 --per 1000 --out s6_small.jsonl
  python3 $D supply6 --conds 10,11 --nrange 7,9 --per 1000 --out s6_big.jsonl
  python3 $D supply6 --conds 7,8,9 --start 1000 --per 4000 --out s6_more.jsonl
  python3 $S pool s6_small.jsonl s6_more.jsonl s6_big.jsonl --per 500   # レベルは f6 から今の案で決め直す。L3 は 3s だけ
  python3 $S repeat
  python3 $S expected --out fukumenzan_supply.expected.json
"""

from __future__ import annotations

import argparse
import gzip
import json
import math
import os
import random
import statistics
import sys
import time
from collections import Counter, defaultdict
from itertools import permutations
from multiprocessing import Pool

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fukumenzan_difficulty as fd  # noqa: E402

UNIQUE_SEED = fd.SEED_BASE + 9_000_000  # unique の seed: UNIQUE_SEED + 条件番号 × 100000 + i

# ---------------------------------------------------------------- 同じ問題・近い問題のキー


def canonical_key(addends: list[str], result: str) -> str:
    """文字の付け替えと足す数の並べ替えで同じ問題を同じキーにする（fukumenzan_difficulty.canonical_key と同じ）。
    一意解の問題では、解の数字の並び（式そのもの）が同じなら文字の並びも同じなので、このキーで「同じ解の問題」もそろう。"""
    return fd.canonical_key(addends, result)


def _relabel(words: list[str]) -> str:
    m: dict[str, str] = {}
    out = []
    for w in words:
        out.append("".join(c if c == "*" else m.setdefault(c, chr(65 + len(m))) for c in w))
    return "+".join(out[:-1]) + "=" + out[-1]


def near_keys(addends: list[str], result: str) -> set[str]:
    """1か所の文字を伏せた並びのキーの集まり。2つの問題がキーを1つでも共有すれば「近い」（1か所の文字だけ違う）。
    足す数の並べ替えは、伏せた後の並びの最小で吸収する。"""
    words = list(addends) + [result]
    keys = set()
    for wi, w in enumerate(words):
        for ci in range(len(w)):
            masked = [x if xi != wi else x[:ci] + "*" + x[ci + 1:] for xi, x in enumerate(words)]
            best = min(_relabel(list(perm) + [masked[-1]]) for perm in permutations(masked[:-1]))
            keys.add(best)
    return keys


def text_of(addends: list[str], result: str) -> str:
    return "+".join(addends) + "=" + result


# ---------------------------------------------------------------- unique


def _unique_task(arg):
    cond_i, i, nr = arg
    seed = UNIQUE_SEED + cond_i * 100000 + i
    rng = random.Random(seed)
    t0 = time.perf_counter()
    g = fd.generate(rng, fd.CONDITIONS[cond_i], nr or fd.n_range_for(fd.CONDITIONS[cond_i]))
    if g is None:
        return {"cond": cond_i, "i": i, "status": "nogen"}
    p, _, _ = g
    u = fd.count_solutions(p, 2) == 1
    return {"cond": cond_i, "i": i, "n": p.n, "unique": u, "t": time.perf_counter() - t0}


def cmd_unique(args):
    """生成器が1回で作る候補のうち一意解の割合。文字の数は既定（n_range_for）、10・11 は 7〜9 に寄せる（supply6 と同じ）。"""
    conds = [int(c) for c in args.conds.split(",")]
    tasks = [(c, i, (7, 9) if c in (10, 11) else None) for c in conds for i in range(args.per)]
    t0 = time.perf_counter()
    with Pool(args.jobs) as pool:
        rows = pool.map(_unique_task, tasks, chunksize=4)
    print(f"{len(tasks)} 候補、{time.perf_counter() - t0:.1f} 秒（{args.jobs} 並列）")
    print("| 条件 | 文字 | 候補 | 一意解 | 割合 | 文字の数ごとの一意解の割合 | 1候補の秒（生成＋確かめ。1コア） |")
    print("|---|---|---|---|---|---|---|")
    out = {}
    for c in conds:
        rs = [r for r in rows if r["cond"] == c and "unique" in r]
        u = sum(r["unique"] for r in rs)
        byn = defaultdict(list)
        for r in rs:
            byn[r["n"]].append(r["unique"])
        nr = (7, 9) if c in (10, 11) else fd.n_range_for(fd.CONDITIONS[c])
        per_n = "・".join(f"{n}:{sum(v) / len(v):.0%}" for n, v in sorted(byn.items()))
        t = statistics.mean(r["t"] for r in rs)
        name = "+".join(map(str, fd.CONDITIONS[c]))
        print(f"| {name} | {nr[0]}〜{nr[1]} | {len(rs)} | {u} | {u / len(rs):.1%} | {per_n} | {t:.4f} |")
        out[name] = {"candidates": len(rs), "unique": u}
    return out


# ---------------------------------------------------------------- fixedn


FIXEDN_SEED = fd.SEED_BASE + 9_500_000  # fixedn の seed: FIXEDN_SEED + 条件番号 × 100000 + 文字の数 × 10000 + i


def _fixedn_task(arg):
    """文字の数を n に固定して1候補を作る（一意解でなければ同じ n のまま 400 回まで作り直す）。今の生成器（supply6）は
    作り直すたびに文字の数を引き直すので、一意解になりやすい少ない文字に寄る。ここではそれを止めたときの収率を測る。"""
    cond_i, n, i = arg
    seed = FIXEDN_SEED + cond_i * 100000 + n * 10000 + i
    rng = random.Random(seed)
    t0 = time.perf_counter()
    tries = 0
    for _ in range(400):
        g = fd.generate(rng, fd.CONDITIONS[cond_i], (n, n))
        if g is None:
            return {"cond": cond_i, "n": n, "i": i, "status": "nogen", "t": time.perf_counter() - t0}
        p, _, _ = g
        tries += 1
        if fd.count_solutions(p, 2) == 1:
            break
    else:
        return {"cond": cond_i, "n": n, "i": i, "status": "nounique", "t": time.perf_counter() - t0}
    t_gen = time.perf_counter() - t0
    c = fd.classify6(p)
    L = c["level"]
    if L == 3 and max(len(w) for w in p.addends) > 4:
        L = None
    return {"cond": cond_i, "n": n, "i": i, "status": "ok", "tries": tries, "level": L, "addends": p.addends, "result": p.result,
            "t_gen": t_gen, "t": time.perf_counter() - t0}


def cmd_fixedn(args):
    cells = []
    for part in args.cells.split(";"):
        c, ns = part.split(":")
        for n in ns.split(","):
            cells.append((int(c), int(n)))
    tasks = [(c, n, i) for c, n in cells for i in range(args.per)]
    t0 = time.perf_counter()
    with Pool(args.jobs) as pool:
        rows = pool.map(_fixedn_task, tasks, chunksize=2)
    print(f"{len(tasks)} 候補、{time.perf_counter() - t0:.1f} 秒（{args.jobs} 並列）")
    print("| 条件 | 文字 | 候補 | 一意解が作れた | 作り直しの平均 | L1 | L2 | L3（3s） | L4 | L5 | 違う問題（レベルに当たったもの） | 1候補の秒（1コア） |")
    print("|---|---|---|---|---|---|---|---|---|---|---|---|")
    out = {}
    for c, n in cells:
        rs = [r for r in rows if r["cond"] == c and r["n"] == n]
        ok = [r for r in rs if r["status"] == "ok"]
        lv = Counter(r["level"] for r in ok)
        keys = {canonical_key(r["addends"], r["result"]) for r in ok if r["level"] is not None}
        tries = statistics.mean(r["tries"] for r in ok) if ok else float("nan")
        t = statistics.mean(r["t"] for r in rs)
        name = "+".join(map(str, fd.CONDITIONS[c]))
        print(f"| {name} | {n} | {len(rs)} | {len(ok)} | {tries:.1f} | " + " | ".join(str(lv[L]) for L in range(1, 6))
              + f" | {len(keys)} | {t:.3f} |")
        out[f"{name}/{n}"] = {"candidates": len(rs), "ok": len(ok), "levels": {str(L): lv[L] for L in range(1, 6)}, "distinct": len(keys),
                              "secPerCandidate": round(t, 4)}
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
    return out


# ---------------------------------------------------------------- space2


def _enumerate2(la: int, lb: int, lo: int, hi: int):
    """la 桁＋lb 桁の全ての式（順序つき）を、文字の並びの整数キーで数える。文字の数 lo〜hi の式だけ。
    値は、その並びの式がちょうど1つなら (a, b)、2つ以上なら None。"""
    seen: dict[int, tuple[int, int] | None] = {}
    total = 0
    for a in range(10 ** (la - 1), 10 ** la):
        sa = str(a)
        for b in range(10 ** (lb - 1), 10 ** lb):
            t = sa + str(b) + str(a + b)
            nd = len(set(t))
            if nd < lo or nd > hi:
                continue
            total += 1
            m: dict[str, int] = {}
            k = 0
            for ch in t:
                v = m.get(ch)
                if v is None:
                    v = len(m)
                    m[ch] = v
                k = k * 10 + v
            k = k * 100 + len(t)
            if k in seen:
                seen[k] = None
            else:
                seen[k] = (a, b)
    return seen, total


def _words_of(a: int, b: int) -> tuple[list[str], str]:
    t = str(a) + "|" + str(b) + "|" + str(a + b)
    m: dict[str, str] = {}
    w = "".join(c if c == "|" else m.setdefault(c, chr(65 + len(m))) for c in t).split("|")
    return w[:2], w[2]


def _classify_task(arg):
    addends, result = arg
    p = fd.Puzzle(addends, result)
    return fd.classify6(p)["level"]


def cmd_space2(args):
    la, lb = (int(x) for x in args.lens.split(","))
    lo, hi = (int(x) for x in args.letters.split(","))
    t0 = time.perf_counter()
    seen, total = _enumerate2(la, lb, lo, hi)
    t_enum = time.perf_counter() - t0
    uniq = [v for v in seen.values() if v is not None]
    problems: dict[str, tuple[list[str], str]] = {}
    for a, b in uniq:
        ad, rs = _words_of(a, b)
        problems.setdefault(canonical_key(ad, rs), (ad, rs))
    byn = Counter(len(set("".join(ad) + rs)) for ad, rs in problems.values())
    byr = Counter(len(rs) for _, rs in problems.values())
    print(f"{la}+{lb}（文字 {lo}〜{hi}）: 式 {total}・文字の並び {len(seen)}・一意解の並び {len(uniq)}"
          f"（{len(uniq) / len(seen):.1%}）・同じ問題をそろえて {len(problems)} 問（{time.perf_counter() - t0:.1f} 秒。数え上げ {t_enum:.1f} 秒）")
    print("  文字の数ごと: " + "・".join(f"{n}文字 {c}" for n, c in sorted(byn.items())))
    print("  答えの桁ごと: " + "・".join(f"{r}桁 {c}" for r, c in sorted(byr.items())))
    out = {"lens": [la, lb], "letters": [lo, hi], "equations": total, "patterns": len(seen), "uniquePatterns": len(uniq),
           "problems": len(problems), "byLetters": {str(n): c for n, c in sorted(byn.items())}}
    if args.classify:
        t1 = time.perf_counter()
        items = sorted(problems.items())
        with Pool(args.jobs) as pool:
            levels = pool.map(_classify_task, [v for _, v in items], chunksize=16)
        lc = Counter(levels)
        l1n = Counter(len(set("".join(ad) + rs)) for (_, (ad, rs)), lv in zip(items, levels) if lv == 1)
        print(f"  レベル（classify6）: " + "・".join(f"L{lv} {c}" for lv, c in sorted(lc.items(), key=lambda x: (x[0] is None, x[0] or 0)))
              + f"（{time.perf_counter() - t1:.1f} 秒、{args.jobs} 並列）")
        print("  L1 の文字の数ごと: " + "・".join(f"{n}文字 {c}" for n, c in sorted(l1n.items())))
        out["levels"] = {("none" if lv is None else str(lv)): c for lv, c in lc.items()}
        out["l1ByLetters"] = {str(n): c for n, c in sorted(l1n.items())}
    return out


# ---------------------------------------------------------------- pool


def level_now(r) -> int | None:
    """supply6 の行のレベルを、行に残った読み手の結果（f6）から今の採る案（level6・SPLIT_CAP6＝2）で決め直す。
    行の level は出力した時点の SPLIT_CAP6 で決まる（s6_big.jsonl は上限3回のときの出力で、3回の問題 59 問を L5 に入れている）。"""
    q = {"k": len(r["addends"]), "n": r["n"], "lens": [len(w) for w in r["addends"]], "f6": r["f6"]}
    return fd.level6(q, fd.ADOPTED_V6)


def load_rows(paths, l3_3s_only=True):
    """レベルに当たった行。L3 は 3s（3つ足しで4桁まで）だけにする（メインの決定。3l の L3 は数えない）。"""
    rows = []
    for path in paths:
        with open(path, encoding="utf-8") as f:
            for line in f:
                r = json.loads(line)
                if "addends" not in r:
                    continue
                r["level"] = level_now(r)
                if r["level"] is None:
                    continue
                if l3_3s_only and r["level"] == 3 and max(len(w) for w in r["addends"]) > 4:
                    continue
                rows.append(r)
    rows.sort(key=lambda r: (r["cond"], r["seed"]))
    return rows


def _interleave(groups: list[list]) -> list:
    longest = max((len(g) for g in groups), default=0)
    return [g[i] for i in range(longest) for g in groups if i < len(g)]


def cmd_pool(args):
    rows = load_rows(args.inputs)
    cand_by_cond: Counter = Counter()
    for path in args.inputs:
        with open(path, encoding="utf-8") as f:
            for line in f:
                cand_by_cond[json.loads(line)["cond"]] += 1
    print(f"候補 {sum(cand_by_cond.values())}（" + "・".join(f"{'+'.join(map(str, fd.CONDITIONS[c]))} {n}" for c, n in sorted(cand_by_cond.items()))
          + f"）、レベルに当たった候補 {len(rows)}")
    seen_global: dict[str, int] = {}
    summary = {}
    print("| L | 当たった候補 | 同じ問題（重なり） | 違う問題 | 近い問題を持つ問題（レベルの中） | 近い組 | 生成条件 | 文字の数 |")
    print("|---|---|---|---|---|---|---|---|")
    picked_by_level = {}
    for L in range(1, 6):
        rs = [r for r in rows if r["level"] == L]
        distinct = []
        dup = 0
        dup_cross = 0
        for r in rs:
            ck = canonical_key(r["addends"], r["result"])
            if ck in seen_global:
                dup += 1
                if seen_global[ck] != L:
                    dup_cross += 1
                continue
            seen_global[ck] = L
            distinct.append(r)
        # 近い問題（1か所の文字だけ違う）
        owners: dict[str, set[int]] = defaultdict(set)
        nk = []
        for i, r in enumerate(distinct):
            ks = near_keys(r["addends"], r["result"])
            nk.append(ks)
            for k in ks:
                owners[k].add(i)
        has_near = 0
        pairs = set()
        for i, ks in enumerate(nk):
            nb = set()
            for k in ks:
                nb |= owners[k]
            nb.discard(i)
            if nb:
                has_near += 1
                for j in nb:
                    pairs.add((min(i, j), max(i, j)))
        conds = Counter("+".join(map(str, fd.CONDITIONS[r["cond"]])) for r in distinct)
        letters = Counter(r["n"] for r in distinct)
        print(f"| {L} | {len(rs)} | {dup}（ほかのレベルと {dup_cross}） | {len(distinct)} | {has_near}（{has_near / max(1, len(distinct)):.1%}） | {len(pairs)} | "
              + "・".join(f"{k} {v}" for k, v in sorted(conds.items())) + " | "
              + "・".join(f"{k}:{v}" for k, v in sorted(letters.items())) + " |")
        # 近い問題を避けて、生成条件を交互に並べて per 問まで採る（採り方の試し）
        taken_keys: set[str] = set()
        by_cond: dict[int, list] = defaultdict(list)
        skipped_near = 0
        for r, ks in zip(distinct, nk):
            if ks & taken_keys:
                skipped_near += 1
                continue
            taken_keys |= ks
            by_cond[r["cond"]].append(r)
        ordered = _interleave([by_cond[c] for c in sorted(by_cond)])[: args.per]
        picked_by_level[L] = ordered
        summary[str(L)] = {"hits": len(rs), "duplicates": dup, "distinct": len(distinct), "withNear": has_near,
                           "nearPairs": len(pairs), "skippedNear": skipped_near, "picked": len(ordered),
                           "conditions": dict(sorted(conds.items())), "letters": {str(k): v for k, v in sorted(letters.items())}}
    print()
    print("近い問題を避けて採ったとき（生成条件を交互に並べ、先に採った問題と近い問題を飛ばす）:")
    print("| L | 違う問題 | 近いので飛ばした | 採れた（上限 per） |")
    print("|---|---|---|---|")
    for L in range(1, 6):
        s = summary[str(L)]
        print(f"| {L} | {s['distinct']} | {s['skippedNear']} | {s['picked']} |")
    # 大きさ
    print()
    print(f"問題集の大きさ（1問 = 式の文字列。各レベル {args.per} 問に足りないレベルは、採れた問題の1問あたりから見積もる）:")
    print("| L | 採れた | 1問の JSON（bytes） | 1問の gzip（bytes。そのレベルだけで圧縮） |")
    print("|---|---|---|---|")
    total_raw = 0
    total_gz = 0
    sizes = {}
    for L in range(1, 6):
        ent = [text_of(r["addends"], r["result"]) for r in picked_by_level[L]]
        if not ent:
            continue
        raw = len(json.dumps(ent, separators=(",", ":")).encode())
        gz = len(gzip.compress(json.dumps(ent, separators=(",", ":")).encode(), 9))
        per_raw, per_gz = raw / len(ent), gz / len(ent)
        total_raw += per_raw * args.per
        total_gz += per_gz * args.per
        sizes[str(L)] = {"rawPerEntry": round(per_raw, 1), "gzipPerEntry": round(per_gz, 1)}
        print(f"| {L} | {len(ent)} | {per_raw:.1f} | {per_gz:.1f} |")
    print(f"各レベル {args.per} 問の見積もり: JSON 約 {total_raw / 1000:.0f} KB・gzip 約 {total_gz / 1000:.0f} KB")
    # 識別子の形の比べ: 式の文字列だけ・解の数字つき
    allent = [r for L in range(1, 6) for r in picked_by_level[L]]
    a = [text_of(r["addends"], r["result"]) for r in allent]
    b = [[text_of(r["addends"], r["result"]), r["n"]] for r in allent]
    for name, ent in (("式の文字列", a), ("式の文字列＋文字の数", b)):
        s = json.dumps(ent, separators=(",", ":")).encode()
        print(f"  形 {name}: 採れた {len(ent)} 問で JSON {len(s)} bytes・gzip {len(gzip.compress(s, 9))} bytes")
    return {"levels": summary, "sizes": sizes, "estimatedJsonKB": round(total_raw / 1000), "estimatedGzipKB": round(total_gz / 1000)}


# ---------------------------------------------------------------- repeat


def repeat_prob(P: int, m: int) -> tuple[float, float]:
    """P 問から m 回、均等に引いたとき（直前の問題を除くのは無視できるほど小さいので入れない）。
    戻り値は（次の1問が遊んだことのある問題になる確率、m 回の中で既に出た問題を引いた回数の期待値）。"""
    q = 1 - (1 - 1 / P) ** m
    distinct = P * q
    return q, m - distinct


def cmd_repeat(args):
    Ps = [200, 300, 500, 1000]
    ms = [10, 30, 50, 100, 200, 500]
    print("ランダム出題（全状態が対象）で、そのレベルを m 回遊んだ後に、次の1問が遊んだことのある問題になる確率（m 回の中の重なりの期待値）")
    print("| 件数 P | " + " | ".join(f"m={m}" for m in ms) + " |")
    print("|---|" + "---|" * len(ms))
    out = {}
    for P in Ps:
        cells = []
        for m in ms:
            q, rep = repeat_prob(P, m)
            cells.append(f"{q:.0%}（{rep:.1f}）")
            out[f"{P}/{m}"] = [round(q, 4), round(rep, 2)]
        print(f"| {P} | " + " | ".join(cells) + " |")
    print()
    print("次の1問が遊んだ問題になる確率を 10% 以下に保てる遊んだ回数 m（= P × ln(1/0.9)）: "
          + "・".join(f"P={P} → {P * math.log(1 / 0.9):.0f} 回" for P in Ps))
    return out


# ---------------------------------------------------------------- expected


EXPECTED_EQ = [
    ("BYK+KTK=TKHH", ["KTK+BYK=TKHH", "ABC+CDC=DCEE", "XYZ+ZWZ=WZPP"]),
    ("NNV+UFN+NTT=NFVT", ["NTT+NNV+UFN=NFVT", "UFN+NTT+NNV=NFVT"]),
    ("DBRPR+UTTDR+UDDP=DDUURJ", ["UTTDR+DBRPR+UDDP=DDUURJ"]),
    ("SEND+MORE=MONEY", []),
]
NEAR_PAIRS = [
    ("BYK+KTK=TKHH", "BYK+KTB=TKHH"),
    ("BYK+KTK=TKHH", "BYK+KTK=TKHB"),
    ("BYK+KTK=TKHH", "NNV+UFN=NFVT"),
]


def _split(text):
    left, result = text.split("=")
    return left.split("+"), result


def cmd_expected(args):
    out = {"version": 1, "difficultyPlan": fd.ADOPTED_V6, "canonical": [], "near": [], "space2": [], "repeat": {}}
    for base, variants in EXPECTED_EQ:
        ad, rs = _split(base)
        ck = canonical_key(ad, rs)
        out["canonical"].append({"text": base, "key": ck, "sameAs": [{"text": v, "key": canonical_key(*_split(v))} for v in variants]})
    for x, y in NEAR_PAIRS:
        kx, ky = near_keys(*_split(x)), near_keys(*_split(y))
        out["near"].append({"a": x, "b": y, "near": bool(kx & ky), "shared": sorted(kx & ky)})
    for lens in ("3,3",):
        ns = argparse.Namespace(lens=lens, letters="5,7", classify=True, jobs=args.jobs)
        out["space2"].append(cmd_space2(ns))
    # 3+3 の L1 を、同じ問題のキーの順に並べ、先に採った問題と近い問題を飛ばして採ったときの数
    seen, _ = _enumerate2(3, 3, 5, 7)
    probs: dict[str, tuple[list[str], str]] = {}
    for v in seen.values():
        if v is not None:
            ad, rs = _words_of(*v)
            probs.setdefault(canonical_key(ad, rs), (ad, rs))
    taken: set[str] = set()
    l1 = kept = 0
    for _, (ad, rs) in sorted(probs.items()):
        if fd.classify6(fd.Puzzle(ad, rs))["level"] != 1:
            continue
        l1 += 1
        ks = near_keys(ad, rs)
        if ks & taken:
            continue
        taken |= ks
        kept += 1
    out["space2"][0]["l1NearFree"] = {"l1": l1, "keptSkippingNear": kept}
    print(f"3+3 の L1 {l1} 問のうち、近い問題を飛ばして採れるのは {kept} 問")
    for P in (300, 500, 1000):
        for m in (50, 100):
            q, rep = repeat_prob(P, m)
            out["repeat"][f"{P}/{m}"] = [round(q, 4), round(rep, 2)]
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"{args.out} に書いた")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("unique")
    a.add_argument("--per", type=int, default=300)
    a.add_argument("--conds", default="0,1,2,7,8,9,10,11")
    a.add_argument("--jobs", type=int, default=4)
    a = sub.add_parser("fixedn")
    a.add_argument("--cells", default="0:5,6,7;1:5,6,7;2:5,6,7;7:5,6,7;8:5,6,7;9:5,6,7",
                   help="条件番号:文字の数,… を ; で区切る")
    a.add_argument("--per", type=int, default=200)
    a.add_argument("--out", default="")
    a.add_argument("--jobs", type=int, default=4)
    a = sub.add_parser("space2")
    a.add_argument("--lens", required=True)
    a.add_argument("--letters", default="5,7")
    a.add_argument("--classify", action="store_true")
    a.add_argument("--jobs", type=int, default=4)
    a = sub.add_parser("pool")
    a.add_argument("inputs", nargs="+")
    a.add_argument("--per", type=int, default=500)
    sub.add_parser("repeat")
    a = sub.add_parser("expected")
    a.add_argument("--out", required=True)
    a.add_argument("--jobs", type=int, default=4)
    args = ap.parse_args()
    {"unique": cmd_unique, "fixedn": cmd_fixedn, "space2": cmd_space2, "pool": cmd_pool, "repeat": cmd_repeat, "expected": cmd_expected}[args.cmd](args)


if __name__ == "__main__":
    main()
