"""The rule-lab screen's copies of the research examples stay equal to the research files."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

RESEARCH = Path(__file__).resolve().parent
RULE_LAB = RESEARCH.parents[1] / "frontend" / "src" / "games" / "parking-jam" / "rule-lab"
SCREEN_FIELDS = ("id", "title", "kind", "bayCount", "solutions", "queue", "board")


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.mark.parametrize(
    ("research_name", "screen_name"),
    [
        ("parking_jam_passenger_examples.json", "passenger-problems.json"),
        ("parking_jam_pair_examples.json", "pair-problems.json"),
    ],
)
def test_screen_examples_match_research(research_name: str, screen_name: str) -> None:
    research = [{field: example[field] for field in SCREEN_FIELDS} for example in load(RESEARCH / research_name)]

    assert load(RULE_LAB / screen_name) == research


def test_screen_rule_lab_cases_match_research() -> None:
    research = load(RESEARCH / "parking_jam_passenger_rule_lab_cases.json")

    assert load(RULE_LAB / "passenger-rule-lab-cases.json") == research
