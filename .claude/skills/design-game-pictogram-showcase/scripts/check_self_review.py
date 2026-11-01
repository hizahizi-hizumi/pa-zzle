#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

COMMON_CHECKS = (
    "observed_hero_play_full_cycle",
    "observed_key_moments_zoomed",
    "observed_list_selected_static",
    "observed_light_and_dark",
    "observed_reduced_motion_static",
    "aim_a_play_readable",
    "aim_b_payoff_visible",
    "aim_c_selection_response_emerges",
    "aim_d_calm_first_impression",
    "static_is_same_puzzle_as_base",
    "static_colors_match_play_screen",
    "static_readable_at_list_size",
    "light_and_dark_both_hold",
    "delayed_start_has_no_static_flash",
    "motion_smooth_no_stutter",
    "parts_stay_attached",
    "no_unintended_overlap_or_overflow",
    "transform_and_clip_are_natural",
    "no_broken_transient_frame",
    "dual_instance_ok",
    "no_pageerror",
    "no_unexpected_console_error",
    "no_obvious_unfinished_artifact",
)
# Each playback form adds its own end / hold / seam checks; the other forms' checks are unknown.
PLAYBACK_CHECKS = {
    "once": ("once_end_matches_static",),
    "cut": ("cut_hold_matches_static", "cut_switch_is_instant"),
    "seam": ("seam_matches_static",),
}
VALID_RESULTS = {"pass", "reject"}


def required_checks(playback: str) -> tuple[str, ...]:
    return (*COMMON_CHECKS, *PLAYBACK_CHECKS[playback])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate the self-review gate before showcase pictograms are shown to a human."
    )
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--self-review", required=True, type=Path)
    return parser.parse_args()


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{path}: root must be an object")
    return value


def manifest_candidate_playbacks(manifest: dict[str, Any]) -> dict[str, str]:
    candidates = manifest.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        raise ValueError("manifest candidates must be a non-empty array")

    playbacks: dict[str, str] = {}
    for index, candidate in enumerate(candidates):
        if not isinstance(candidate, dict):
            raise ValueError(f"candidate[{index}] must be an object")
        candidate_id = candidate.get("id")
        if not isinstance(candidate_id, str) or not candidate_id.strip():
            raise ValueError(f"candidate[{index}].id must be a non-empty string")
        playback = candidate.get("playback")
        if playback not in PLAYBACK_CHECKS:
            raise ValueError(f"{candidate_id}: playback must be once, cut, or seam")
        playbacks[candidate_id] = playback
    return playbacks


def validate_candidate_review(candidate_id: str, playback: str, review: Any) -> list[str]:
    if not isinstance(review, dict):
        return [f"{candidate_id}: review must be an object"]

    errors: list[str] = []
    result = review.get("result")
    checks = review.get("checks")

    if result not in VALID_RESULTS:
        errors.append(f"{candidate_id}: result must be pass or reject")
    if not isinstance(checks, dict):
        return [*errors, f"{candidate_id}: checks must be an object"]

    required = required_checks(playback)
    for check_name in required:
        value = checks.get(check_name)
        if not isinstance(value, bool):
            errors.append(f"{candidate_id}: {check_name} must be boolean")

    unknown_checks = sorted(set(checks) - set(required))
    for check_name in unknown_checks:
        errors.append(f"{candidate_id}: unknown check: {check_name}")

    if result == "pass":
        failed_checks = [name for name in required if checks.get(name) is not True]
        if failed_checks:
            errors.append(
                f"{candidate_id}: pass requires every check to be true: {', '.join(failed_checks)}"
            )

    return errors


def validate(manifest: dict[str, Any], self_review: dict[str, Any]) -> list[str]:
    playbacks = manifest_candidate_playbacks(manifest)
    candidate_ids = list(playbacks)
    reviews = self_review.get("candidates")
    if not isinstance(reviews, dict):
        return ["self-review candidates must be an object"]

    errors: list[str] = []
    for candidate_id in candidate_ids:
        if candidate_id not in reviews:
            errors.append(f"{candidate_id}: self-review is missing")
            continue
        errors.extend(
            validate_candidate_review(candidate_id, playbacks[candidate_id], reviews[candidate_id])
        )

    unknown_ids = sorted(set(reviews) - set(candidate_ids))
    for candidate_id in unknown_ids:
        errors.append(f"unknown candidate in self-review: {candidate_id}")

    return errors


def main() -> int:
    args = parse_args()
    try:
        manifest = load_json(args.manifest)
        self_review = load_json(args.self_review)
        errors = validate(manifest, self_review)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        return 1

    if errors:
        for error in errors:
            print(f"FAIL: {error}", file=sys.stderr)
        return 1

    reviews = self_review["candidates"]
    passed = sum(review["result"] == "pass" for review in reviews.values())
    rejected = sum(review["result"] == "reject" for review in reviews.values())
    print(f"PASS: self-review complete ({passed} pass, {rejected} reject)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
