"""送迎パーキング（shuttle-parking）の問題供給を測る調査コード。

標準ライブラリだけで書き、乱数は文字列の seed で固定する。製品のコードではない。
分類（案F）と生成条件は同じディレクトリの `shuttle-parking_difficulty.py` を import して使い、ここでは変えない。
境目や採否の条件が後で変わっても引き直せるように、候補ごとの特徴（h90・h50・規則の勝率など）を残し、
レベルは `relevel` で今の分類の定義から付け直せる形にする。

サブコマンド:
  collect  --seed S --start I --seconds T --workers W --output F
      候補番号 I から順に問題を作り、案F で測る。候補ごとに1行（JSON Lines、候補番号順）。
      採れた行（レベルが付いた待機枠）には問題と特徴を、採れない候補には時間と理由だけを残す。
      CPU 時間ではなく経過時間 T 秒で打ち切る。続きは --start に「最後の候補番号+1」を渡して同じファイルに足す。
  analyze  --collected F... --target N --output F
      レベルごとの収率、回転・反転・色の付け替えでの重複（E3）、同じ盤面・同じ列の偏り、
      解き味の同じ問題（車の塞ぎ方の関係が同じ）、近い盤面、生成条件の内訳（E2）、自明な問題、
      問題集の大きさ（E4）を出す。--target はレベルごとの件数の案（例 500）。
  expected --seed S --count N --output F
      移植の期待値: 候補番号 0..N-1 の問題と、正規化キー（見た目・解き味）とレベル。

再現:
  collect --seed 988 --start 0 --seconds 560 --workers 4 --output <f>（打ち切りなので候補数は機械で変わる）
  analyze --collected <f> --target 500 --output <g>
  expected --seed 988 --count 40 --extra <Lv3〜5 の候補番号> --output shuttle-parking_supply.expected.json
    （同梱の期待値の --extra は、collect の出力から Lv3〜5 を3問ずつ候補番号の小さい順に選んだもの。
     ファイルの "extra" に書いてある）
"""
from __future__ import annotations

import argparse
import gzip
import importlib.util
import itertools
import json
import os
import random
import statistics
import sys
import time
from collections import Counter, defaultdict
from multiprocessing import Pool

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("shuttle_difficulty", os.path.join(HERE, "shuttle-parking_difficulty.py"))
D = importlib.util.module_from_spec(_spec)
sys.modules["shuttle_difficulty"] = D
_spec.loader.exec_module(D)

CARS = 8

# ---------------------------------------------------------------- 候補を作って測る


def candidate(seed: str, index: int):
    """候補番号ごとに独立の乱数（途中から再開でき、並列でも順が変わらない）。"""
    rng = random.Random(f"shuttle-supply-pool:{seed}:{index}")
    cond = D.draw_supply(rng, CARS)
    problem = D.build(rng, cond)
    return cond, problem


def measure(args):
    seed, index = args
    begun = time.process_time()
    cond, problem = candidate(seed, index)
    k_min = D.minimum_bays(problem)
    rows = []
    if k_min is not None:
        for slack in D.SLACKS:
            bays = k_min + slack
            if min(D.BAYS) <= bays <= max(D.BAYS):
                rows.append(D.analyze_F(problem, bays, k_min, variants=False))
    record = D.f_levels({"rows": rows})
    kept = []
    for row in record["rows"]:
        item = {"bays": row["bays"], "slack": row["slack"], "level": row["F"], "why": row["Fwhy"]}
        if row["F"] is not None:
            game = problem.game(row["bays"])
            item.update({"policies": row["policies"],
                         "head": {k: row["head"][k] for k in ("h90", "h50", "full")},
                         "window": {k: row["window"][k] for k in ("h90", "h50", "full")},
                         "uniform": round(game.win_probability("uniform"), 6),
                         "solutions": game.solution_count()})
        kept.append(item)
    out = {"seed": seed, "index": index, "cond": cond, "kMin": k_min, "rows": kept,
           "seconds": round(time.process_time() - begun, 5)}
    if any(r["level"] is not None for r in kept):
        out["problem"] = problem.to_json()
    return out


def cmd_collect(args):
    deadline = time.time() + args.seconds
    jobs = ((args.seed, i) for i in itertools.count(args.start))
    written = args.start - 1
    with Pool(args.workers) as pool, open(args.output, "a", encoding="utf-8") as out:
        for record in pool.imap(measure, jobs, chunksize=8):
            out.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
            written = record["index"]
            if time.time() > deadline:
                break
        pool.terminate()
    print(json.dumps({"lastIndex": written, "next": written + 1}))


# ---------------------------------------------------------------- 正規化キー

SIDES = ("top", "right", "bottom", "left")


def transforms(size: int):
    """盤面の8通りの回転・反転。マスの写像と、辺の写像。"""
    n = size - 1
    cell_maps = [
        lambda r, c: (r, c), lambda r, c: (c, n - r), lambda r, c: (n - r, n - c), lambda r, c: (n - c, r),
        lambda r, c: (r, n - c), lambda r, c: (n - r, c), lambda r, c: (c, r), lambda r, c: (n - c, n - r),
    ]
    # 辺の写像は、各辺の中点のマスを写して判定する（上の辺 = 行 -1 側）。
    def side_map(f):
        probe = {"top": (-1, n / 2), "bottom": (n + 1, n / 2), "left": (n / 2, -1), "right": (n / 2, n + 1)}
        out = {}
        for side, (r, c) in probe.items():
            rr, cc = f(r, c)
            out[side] = "top" if rr < 0 else "bottom" if rr > n else "left" if cc < 0 else "right"
        return out
    return [(f, side_map(f)) for f in cell_maps]


def car_cells(car: dict):
    r, c, L = car["row"], car["column"], car["length"]
    if car["orientation"] == "horizontal":
        return [(r, c + j) for j in range(L)]
    return [(r + j, c) for j in range(L)]


def color_relabel(spec: dict) -> dict:
    """色を列で最初に現れる順に A, B, … と付け直す（列は全色を含む）。"""
    order = {}
    for c in spec["queue"]:
        order.setdefault(c, chr(65 + len(order)))
    return order


def placements(spec: dict, t, with_color: bool, relabel=None):
    f, sides = t
    cars = []
    for car in spec["vehicles"]:
        cells = sorted(f(r, c) for r, c in car_cells(car))
        tag = (relabel[car["color"]] if relabel else car["color"]) if with_color else ""
        cars.append((cells[0][0], cells[0][1], "h" if cells[0][0] == cells[-1][0] else "v", car["length"], tag))
    return tuple(sorted(cars)), tuple(sorted(sides[s] for s in spec["openings"]))


def visual_key(spec: dict, bays: int | None) -> str:
    """見た目の正規化キー: 回転・反転（8通り）と色の付け替えで同じになる問題を同じにする。
    bays=None なら待機枠の数を含めない（同じ盤面・同じ列の問題）。"""
    relabel = color_relabel(spec)
    queue = "".join(relabel[c] for c in spec["queue"])
    best = min(placements(spec, t, True, relabel) for t in transforms(spec["size"]))
    return json.dumps([spec["size"], best[1], best[0], queue, bays], separators=(",", ":"))


def board_key(spec: dict) -> str:
    """盤面だけのキー（色と列を見ない）: 同じ盤面で列だけ違う問題を見つける。"""
    best = min(placements(spec, t, False) for t in transforms(spec["size"]))
    return json.dumps([spec["size"], best[1], best[0]], separators=(",", ":"))


def structure(spec: dict):
    """解き味を決める量だけを取り出す: 車ごとの（色・定員・開口へ向かう進路ごとの塞ぐ車の集合）。"""
    problem = D.Problem.from_json(spec)
    relabel = color_relabel(spec)
    colors = [relabel[c] for c in problem.colors]
    rays = [[sorted(D.iter_bits(mask)) for mask in sides] for sides in problem.sides]
    return colors, problem.lengths, rays


ABSTRACT_CAP = 5040


def abstract_key(spec: dict, bays: int):
    """解き味の正規化キー: 車の並べ替えで同じになる（色・定員・塞ぎの関係・列・待機枠）を同じにする。
    盤面の形や車の位置が違っても、ゲームの状態の動きは同じになる。色の細分化で分けたあと、
    同じ印の車の並べ替えを全部試して最小の表現を取る（ABSTRACT_CAP 通りを超えたら印の順で打ち切り、印に * を付ける）。"""
    colors, lengths, rays = structure(spec)
    n = len(colors)
    blocked_by = [set() for _ in range(n)]  # i を塞ぐ車
    blocks = [set() for _ in range(n)]      # i が塞ぐ車
    for i in range(n):
        for ray in rays[i]:
            for j in ray:
                blocked_by[i].add(j)
                blocks[j].add(i)
    label = [(colors[i], lengths[i], len(rays[i])) for i in range(n)]
    for _ in range(n):
        new = [(label[i],
                tuple(sorted(tuple(sorted(label[j] for j in ray)) for ray in rays[i])),
                tuple(sorted(label[k] for k in blocks[i]))) for i in range(n)]
        ranks = {v: r for r, v in enumerate(sorted(set(new)))}
        new = [ranks[v] for v in new]
        if len(set(new)) == len(set(label)):
            label = new
            break
        label = new
    groups = defaultdict(list)
    for i in range(n):
        groups[label[i]].append(i)
    ordered = [groups[k] for k in sorted(groups)]
    total = 1
    for g in ordered:
        for m in range(2, len(g) + 1):
            total *= m
    queue = "".join(color_relabel(spec)[c] for c in spec["queue"])

    def encode(order):
        pos = {car: p for p, car in enumerate(order)}
        return tuple((colors[c], lengths[c], tuple(sorted(tuple(sorted(pos[j] for j in ray)) for ray in rays[c])))
                     for c in order)

    if total > ABSTRACT_CAP:
        best = encode([i for g in ordered for i in g])
        flag = "*"
    else:
        best = min(encode([i for part in combo for i in part])
                   for combo in itertools.product(*(itertools.permutations(g) for g in ordered)))
        flag = ""
    return json.dumps([best, queue, bays], separators=(",", ":")) + flag


# ---------------------------------------------------------------- 問題集の書き方（大きさを測る）


def encode_compact(spec: dict, bays: int) -> str:
    """1問を1つの文字列にする案: 盤面の大きさ・開口・待機枠・車（行・列・向き・定員・色）×8・列。"""
    openings = "".join("trbl"[SIDES.index(s)] for s in sorted(spec["openings"], key=SIDES.index))
    cars = "".join(f"{v['row']}{v['column']}{v['orientation'][0]}{v['length']}{v['color']}" for v in spec["vehicles"])
    return f"{spec['size']}{openings}{bays}.{cars}.{''.join(spec['queue'])}"


def pool_bytes(entries) -> dict:
    compact = json.dumps({"levels": {lv: [encode_compact(e["problem"], e["bays"]) for e in es]
                                     for lv, es in entries.items()}}, separators=(",", ":")).encode()
    verbose = json.dumps({"levels": {lv: [{"problem": e["problem"], "bays": e["bays"]} for e in es]
                                     for lv, es in entries.items()}}, separators=(",", ":")).encode()
    seeds = json.dumps({"levels": {lv: [[e["index"], e["bays"]] for e in es] for lv, es in entries.items()}},
                       separators=(",", ":")).encode()
    count = sum(len(es) for es in entries.values())

    def row(data):
        return {"bytes": len(data), "gzip": len(gzip.compress(data, 9)), "bytesPerProblem": round(len(data) / count, 1)}

    return {"problems": count, "compactString": row(compact), "fullJson": row(verbose), "seedOnly": row(seeds)}


def existing_pools(root: str) -> list:
    out = []
    base = os.path.join(root, "frontend", "src", "games")
    for game in sorted(os.listdir(base)):
        path = os.path.join(base, game, "problem", "problem-pool.json")
        if not os.path.exists(path):
            continue
        with open(path, "rb") as handle:
            data = handle.read()
        levels = json.loads(data).get("levels", {})
        count = sum(len(v) for v in levels.values()) if isinstance(levels, dict) else None
        out.append({"game": game, "bytes": len(data), "gzip": len(gzip.compress(data, 9)), "problems": count,
                    "perLevel": {k: len(v) for k, v in levels.items()} if isinstance(levels, dict) else None,
                    "bytesPerProblem": round(len(data) / count, 1) if count else None})
    return out


# ---------------------------------------------------------------- 集計


def load(paths):
    seen = {}
    for path in paths:
        with open(path, encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if line:
                    record = json.loads(line)
                    seen[(record["seed"], record["index"])] = record
    return [seen[k] for k in sorted(seen, key=lambda k: (k[0], k[1]))]


def relevel(record: dict) -> list:
    """保存した特徴から、行ごとのレベルを返す（いまは保存した値をそのまま使う。分類を変えたら、ここで付け直す）。"""
    return [r for r in record["rows"] if r["level"] is not None]


def overlap(a, b) -> int:
    """2つの盤面（8通りの写像の置き方の集合）で、開口が重なる写像のうち、同じ位置・向き・定員の車の数の最大。"""
    best = 0
    base_cars, base_open = a[0]
    for cars, opening in b:
        if opening == base_open:
            best = max(best, len(base_cars & cars))
    return best


def quantiles(values):
    if not values:
        return None
    s = sorted(values)
    return [s[int((len(s) - 1) * q)] for q in (0.1, 0.5, 0.9)]


def cmd_analyze(args):
    records = load(args.collected)
    cpu = sum(r["seconds"] for r in records) / 60
    target = args.target
    rows = []
    for r in records:
        for row in relevel(r):
            rows.append({"record": r, **row})
    by_level = defaultdict(list)
    for row in rows:
        by_level[row["level"]].append(row)

    result = {"candidates": len(records), "cpuMinutes": round(cpu, 2), "target": target,
              "solvable": sum(1 for r in records if r["kMin"] is not None)}
    times = sorted(r["seconds"] for r in records)
    result["secondsPerCandidate"] = {"p50": times[len(times) // 2], "p95": times[int(len(times) * 0.95)],
                                     "max": times[-1]}

    # 同じ候補の2つの行（待機枠だけ違う）が両方採れる数
    two = Counter()
    for r in records:
        lv = sorted(row["level"] for row in relevel(r))
        if len(lv) == 2:
            two[f"{lv[0]}-{lv[1]}"] += 1
    result["sameCandidateTwoRows"] = dict(two)

    levels = {}
    for lv in range(1, 6):
        every = by_level.get(lv, [])
        items = every[: args.stats_limit]  # 重複・内訳は候補番号順の先頭から数える（Lv1 は多いので打ち切る）
        vis = Counter(visual_key(it["record"]["problem"], it["bays"]) for it in items)
        visnb = Counter(visual_key(it["record"]["problem"], None) for it in items)
        boards = Counter(board_key(it["record"]["problem"]) for it in items)
        abstract = Counter(abstract_key(it["record"]["problem"], it["bays"]) for it in items)
        capped = sum(1 for k in abstract if k.endswith("*"))
        cond = {name: dict(Counter(str(it["record"]["cond"][name]) for it in items))
                for name in ("size", "opening", "colors")}
        cond["bays"] = dict(Counter(str(it["bays"]) for it in items))
        cond["slack"] = dict(Counter(str(it["slack"]) for it in items))
        cond["queueLength"] = quantiles([len(it["record"]["problem"]["queue"]) for it in items])
        cond["colorCount"] = dict(Counter(str(len(set(it["record"]["problem"]["queue"]))) for it in items))
        levels[str(lv)] = {
            "rows": len(every), "perCpuMinute": round(len(every) / cpu, 1) if cpu else None,
            "statsOver": len(items),
            "visualDuplicates": len(items) - len(vis), "sameBoardQueueOtherBays": len(items) - len(visnb),
            "sameBoardOtherQueue": len(items) - len(boards),
            "abstractDuplicates": len(items) - len(abstract), "abstractCapped": capped,
            "trivialUniform1": sum(1 for it in items if it["uniform"] >= 1 - 1e-9),
            "uniformWin": quantiles([it["uniform"] for it in items]),
            "solutions": quantiles([it["solutions"] for it in items]),
            "conditions": cond,
        }

    # 候補番号順に採る（同じ候補の2行は、先にレベルの高い方を採り、もう一方は採らない）
    chosen = {lv: [] for lv in range(1, 6)}
    used_vis, used_abs, used_board_queue = set(), set(), set()
    skipped = Counter()
    for r in records:
        rs = sorted(relevel(r), key=lambda row: -row["level"])
        for row in rs:
            lv = row["level"]
            if len(chosen[lv]) >= target:
                continue
            spec = r["problem"]
            bq = visual_key(spec, None)
            if bq in used_board_queue:
                skipped["sameBoardQueue"] += 1
                continue
            vk = visual_key(spec, row["bays"])
            ak = abstract_key(spec, row["bays"])
            if vk in used_vis:
                skipped["visual"] += 1
                continue
            if ak in used_abs:
                skipped["abstract"] += 1
                continue
            used_vis.add(vk)
            used_abs.add(ak)
            used_board_queue.add(bq)
            chosen[lv].append({"index": r["index"], "bays": row["bays"], "problem": spec, "row": row,
                               "seconds": r["seconds"]})
            break
    result["poolSkipped"] = dict(skipped)
    # 件数の上限なしで、同じ重複の除き方で採れる全部（巡回の費用の見積もりに使う）
    chosen_all = {lv: [] for lv in range(1, 6)}
    seen_bq = set()
    for r in records:
        rs = sorted(relevel(r), key=lambda row: -row["level"])
        if rs:
            bq = visual_key(r["problem"], None)
            if bq in seen_bq:
                continue
            seen_bq.add(bq)
            chosen_all[rs[0]["level"]].append({"index": r["index"], "problem": r["problem"]})
    filled = {}
    for lv in range(1, 6):
        es = chosen[lv]
        if es:
            last = es[-1]["index"]
            spent = sum(r["seconds"] for r in records if r["index"] <= last) / 60
        else:
            spent = None
        filled[str(lv)] = {"count": len(es), "cpuMinutesToFill": round(spent, 2) if spent else None,
                           "reached": len(es) >= target}
    result["pool"] = filled

    # 生成条件（盤面の大きさ × 開口）を巡回して採るときの費用: 4つの組がそれぞれ target/4 問に届くまでの CPU 分
    cumulative, total = {}, 0.0
    for r in records:
        total += r["seconds"]
        cumulative[r["index"]] = total / 60
    roundrobin = {}
    for lv in range(1, 6):
        quota = -(-target // 4)
        cells = defaultdict(list)
        for e in chosen_all[lv]:
            cells[(e["problem"]["size"], tuple(sorted(e["problem"]["openings"])))].append(e["index"])
        reached = {f"{k[0]}x{k[0]}:{'+'.join(k[1])}": (cumulative[v[quota - 1]] if len(v) >= quota else None)
                   for k, v in sorted(cells.items())}
        shares = {f"{k[0]}x{k[0]}:{'+'.join(k[1])}": len(v) for k, v in sorted(cells.items())}
        done = None if any(v is None for v in reached.values()) or len(reached) < 4 else max(reached.values())
        roundrobin[str(lv)] = {"quotaPerCell": quota, "available": shares, "cpuMinutesToFill": round(done, 2) if done else None}
    result["roundRobin"] = roundrobin

    # 近い盤面: 同じレベルの採った問題の組で、同じ位置・向き・定員の車が 6台以上・7台以上
    near = {}
    for lv in range(1, 6):
        es = chosen[lv][: args.near_limit]
        variants = []
        for e in es:
            spec = e["problem"]
            vs = []
            for t in transforms(spec["size"]):
                cars, opening = placements(spec, t, False)
                vs.append((frozenset(cars), opening))
            variants.append((spec["size"], vs))
        hist = Counter()
        for i in range(len(variants)):
            for j in range(i + 1, len(variants)):
                if variants[i][0] != variants[j][0]:
                    continue
                hist[overlap(variants[i][1], variants[j][1])] += 1
        pairs = len(variants) * (len(variants) - 1) // 2
        near[str(lv)] = {"problems": len(variants), "pairs": pairs, "sharedCars": dict(sorted(hist.items())),
                         "atLeast6": sum(v for k, v in hist.items() if k >= 6),
                         "atLeast7": sum(v for k, v in hist.items() if k >= 7)}
    result["nearBoards"] = near

    # 列の近さ: 同じレベルで、色を付け直した列が同じ・先頭10人が同じ
    queues = {}
    for lv in range(1, 6):
        qs = []
        for e in chosen[lv]:
            rl = color_relabel(e["problem"])
            qs.append("".join(rl[c] for c in e["problem"]["queue"]))
        queues[str(lv)] = {"sameQueue": len(qs) - len(set(qs)), "samePrefix10": len(qs) - len(set(q[:10] for q in qs))}
    result["queues"] = queues
    result["levels"] = levels
    result["bytes"] = pool_bytes({str(lv): chosen[lv] for lv in range(1, 6)})
    result["existingPools"] = existing_pools(args.root)
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False, indent=1)
        handle.write("\n")


def cmd_expected(args):
    entries = []
    for index in [*range(args.count), *args.extra]:
        record = measure((args.seed, index))
        cond, problem = candidate(args.seed, index)
        spec = problem.to_json()
        rows = []
        for row in record["rows"]:
            rows.append({"bays": row["bays"], "slack": row["slack"], "level": row["level"], "why": row["why"],
                         "visualKey": visual_key(spec, row["bays"]), "abstractKey": abstract_key(spec, row["bays"]),
                         "compact": encode_compact(spec, row["bays"])})
        entries.append({"seed": f"shuttle-supply-pool:{args.seed}:{index}", "conditions": cond, "kMin": record["kMin"],
                        "problem": spec, "boardKey": board_key(spec), "sameBoardQueueKey": visual_key(spec, None),
                        "rows": rows})
    data = {"generator": "shuttle-parking_difficulty.py の draw_supply・build（8台）", "abstractCap": ABSTRACT_CAP,
            "count": args.count, "extra": args.extra,
            "entries": entries}
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False)
        handle.write("\n")


def main():
    parser = argparse.ArgumentParser(description="shuttle-parking supply research")
    sub = parser.add_subparsers(dest="command", required=True)
    c = sub.add_parser("collect")
    c.add_argument("--seed", required=True)
    c.add_argument("--start", type=int, default=0)
    c.add_argument("--seconds", type=float, default=560)
    c.add_argument("--workers", type=int, default=4)
    c.add_argument("--output", required=True)
    a = sub.add_parser("analyze")
    a.add_argument("--collected", nargs="+", required=True)
    a.add_argument("--target", type=int, default=500)
    a.add_argument("--near-limit", type=int, default=600)
    a.add_argument("--stats-limit", type=int, default=2000)
    a.add_argument("--root", default=os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", "..")))
    a.add_argument("--output", required=True)
    e = sub.add_parser("expected")
    e.add_argument("--seed", required=True)
    e.add_argument("--count", type=int, default=40)
    e.add_argument("--extra", type=int, nargs="*", default=[], help="足す候補番号（Lv3〜5 を含めるため）")
    e.add_argument("--output", required=True)
    args = parser.parse_args()
    {"collect": cmd_collect, "analyze": cmd_analyze, "expected": cmd_expected}[args.command](args)


if __name__ == "__main__":
    main()
