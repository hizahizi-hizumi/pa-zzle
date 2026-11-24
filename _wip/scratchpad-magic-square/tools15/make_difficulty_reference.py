"""Trim magic_square_difficulty.expected.json into the product test fixture."""
import json
import sys

src, dst = sys.argv[1], sys.argv[2]
d = json.load(open(src))


def fnv(s: str) -> str:
    h = 0x811C9DC5
    for ch in s:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"


def compact(x):
    return json.dumps(x, separators=(",", ":"), ensure_ascii=False)


parts = list(d["agree_variants"].keys())
FEATURE_KEYS = list(d["cases"][0]["features"].keys())


def lv(x):
    return "-" if x is None else str(x)


cases = []
for c in d["cases"]:
    assert all(s["values"] == [c["solution"][x] for x in s["cells"]] for s in c["read"]["steps"])
    steps = [[s["tier"], s["sweeps"], s["cells"], s["found"], s["kinds"], s["lock"], s["combos"], s["chain"]]
             for s in c["read"]["steps"]]
    v = c["variants"]
    item = {
        "id": c["id"],
        "size": c["n"],
        "maxTier": c["T"],
        "addBack": c["k"],
        "solution": c["solution"],
        "givens": c["givens"],
        "removalOrder": c["reduce"]["removal_order"],
        "kept": c["reduce"]["kept"],
        "reduceReadCount": c["reduce"]["read_calls"],
        "solutionSearchNodes": c["exact"]["nodes"],
        "read": {"status": c["read"]["status"], "steps": steps},
        "features": [c["features"][k] for k in FEATURE_KEYS],
        "tier1Minimal": c["tier1_minimal"],
        "virtualLevel": c["virtual_level"],
        "singleLevel": c["single_level"],
        "band": c["band"],
        "partStepDigests": "".join(fnv(compact([v[p]["status"], v[p]["steps"]]))[:6] for p in parts),
        "partLevels": "".join(lv(v[p]["level"]) for p in parts),
        "level": c["level"],
        "reason": c["reason"],
    }
    if c["n"] == 4:
        item["partVirtualLevels"] = "".join(lv(v[p]["virtual_level"]) for p in parts)
    cb = c["combos"]
    item["combinations"] = None if cb.get("skipped") else {"firstDisagreeing": (cb["bad"][0] if cb["bad"] else None), "checked": cb["checked"]}
    cases.append(item)

out = {
    "parts": parts,
    "combinations": {"count": len(d["agree_combos"]), "digest": fnv(",".join(d["agree_combos"]))},
    "featureKeys": FEATURE_KEYS,
    "cases": cases,
}
lines = ["{"]
lines.append(f'  "parts": {compact(out["parts"])},')
lines.append(f'  "combinations": {compact(out["combinations"])},')
lines.append(f'  "featureKeys": {compact(out["featureKeys"])},')
lines.append('  "cases": [')
for i, c in enumerate(cases):
    lines.append("    " + compact(c) + ("," if i + 1 < len(cases) else ""))
lines.append("  ]")
lines.append("}")
open(dst, "w").write("\n".join(lines) + "\n")
print(len("\n".join(lines)))
