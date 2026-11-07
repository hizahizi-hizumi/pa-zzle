#!/usr/bin/env python3
"""Prepare blinded, paired review requests. This does not run an LLM or claim quality."""

from __future__ import annotations

import argparse
import hashlib
import json
import random
from pathlib import Path

SKILLS = Path(__file__).resolve().parents[2]
EXPERTS = ("review-rules", "review-docs", "review-quality")


def loads(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def dump(path: Path, value) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def make_requests(seed: str, repeats: int, domain: str, trial: str, include_candidate: bool) -> tuple[list[dict], list[dict]]:
    cases = []
    for name in EXPERTS:
        if domain not in ("all", name):
            continue
        cases.extend((name, case) for case in loads(SKILLS / name / "evals/cases.json"))

    # A single fixed source version is provided to both groups. No evaluator-only
    # material, score label, or BEFORE/AFTER ID enters the reviewer's payload.
    requests, manifest = [], []
    if include_candidate and domain != "review-quality":
        raise ValueError("candidate is only supported for review-quality")
    candidate_delta = "反証・確信度による採否判断を始める前に、対象コードから成立し得る不具合の候補を、入力・状態遷移・利用者への影響とともに一度洗い出す。この候補一覧は最終的な指摘とは区別し、その後の反証で除外理由または確定根拠を記録する。"
    for name, case in cases:
        for rep in range(repeats):
            for arm in (("baseline", "skill", "candidate-discover-first") if include_candidate else ("baseline", "skill")):
                discriminator = f"{seed}/{trial}/{name}/{case['id']}/{rep}/{arm}"
                token = hashlib.sha256(discriminator.encode()).hexdigest()[:20]
                public = {field: case[field] for field in (
                    "kind", "ref", "target_path", "scope", "contract", "content", "files", "prompt"
                ) if field in case}
                payload = {"task": public, "instruction": "添付の対象だけをレビューし、確定指摘・未確認の疑義・未実施の検証を区別してください。"}
                if arm != "baseline":
                    content = (SKILLS / name / "SKILL.md").read_text(encoding="utf-8")
                    if arm == "candidate-discover-first":
                        needle = "3. 現象と原因を具体的な入力"
                        assert needle in content, "candidate insertion point has changed"
                        content = content.replace(needle, "2a. " + candidate_delta + "\n3. 現象と原因を具体的な入力", 1)
                    payload["skill_instructions"] = content
                    payload["shared_output_contract"] = (SKILLS / "share/review-result.md").read_text(encoding="utf-8")
                requests.append({"run": token, "input": payload})
                manifest.append({"run": token, "case_id": case["id"], "domain": name,
                                 "arm": arm, "replicate": rep, "scoring": case.get("scoring", "primary")})
    rng = random.Random(seed + trial)
    rng.shuffle(requests)
    return requests, manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--seed", required=True)
    parser.add_argument("--trial", default="initial")
    parser.add_argument("--repeats", type=int, default=1)
    parser.add_argument("--domain", choices=("all", *EXPERTS), default="all")
    parser.add_argument("--candidate", action="store_true", help="include discovery-first ablation (review-quality only)")
    args = parser.parse_args()
    if args.repeats < 1 or args.repeats > 10:
        parser.error("--repeats must be 1..10")
    if args.output.exists():
        parser.error("output directory already exists; use a fresh directory")
    requests, manifest = make_requests(args.seed, args.repeats, args.domain, args.trial, args.candidate)
    args.output.mkdir(parents=True)
    (args.output / "reviewer-inputs").mkdir()
    for req in requests:
        dump(args.output / "reviewer-inputs" / (req["run"] + ".json"), req["input"])
    dump(args.output / "run-order.json", [r["run"] for r in requests])
    dump(args.output / "evaluator-only-manifest.json", manifest)
    dump(args.output / "metadata.json", {"trial": args.trial, "repeats": args.repeats,
                                         "domain": args.domain, "candidate": args.candidate, "requests": len(requests),
                                         "notes": "Requires independent LLM execution; no scores are produced by this command."})
    print(f"Prepared {len(requests)} blinded inputs; kept evaluator-only labels separate")


if __name__ == "__main__":
    main()
