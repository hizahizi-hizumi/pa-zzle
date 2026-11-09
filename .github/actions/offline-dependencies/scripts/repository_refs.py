from __future__ import annotations

import subprocess
from pathlib import Path

from artifact_state import BUN_PACKAGE_PATH, BUN_VERSION_INPUT, INPUT_PATHS, bun_version_bytes, compute_key


def git(repo_root: Path, *args: str) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(
        ["git", "-C", str(repo_root), *args],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )


class RepositoryReader:
    def __init__(self, repo_root: Path) -> None:
        self.repo_root = repo_root

    def ref_sha(self, ref: str) -> str:
        result = git(self.repo_root, "rev-parse", ref)
        if result.returncode:
            raise RuntimeError(result.stderr.decode(errors="replace"))
        return result.stdout.decode().strip()

    def head_sha(self) -> str:
        return self.ref_sha("HEAD")

    def fetch_refs(self, main_sha: str, pull_requests: list[tuple[int, str]]) -> bool:
        refs = ["+refs/heads/main:refs/remotes/maintenance/main"]
        refs.extend(
            f"+refs/pull/{number}/head:refs/remotes/maintenance/pr-{number}"
            for number, _ in pull_requests
        )
        result = git(self.repo_root, "fetch", "--no-tags", "--depth=1", "origin", *refs)
        if result.returncode:
            raise RuntimeError(result.stderr.decode(errors="replace"))
        if self.ref_sha("refs/remotes/maintenance/main") != main_sha:
            return False
        return all(
            self.ref_sha(f"refs/remotes/maintenance/pr-{number}") == expected_sha
            for number, expected_sha in pull_requests
        )

    def dependency_key(self, sha: str) -> str | None:
        contents: dict[str, bytes] = {}
        for path in INPUT_PATHS:
            source = BUN_PACKAGE_PATH if path == BUN_VERSION_INPUT else path
            result = git(self.repo_root, "show", f"{sha}:{source}")
            if result.returncode:
                return None
            value = bun_version_bytes(result.stdout) if path == BUN_VERSION_INPUT else result.stdout
            if value is None:
                return None
            contents[path] = value
        return compute_key(contents)
