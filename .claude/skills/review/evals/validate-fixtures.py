#!/usr/bin/env python3
"""Validate review evaluation fixtures without making LLM quality claims."""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

SKILLS = Path(__file__).resolve().parents[2]
REPO = SKILLS.parents[1]
EXPERTS = ("review-rules", "review-docs", "review-quality")
SHA = re.compile(r"^[0-9a-f]{40}$")


def load_cases(name: str) -> list[dict]:
    path = SKILLS / name / "evals" / "cases.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(data, list) and data, f"empty/invalid: {path}"
    ids = [case["id"] for case in data]
    assert len(ids) == len(set(ids)), f"duplicate case ID: {path}"
    truth = (SKILLS / name / "evals" / "ground-truth.md").read_text(encoding="utf-8")
    for case in data:
        assert case["prompt"].strip() and SHA.fullmatch(case["ref"]), case["id"]
        if name == "review-quality":
            assert case.get("scoring") in {"primary", "exploratory"}, case["id"]
        assert case["id"] in truth, f"no evaluation key for {case['id']}"
        if case["kind"] == "synthetic":
            assert case.get("target_path") and (case.get("content") or case.get("files")), case["id"]
        elif case["kind"] == "historical":
            assert case.get("scope"), case["id"]
        else:
            raise ValueError(f"unsupported kind: {case['id']}")
    if name == "review-quality":
        primary = {case["id"]: case for case in data if case["scoring"] == "primary"}
        oracle_path = SKILLS / name / "evals" / "oracle-cases.json"
        oracles = json.loads(oracle_path.read_text(encoding="utf-8"))
        assert set(primary) == set(oracles), "every primary case needs a deterministic oracle"
        stems = {id.rsplit("-", 1)[0] for id in primary}
        assert len(stems) >= 3, "quality calibration needs independent bug classes"
        for stem in stems:
            before, after = primary[stem + "-BEFORE"], primary[stem + "-AFTER"]
            for key in ("target_path", "contract", "prompt", "ref"):
                assert before[key] == after[key], (stem, key)
            assert before["content"] != after["content"], stem
            for member in (before, after):
                assert "BEFORE" not in member["prompt"] and "AFTER" not in member["prompt"]
                assert not (REPO / member["target_path"]).exists(), "synthetic source should not overwrite real files"
    print(f"{name}: {len(data)} cases")
    return data


def main() -> None:
    for name in ("review", *EXPERTS):
        path = SKILLS / name / "SKILL.md"
        content = path.read_text(encoding="utf-8")
        assert content.startswith("---\n"), path
        assert re.search(rf"(?m)^name: {re.escape(name)}$", content), path
        assert re.search(r"(?m)^description: >$", content), path
        assert len(content.splitlines()) <= 500, path
        assert (SKILLS / "share" / "review-result.md").exists(), name
        assert "share/review-result.md" in content, name
    all_cases = [case for name in EXPERTS for case in load_cases(name)]
    orchestration = json.loads((SKILLS / "review/evals/orchestration-cases.json").read_text(encoding="utf-8"))
    assert len(orchestration) >= 3
    assert len({case["id"] for case in orchestration}) == len(orchestration)
    truth = (SKILLS / "review/evals/orchestration-ground-truth.md").read_text(encoding="utf-8")
    for case in orchestration:
        assert case["id"] in truth
        assert set(case["specialists"]) == set(EXPERTS), case["id"]
        for name, outcome in case["specialists"].items():
            assert outcome["status"] in ("completed", "not-run"), (case["id"], name)
            if outcome["status"] == "not-run":
                assert outcome.get("reason"), (case["id"], name)
            ids = [finding["id"] for finding in outcome["findings"]]
            assert len(ids) == len(set(ids)), case["id"]
            for finding in outcome["findings"]:
                assert finding["severity"] in ("Critical", "Major", "Minor")
                assert finding["location"] and finding["issue"] and finding["evidence"]
    # Historical refs are pinned. A shallow checkout may not have these commits.
    if (REPO / ".git").exists():
        for case in all_cases:
            if case["kind"] != "historical":
                continue
            commit = case["ref"]
            result = subprocess.run(["git", "cat-file", "-e", f"{commit}^{{commit}}"], cwd=REPO, check=False)
            if result.returncode:
                print(f"note: historical commit {commit[:12]} not in local Git history")
    print(f"orchestration: {len(orchestration)} cases")
    print("fixture structure: OK (LLM precision/recall not measured)")


if __name__ == "__main__":
    main()
