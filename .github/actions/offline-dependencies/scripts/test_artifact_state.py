from __future__ import annotations

import io
import os
import unittest
from contextlib import redirect_stdout
from datetime import datetime, timedelta, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from artifact_state import (
    Artifact,
    GitHubClient,
    command_plan,
    decide_plan,
    ensure_capacity,
)


def artifact(name: str, artifact_id: int = 1) -> Artifact:
    now = datetime.now(timezone.utc)
    return Artifact(
        artifact_id=artifact_id,
        name=name,
        created_at=now.isoformat(),
        expires_at=(now + timedelta(days=7)).isoformat(),
        expired=False,
    )


class OfflineDependenciesStateTest(unittest.TestCase):
    def test_missing_shared_artifact_is_rebuilt_by_pr(self) -> None:
        plan = decide_plan(event_name="pull_request", current_key="a" * 64, artifact_exists=False)
        self.assertTrue(plan.build)
        self.assertEqual(plan.retention_days, 90)

    def test_reusable_artifact_never_requires_ref_scan(self) -> None:
        class Client:
            requests: list[str] = []

            def artifacts(self, name: str) -> list[Artifact]:
                self.requests.append(name)
                return [artifact(name)]

        client = Client()
        with TemporaryDirectory() as temp:
            root = Path(temp)
            for path, value in {
                ".github/actions/offline-dependencies/inputs.env": b"test\n",
                "frontend/package.json": b'{"packageManager":"bun@1.2.3"}',
                ".node-version": b"24\n",
                "frontend/bun.lock": b"lock\n",
            }.items():
                file = root / path
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_bytes(value)
            with patch("artifact_state.client_from_environment", return_value=client):
                with patch.dict(os.environ, {"GITHUB_EVENT_NAME": "pull_request"}):
                    with redirect_stdout(io.StringIO()):
                        command_plan(root, enforce_capacity=False)
        self.assertEqual(len(client.requests), 1)

    def test_exact_artifact_filter_is_sent_to_github(self) -> None:
        client = GitHubClient(api_url="https://api.github.com", repository="org/repo", token="test")
        paths: list[str] = []

        def fetch(path: str) -> object:
            paths.append(path)
            return {"artifacts": []}

        with patch.object(client, "_request_json", side_effect=fetch):
            self.assertEqual(client.artifacts("offline-dependencies-a.tar.zst"), [])
        self.assertEqual(paths, ["/repos/org/repo/actions/artifacts?per_page=100&page=1&name=offline-dependencies-a.tar.zst"])

    def test_capacity_is_checked_only_when_materializing(self) -> None:
        existing_keys = {"a" * 64, "b" * 64, "c" * 64}

        class Client:
            deleted: list[int] = []

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

        client = Client()
        with patch("repository_refs.RepositoryReader", Reader):
            ensure_capacity(client, Path.cwd(), "d" * 64, None)
        self.assertEqual(len(client.deleted), 2)


if __name__ == "__main__":
    unittest.main()
