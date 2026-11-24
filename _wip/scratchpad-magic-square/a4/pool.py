import sys, json, multiprocessing as mp
sys.path.insert(0, sys.argv[1])
from common import *

def job(a):
    n, T, k, i = a
    c = m.generate_candidate(n, T, k, i)
    ex = m.count_solutions(m.geo_of(n), c["givens"], limit=2, node_cap=2_000_000)
    lv, f, res = level(n, c["givens"])
    return {"id": c["id"], "n": n, "T": T, "k": k, "givens": c["givens"], "solution": c["solution"],
            "unique": ex["count"] == 1 and not ex["capped"], "level": lv}

if __name__ == "__main__":
    per = int(sys.argv[2])
    jobs = []
    for T in (1, 2): 
        for k in (0, 1, 2):
            jobs += [(4, T, k, i) for i in range(per)]
    for n in (5, 6):
        for T in (2, 3):
            for k in (0, 1, 2, 12):
                jobs += [(n, T, k, i) for i in range(per)]
    m.all_squares4()
    with mp.Pool(4) as p, open(sys.argv[3], "w") as fh:
        for d in p.imap(job, jobs, chunksize=4):
            fh.write(json.dumps(d) + "\n")
