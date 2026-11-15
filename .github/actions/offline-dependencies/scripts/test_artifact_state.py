from __future__ import annotations

import io
import os
from contextlib import redirect_stdout
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import pytest

from artifact_state import Artifact, GitHubClient, command_plan, decide_plan, ensure_capacity


def artifact(name: str, artifact_id: int = 1) -> Artifact:
    now = datetime.now(timezone.utc)
    return Artifact(
        artifact_id=artifact_id,
        name=name,
        created_at=now.isoformat(),
        expires_at=(now + timedelta(days=7)).isoformat(),
        expired=False,
    )


@pytest.fixture
def reusable_artifact_repository(tmp_path: Path) -> Path:
    for path, value in {
        ".github/actions/offline-dependencies/inputs.env": b"test\n",
        "frontend/package.json": b'{"packageManager":"bun@1.2.3"}',
        ".node-version": b"24\n",
        "frontend/bun.lock": b"lock\n",
    }.items():
        file = tmp_path / path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(value)
    return tmp_path


@pytest.fixture
def reusable_artifact_client():
    class Client:
        def __init__(self) -> None:
            self.requests: list[str] = []

        def artifacts(self, name: str) -> list[Artifact]:
            self.requests.append(name)
            return [artifact(name)]

    return Client()


@pytest.fixture
def filtered_artifact_client():
    client = GitHubClient(api_url="https://api.github.com", repository="org/repo", token="test")
    paths: list[str] = []

    def fetch(path: str) -> object:
        paths.append(path)
        return {"artifacts": []}

    with patch.object(client, "_request_json", side_effect=fetch):
        yield client, paths


@pytest.fixture
def capacity_client(monkeypatch: pytest.MonkeyPatch):
    existing_keys = {"a" * 64, "b" * 64, "c" * 64}

    class Client:
        def __init__(self) -> None:
            self.deleted: list[int] = []

        def delete_artifact(self, artifact_id: int) -> None:
            self.deleted.append(artifact_id)

        def main_sha(self) -> str:
            return "a" * 40

        def open_pull_requests(self) -> list[tuple[int, str]]:
            return []

        def artifacts(self) -> list[Artifact]:
            return [artifact(f"offline-dependencies-{key}.tar.zst") for key in existing_keys]

    class Reader:
        def __init__(self, root: Path) -> None:
            pass

        def fetch_refs(self, main_sha: str, prs: list[tuple[int, str]]) -> bool:
            return True

        def dependency_key(self, sha: str) -> str | None:
            return "a" * 64

    monkeypatch.setattr("repository_refs.RepositoryReader", Reader)
    return Client()


def test_共有依存アーティファクトが無ければPRで再生成すること():
    plan = decide_plan(event_name="pull_request", current_key="a" * 64, artifact_exists=False)

    assert plan.build
    assert plan.retention_days == 90


def test_再利用できるアーティファクトがあれば参照一覧を調べないこと(
    reusable_artifact_repository: Path, reusable_artifact_client
):
    with (
        patch("artifact_state.client_from_environment", return_value=reusable_artifact_client),
        patch.dict(os.environ, {"GITHUB_EVENT_NAME": "pull_request"}),
        redirect_stdout(io.StringIO()),
    ):
        command_plan(reusable_artifact_repository, enforce_capacity=False)

    assert len(reusable_artifact_client.requests) == 1


def test_GitHubへアーティファクト名の完全一致フィルタを送ること(filtered_artifact_client):
    client, paths = filtered_artifact_client

    artifacts = client.artifacts("offline-dependencies-a.tar.zst")

    assert artifacts == []
    assert paths == ["/repos/org/repo/actions/artifacts?per_page=100&page=1&name=offline-dependencies-a.tar.zst"]


def test_新規アーティファクトの作成時だけ容量を調整すること(capacity_client):
    ensure_capacity(capacity_client, Path.cwd(), "d" * 64, None)

    assert len(capacity_client.deleted) == 2
