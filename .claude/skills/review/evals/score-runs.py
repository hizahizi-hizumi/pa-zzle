#!/usr/bin/env python3
"""Freeze raw model outputs and report completeness; findings require manual adjudication."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--experiment", type=Path, required=True)
    parser.add_argument("--results", type=Path, required=True,
                        help="Directory with <run>.txt raw independent reviewer outputs")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("output already exists; raw results must never be overwritten")
    entries = json.loads((args.experiment / "evaluator-only-manifest.json").read_text())
    out = []
    for entry in entries:
        raw = args.results / f"{entry['run']}.txt"
        if raw.exists():
            content = raw.read_bytes()
            out.append({**entry, "status": "received", "sha256": hashlib.sha256(content).hexdigest(),
                        "bytes": len(content)})
        else:
            out.append({**entry, "status": "missing", "sha256": None, "bytes": None})
    args.output.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    received = sum(r["status"] == "received" for r in out)
    print(f"Raw outputs frozen: {received}/{len(out)}; TP/FP/FN require independent adjudication")


if __name__ == "__main__":
    main()
