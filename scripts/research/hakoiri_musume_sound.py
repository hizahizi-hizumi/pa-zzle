"""箱入り娘 調査: 音。

1. 既存ゲームの効果音（frontend/src/**/*.flac）の本数・合計バイト数・長さを測る。
   長さは FLAC の STREAMINFO（総サンプル数 / 標本化周波数）から求める。標準ライブラリだけで読む。
2. 箱入り娘で「なぞって駒がマスを移るたびに鳴らす」案の回数を見積もる。
   例題2つ（合意の易しい例・横刀立馬）を BFS で最短に解き、各手で駒が通るマス数
   （その駒の到達可能グラフでの最短距離）と、曲がった回数を数える。
   乱数は使わない（BFS の展開順は固定）。最短解は人が遊ぶ手より短いので、回数は下限の目安。

使い方: python3 scripts/research/hakoiri_musume_sound.py [リポジトリのルート]
"""

import json
import os
import struct
import sys
from collections import deque

W, H = 4, 5

EXAMPLES = {
    "易しい例（最短13手）": ["bAAc", "bAAc", "d..f", "dEEf", "g..h"],
    "横刀立馬（最短81手）": ["bAAc", "bAAc", "dEEf", "dghf", "i..j"],
}


# ---- 1. FLAC の目録 ----

def flac_info(path):
    with open(path, "rb") as f:
        data = f.read()
    if data[:4] != b"fLaC":
        raise ValueError(path)
    pos = 4
    info = None
    blocks = []
    while True:
        header = data[pos]
        last = header & 0x80
        btype = header & 0x7F
        length = int.from_bytes(data[pos + 1:pos + 4], "big")
        blocks.append(btype)
        if btype == 0:
            b = data[pos + 4:pos + 4 + length]
            x = int.from_bytes(b[10:18], "big")
            rate = x >> 44
            channels = ((x >> 41) & 0x7) + 1
            bits = ((x >> 36) & 0x1F) + 1
            samples = x & 0xFFFFFFFFF
            info = {"rate": rate, "channels": channels, "bits": bits,
                    "seconds": samples / rate if rate else 0.0}
        pos += 4 + length
        if last:
            break
    info["bytes"] = len(data)
    info["has_padding"] = 1 in blocks
    return info


def inventory(root):
    src = os.path.join(root, "frontend", "src")
    groups = {}
    for dirpath, _, files in os.walk(src):
        for name in sorted(files):
            if not name.endswith(".flac"):
                continue
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(path, src)
            parts = rel.split(os.sep)
            group = parts[1] if parts[0] == "games" else "（アプリ共通）" + parts[0]
            groups.setdefault(group, []).append((name, flac_info(path)))
    return groups


# ---- 2. 1マスごとに鳴らす案の回数 ----

def parse(rows):
    cells = {}
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch != ".":
                cells.setdefault(ch, []).append((r, c))
    ps = []
    for k, v in sorted(cells.items()):
        rs = [a for a, _ in v]
        cs = [b for _, b in v]
        ps.append((max(rs) - min(rs) + 1, max(cs) - min(cs) + 1, min(rs), min(cs)))
    return tuple(ps)


def key(ps):
    g = ["."] * (W * H)
    for h, w, r, c in ps:
        t = {(2, 2): "A", (2, 1): "V", (1, 2): "H", (1, 1): "s"}[(h, w)]
        for i in range(h):
            for j in range(w):
                g[(r + i) * W + c + j] = t
    return "".join(g)


def occ(ps, skip):
    o = set()
    for i, (h, w, r, c) in enumerate(ps):
        if i != skip:
            for a in range(h):
                for b in range(w):
                    o.add((r + a, c + b))
    return o


def reach(ps, i):
    """駒 i が1手で行ける位置と、そこまでの最短の通り道（位置の列）。"""
    h, w, r, c = ps[i]
    o = occ(ps, i)
    par = {(r, c): None}
    q = deque([(r, c)])
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if (ny, nx) in par or ny < 0 or nx < 0 or ny + h > H or nx + w > W:
                continue
            if any((ny + a, nx + b) in o for a in range(h) for b in range(w)):
                continue
            par[(ny, nx)] = (y, x)
            q.append((ny, nx))
    return par


def moves(ps):
    for i in range(len(ps)):
        h, w, r, c = ps[i]
        for pos in reach(ps, i):
            if pos != (r, c):
                n = list(ps)
                n[i] = (h, w) + pos
                yield i, tuple(n)


def goal(ps):
    return any(h == 2 and w == 2 and r == 3 and c == 1 for h, w, r, c in ps)


def solve(rows):
    start = parse(rows)
    par = {key(start): None}
    states = {key(start): start}
    q = deque([start])
    while q:
        p = q.popleft()
        if goal(p):
            path = []
            k = key(p)
            while k is not None:
                path.append(states[k])
                k = par[k][0] if par[k] else None
            return path[::-1], len(par)
        kp = key(p)
        for _, n in moves(p):
            kn = key(n)
            if kn not in par:
                par[kn] = (kp,)
                states[kn] = n
                q.append(n)
    return None, len(par)


def step_stats(path):
    per_move = []
    for a, b in zip(path, path[1:]):
        i = next(j for j in range(len(a)) if a[j] != b[j])
        par = reach(a, i)
        cells = []
        pos = b[i][2:]
        while pos is not None:
            cells.append(pos)
            pos = par[pos]
        cells = cells[::-1]
        steps = len(cells) - 1
        dirs = [(q[0] - p[0], q[1] - p[1]) for p, q in zip(cells, cells[1:])]
        turns = sum(1 for d, e in zip(dirs, dirs[1:]) if d != e)
        per_move.append((steps, turns))
    return per_move


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..")
    groups = inventory(root)
    out = {"inventory": {}, "steps": {}}
    print("== 既存の効果音（frontend/src/**/*.flac） ==")
    print(f"{'グループ':<22}{'本数':>4}{'合計KB':>9}{'最長秒':>8}  形式")
    total_n = total_b = 0
    game_rows = []
    for g in sorted(groups):
        files = groups[g]
        n = len(files)
        b = sum(i["bytes"] for _, i in files)
        longest = max(i["seconds"] for _, i in files)
        fmts = sorted({f"{i['channels']}ch/{i['bits']}bit/{i['rate']}Hz" for _, i in files})
        pad = sum(1 for _, i in files if i["has_padding"])
        total_n += n
        total_b += b
        if not g.startswith("（"):
            game_rows.append((g, n, b))
        print(f"{g:<22}{n:>4}{b / 1000:>9.1f}{longest:>8.2f}  {','.join(fmts)} PADDING:{pad}")
        out["inventory"][g] = {
            "count": n, "bytes": b,
            "files": {name: {"bytes": i["bytes"], "seconds": round(i["seconds"], 3)} for name, i in files},
        }
    print(f"{'合計':<22}{total_n:>4}{total_b / 1000:>9.1f}")
    ns = sorted(r[1] for r in game_rows)
    bs = sorted(r[2] for r in game_rows)
    med = lambda xs: (xs[(len(xs) - 1) // 2] + xs[len(xs) // 2]) / 2
    print(f"ゲームごと: {len(game_rows)}本のゲーム, 本数 {ns[0]}〜{ns[-1]}（中央値 {med(ns)}）, "
          f"合計 {bs[0] / 1000:.1f}〜{bs[-1] / 1000:.1f}KB（中央値 {med(bs) / 1000:.1f}KB）")
    out["summary"] = {"total_count": total_n, "total_bytes": total_b,
                      "game_count_range": [ns[0], ns[-1]], "game_bytes_range": [bs[0], bs[-1]]}

    print()
    print("== 1マスごとに鳴らす案の回数（最短解） ==")
    for name, rows in EXAMPLES.items():
        path, explored = solve(rows)
        st = step_stats(path)
        steps = [s for s, _ in st]
        turns = [t for _, t in st]
        hist = {}
        for s in steps:
            hist[s] = hist.get(s, 0) + 1
        print(f"{name}: 手数 {len(st)}, マスを移る回数 合計 {sum(steps)}（1手あたり平均 {sum(steps) / len(st):.2f}, 最大 {max(steps)}）, "
              f"曲がった手 {sum(1 for t in turns if t)}, 1手のマス数の分布 {dict(sorted(hist.items()))}, 探索した局面 {explored}")
        out["steps"][name] = {"moves": len(st), "cell_steps": sum(steps), "max_steps": max(steps),
                              "turning_moves": sum(1 for t in turns if t), "histogram": dict(sorted(hist.items()))}
    if "--json" in sys.argv:
        print(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
