from __future__ import annotations

import subprocess
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

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


class ArtifactMaintenanceTest(unittest.TestCase):
    def test_only_unreferenced_artifacts_are_deleted(self) -> None:
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
        actual = obsolete_ids(
            artifacts,
            active_targets={"main": main, "pr-42": pr},
            active_keys={key},
        )
        self.assertEqual(actual, [2, 4, 6])

    def test_missing_ref_skips_deletion(self) -> None:
        class FakeClient:
            def main_sha(self) -> str:
                return "a" * 40

            def open_pull_requests(self) -> list[tuple[int, str]]:
                return [(7, "b" * 40)]

            def artifacts(self) -> list[Artifact]:
                self_outer.fail("must not query artifacts after ref mismatch")

        class FakeReader:
            def head_sha(self) -> str:
                return "a" * 40

            def fetch_refs(self, main_sha: str, pull_requests: list[tuple[int, str]]) -> bool:
                return False

        self_outer = self
        maintain(FakeClient(), FakeReader())  # type: ignore[arg-type]

    def test_dependency_key_matches_checked_out_repository(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for path, value in {
                ".github/actions/offline-dependencies/inputs.env": "SOURCE=fixture\n",
                "frontend/package.json": '{"packageManager":"bun@1.2.3"}',
                ".node-version": "24\n",
                "frontend/bun.lock": "lock contents",
            }.items():
                target = root / path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(value)
            for args in (
                ("init", "-q"),
                ("add", "."),
                ("-c", "user.email=test@example.com", "-c", "user.name=test", "commit", "-qm", "fixture"),
            ):
                subprocess.run(["git", "-C", str(root), *args], check=True)
            reader = RepositoryReader(root)
            self.assertEqual(reader.dependency_key(reader.head_sha()), compute_repository_key(root))


if __name__ == "__main__":
    unittest.main()
