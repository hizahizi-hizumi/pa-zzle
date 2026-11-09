from __future__ import annotations

import subprocess
import tempfile
import unittest
from pathlib import Path

from repository_refs import RepositoryReader


def run(*args: str) -> None:
    subprocess.run(["git", *args], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


class RepositoryRefsTest(unittest.TestCase):
    def test_fetch_main_and_pr_heads_and_detect_moved_ref(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            remote = root / "remote.git"
            seed = root / "seed"
            clone = root / "clone"
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
            reader = RepositoryReader(clone)
            self.assertTrue(reader.fetch_refs(main_sha, [(42, main_sha)]))
            self.assertIsNotNone(reader.dependency_key(main_sha))
            self.assertFalse(reader.fetch_refs(main_sha, [(42, "a" * 40)]))


if __name__ == "__main__":
    unittest.main()
