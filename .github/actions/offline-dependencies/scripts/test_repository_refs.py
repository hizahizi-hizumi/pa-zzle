from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from repository_refs import RepositoryReader


def run(*args: str) -> None:
    subprocess.run(["git", *args], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


@pytest.fixture
def local_repository(tmp_path: Path) -> tuple[Path, str]:
    remote = tmp_path / "remote.git"
    seed = tmp_path / "seed"
    clone = tmp_path / "clone"
    run("init", "--bare", "-q", str(remote))
    run("init", "-q", str(seed))
    run("-C", str(seed), "config", "user.email", "test@example.com")
    run("-C", str(seed), "config", "user.name", "test")
    for path, contents in {
        ".github/actions/offline-dependencies/inputs.env": "SOURCE=fixture\n",
        "frontend/package.json": '{"packageManager":"bun@1.2.3"}',
        ".node-version": "24\n",
        "frontend/bun.lock": "lock contents",
    }.items():
        target = seed / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(contents)
    run("-C", str(seed), "add", ".")
    run("-C", str(seed), "commit", "-qm", "initial")
    run("-C", str(seed), "branch", "-M", "main")
    run("-C", str(seed), "remote", "add", "origin", str(remote))
    run("-C", str(seed), "push", "origin", "main")
    main_sha = subprocess.check_output(["git", "-C", str(seed), "rev-parse", "HEAD"], text=True).strip()
    run("-C", str(seed), "push", "origin", "main:refs/pull/42/head")
    run("clone", "-q", "-b", "main", str(remote), str(clone))
    return clone, main_sha


def test_mainとPRの参照を取得し変更された参照を検出すること(local_repository: tuple[Path, str]):
    clone, main_sha = local_repository
    reader = RepositoryReader(clone)

    fetched = reader.fetch_refs(main_sha, [(42, main_sha)])
    key = reader.dependency_key(main_sha)
    stale = reader.fetch_refs(main_sha, [(42, "a" * 40)])

    assert fetched
    assert key is not None
    assert not stale
