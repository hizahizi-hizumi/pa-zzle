from __future__ import annotations

import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from artifact_maintenance import RepositoryReader, maintain, obsolete_ids
from artifact_state import Artifact, compute_repository_key


def make_artifact(artifact_id: int, name: str) -> Artifact:
    now = datetime.now(timezone.utc)
    return Artifact(
        artifact_id=artifact_id,
        name=name,
        created_at=now.isoformat(),
        expires_at=(now + timedelta(days=30)).isoformat(),
        expired=False,
    )


@pytest.fixture
def artifact_set() -> tuple[list[Artifact], str, str, str]:
    main = "a" * 40
    old = "b" * 40
    pr = "c" * 40
    key = "d" * 64
    unused = "e" * 64
    artifacts = [
        make_artifact(1, f"repository-snapshot-main-{main}.zip"),
        make_artifact(2, f"repository-bundle-main-{old}.bundle"),
        make_artifact(3, f"repository-environment-pr-42-{pr}.json"),
        make_artifact(4, f"repository-snapshot-pr-41-{pr}.zip"),
        make_artifact(5, f"offline-dependencies-{key}.tar.zst"),
        make_artifact(6, f"offline-dependencies-{unused}.tar.zst"),
        make_artifact(7, "unrelated-artifact.zip"),
        make_artifact(8, f"offline-dependencies-{key}.tar.zst"),
    ]
    return artifacts, main, pr, key


@pytest.fixture
def mismatched_refs():
    class FakeClient:
        def __init__(self) -> None:
            self.queried = False

        def main_sha(self) -> str:
            return "a" * 40

        def open_pull_requests(self) -> list[tuple[int, str]]:
            return [(7, "b" * 40)]

        def artifacts(self) -> list[Artifact]:
            self.queried = True
            raise AssertionError("must not query artifacts after ref mismatch")

    class FakeReader:
        def head_sha(self) -> str:
            return "a" * 40

        def fetch_refs(self, main_sha: str, pull_requests: list[tuple[int, str]]) -> bool:
            return False

    return FakeClient(), FakeReader()


@pytest.fixture
def committed_repository(tmp_path: Path) -> Path:
    for path, value in {
        ".github/actions/offline-dependencies/inputs.env": "SOURCE=fixture\n",
        "frontend/package.json": '{"packageManager":"bun@1.2.3"}',
        ".node-version": "24\n",
        "frontend/bun.lock": "lock contents",
    }.items():
        target = tmp_path / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(value)
    for args in (
        ("init", "-q"),
        ("add", "."),
        ("-c", "user.email=test@example.com", "-c", "user.name=test", "commit", "-qm", "fixture"),
    ):
        subprocess.run(["git", "-C", str(tmp_path), *args], check=True)
    return tmp_path


def test_参照されないアーティファクトだけを削除対象にすること(artifact_set):
    artifacts, main, pr, key = artifact_set

    actual = obsolete_ids(artifacts, active_targets={"main": main, "pr-42": pr}, active_keys={key})

    assert actual == [2, 4, 6]


def test_参照が一致しなければ削除を行わないこと(mismatched_refs):
    client, reader = mismatched_refs

    maintain(client, reader)  # type: ignore[arg-type]

    assert not client.queried


def test_依存キーを検証済みの作業リポジトリから生成すること(committed_repository: Path):
    reader = RepositoryReader(committed_repository)
    key = reader.dependency_key(reader.head_sha())
    expected = compute_repository_key(committed_repository)

    assert key == expected
