#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Final, Self

ARTIFACT_PREFIX: Final = "offline-dependencies-"
BUN_PACKAGE_PATH: Final = "frontend/package.json"
BUN_VERSION_INPUT: Final = "frontend/package.json#packageManager"
INPUT_PATHS: Final = (
    ".github/actions/offline-dependencies/inputs.env",
    BUN_VERSION_INPUT,
    ".node-version",
    "frontend/bun.lock",
)
MAX_ACTIVE_KEYS: Final = 3
MAIN_RETENTION_DAYS: Final = 7
PR_RETENTION_DAYS: Final = 90
PAGE_SIZE: Final = 100
HTTP_NO_CONTENT: Final = 204
HTTP_NOT_FOUND: Final = 404
ARTIFACT_PATTERN: Final = re.compile(rf"^{re.escape(ARTIFACT_PREFIX)}([0-9a-f]{{64}})\.tar\.zst$")


def compute_key(contents: dict[str, bytes]) -> str:
    digest = hashlib.sha256()
    for path in INPUT_PATHS:
        digest.update(path.encode())
        digest.update(b"\0")
        digest.update(contents[path])
        digest.update(b"\0")
    return digest.hexdigest()


def declared_bun_version(package_json: bytes) -> str | None:
    try:
        package = json.loads(package_json)
    except (ValueError, UnicodeError) as error:
        raise StateError("frontend/package.json is invalid") from error
    if not isinstance(package, dict):
        raise StateError("frontend/package.json must be an object")
    manager = package.get("packageManager")
    if manager is None:
        return None
    if not isinstance(manager, str) or not re.fullmatch(r"bun@[0-9]+\.[0-9]+\.[0-9]+", manager):
        raise StateError("frontend/package.json must specify an exact bun@x.y.z packageManager")
    return manager.removeprefix("bun@")


def bun_version_bytes(package_json: bytes) -> bytes | None:
    version = declared_bun_version(package_json)
    return None if version is None else f"{version}\n".encode()


def read_repository_inputs(repo_root: Path) -> dict[str, bytes]:
    inputs = {path: (repo_root / path).read_bytes() for path in INPUT_PATHS if path != BUN_VERSION_INPUT}
    version = bun_version_bytes((repo_root / BUN_PACKAGE_PATH).read_bytes())
    if version is None:
        raise StateError("frontend/package.json has no packageManager")
    inputs[BUN_VERSION_INPUT] = version
    return inputs


def compute_repository_key(repo_root: Path) -> str:
    return compute_key(read_repository_inputs(repo_root))


def artifact_name(input_key: str) -> str:
    return f"{ARTIFACT_PREFIX}{input_key}.tar.zst"


class StateError(RuntimeError):
    pass


@dataclass(frozen=True)
class Artifact:
    artifact_id: int
    name: str
    created_at: str
    expires_at: str
    expired: bool

    @classmethod
    def from_api(cls, data: object) -> Self:
        if not isinstance(data, dict):
            raise TypeError("artifact response must be an object")
        return cls(
            artifact_id=int(data["id"]),
            name=str(data["name"]),
            created_at=str(data["created_at"]),
            expires_at=str(data["expires_at"]),
            expired=bool(data["expired"]),
        )

    @property
    def input_key(self) -> str | None:
        match = ARTIFACT_PATTERN.fullmatch(self.name)
        return match.group(1) if match else None

    def retention_at_most(self, days: int) -> bool:
        created_at = datetime.fromisoformat(self.created_at.replace("Z", "+00:00"))
        expires_at = datetime.fromisoformat(self.expires_at.replace("Z", "+00:00"))
        return expires_at - created_at <= timedelta(days=days)


@dataclass(frozen=True)
class Plan:
    input_key: str
    build: bool
    reason: str
    retention_days: int


def retention_days_for_event(event_name: str) -> int:
    if event_name == "pull_request":
        return PR_RETENTION_DAYS
    if event_name in {"push", "workflow_dispatch"}:
        return MAIN_RETENTION_DAYS
    raise StateError(f"unsupported event: {event_name}")


def reusable_artifact_exists(artifacts: list[Artifact], name: str, event_name: str) -> bool:
    candidates = [item for item in artifacts if item.name == name and not item.expired]
    if event_name != "push":
        return bool(candidates)
    return any(item.retention_at_most(MAIN_RETENTION_DAYS) for item in candidates)


def latest_live_artifact(artifacts: list[Artifact], name: str) -> Artifact:
    candidates = [item for item in artifacts if item.name == name and not item.expired]
    if not candidates:
        raise StateError(f"Offline Dependencies Artifact not found: {name}")
    return max(candidates, key=lambda item: (item.created_at, item.artifact_id))


def decide_plan(*, event_name: str, current_key: str, artifact_exists: bool) -> Plan:
    if event_name == "workflow_dispatch":
        return Plan(current_key, True, "manual force build", MAIN_RETENTION_DAYS)
    if event_name == "push":
        reason = "reuse existing dependency artifact" if artifact_exists else "main dependency artifact missing or retention exceeds limit"
        return Plan(current_key, not artifact_exists, reason, MAIN_RETENTION_DAYS)
    if event_name == "pull_request":
        reason = "reuse matching dependency artifact" if artifact_exists else "dependency artifact missing"
        return Plan(current_key, not artifact_exists, reason, PR_RETENTION_DAYS)
    raise StateError(f"unsupported event: {event_name}")


class GitHubClient:
    def __init__(self, *, api_url: str, repository: str, token: str) -> None:
        self.api_url = api_url.rstrip("/")
        self.repository = repository
        self.token = token

    def _request_json(self, path: str) -> object:
        request = urllib.request.Request(  # noqa: S310
            f"{self.api_url}{path}",
            headers={
                "Accept": "application/vnd.github+json",
                "Authorization": f"Bearer {self.token}",
                "X-GitHub-Api-Version": "2026-03-10",
            },
        )
        with urllib.request.urlopen(request) as response:  # noqa: S310
            return json.load(response)

    def _delete(self, path: str) -> None:
        request = urllib.request.Request(  # noqa: S310
            f"{self.api_url}{path}",
            method="DELETE",
            headers={
                "Accept": "application/vnd.github+json",
                "Authorization": f"Bearer {self.token}",
                "X-GitHub-Api-Version": "2026-03-10",
            },
        )
        with urllib.request.urlopen(request) as response:  # noqa: S310
            if response.status != HTTP_NO_CONTENT:
                raise StateError(f"unexpected artifact delete status: {response.status}")

    def main_sha(self) -> str:
        data = self._request_json(f"/repos/{self.repository}/branches/main")
        if not isinstance(data, dict) or not isinstance(data.get("commit"), dict):
            raise StateError("main branch response is invalid")
        commit = data["commit"]
        sha = commit.get("sha")
        if not isinstance(sha, str):
            raise StateError("main branch SHA is invalid")
        return sha

    def open_pull_requests(self) -> list[tuple[int, str]]:
        pull_requests: list[tuple[int, str]] = []
        page = 1
        while True:
            data = self._request_json(f"/repos/{self.repository}/pulls?state=open&per_page={PAGE_SIZE}&page={page}")
            if not isinstance(data, list):
                raise StateError("pull request response is invalid")
            for item in data:
                if not isinstance(item, dict) or not isinstance(item.get("head"), dict):
                    raise StateError("pull request item is invalid")
                pull_requests.append((int(item["number"]), str(item["head"]["sha"])))
            if len(data) < PAGE_SIZE:
                return pull_requests
            page += 1

    def artifacts(self, name: str | None = None) -> list[Artifact]:
        artifacts: list[Artifact] = []
        page = 1
        query = f"&name={urllib.parse.quote(name, safe='')}" if name else ""
        while True:
            data = self._request_json(f"/repos/{self.repository}/actions/artifacts?per_page={PAGE_SIZE}&page={page}{query}")
            if not isinstance(data, dict) or not isinstance(data.get("artifacts"), list):
                raise StateError("artifact response is invalid")
            items = data["artifacts"]
            artifacts.extend(Artifact.from_api(item) for item in items)
            if len(items) < PAGE_SIZE:
                return artifacts
            page += 1

    def delete_artifact(self, artifact_id: int) -> None:
        self._delete(f"/repos/{self.repository}/actions/artifacts/{artifact_id}")


def write_output(name: str, value: str) -> None:
    output_path = os.environ.get("GITHUB_OUTPUT")
    if output_path is None:
        print(f"{name}={value}")
        return
    with Path(output_path).open("a", encoding="utf8") as output:
        output.write(f"{name}={value}\n")


def client_from_environment() -> GitHubClient:
    repository = os.environ.get("GITHUB_REPOSITORY")
    token = os.environ.get("GITHUB_TOKEN")
    if not repository or not token:
        raise StateError("GITHUB_REPOSITORY and GITHUB_TOKEN are required")
    return GitHubClient(
        api_url=os.environ.get("GITHUB_API_URL", "https://api.github.com"),
        repository=repository,
        token=token,
    )


def ensure_capacity(client: GitHubClient, repo_root: Path, current_key: str, current_pr_number: int | None) -> None:
    from repository_refs import RepositoryReader

    main_sha = client.main_sha()
    pull_requests = client.open_pull_requests()
    reader = RepositoryReader(repo_root)
    if not reader.fetch_refs(main_sha, pull_requests):
        raise StateError("repository refs changed while checking Offline Dependencies capacity")
    other_keys = {
        key
        for number, sha in [(0, main_sha), *pull_requests]
        if number != current_pr_number
        if (key := reader.dependency_key(sha)) is not None
    }
    artifacts = [item for item in client.artifacts() if not item.expired and item.input_key is not None]
    retained = {item.input_key for item in artifacts if item.input_key in other_keys}
    if client.main_sha() != main_sha or client.open_pull_requests() != pull_requests:
        raise StateError("repository refs changed while checking Offline Dependencies capacity")
    if len(retained) >= MAX_ACTIVE_KEYS:
        raise StateError(
            f"Offline Dependencies capacity exceeded: {len(retained)} of {MAX_ACTIVE_KEYS} active keys already materialized"
        )
    if len({item.input_key for item in artifacts}) >= MAX_ACTIVE_KEYS and current_key not in retained:
        for item in artifacts:
            if item.input_key not in other_keys:
                client.delete_artifact(item.artifact_id)


def command_plan(repo_root: Path, *, enforce_capacity: bool) -> None:
    client = client_from_environment()
    current_key = compute_repository_key(repo_root)
    artifact = artifact_name(current_key)
    event_name = os.environ.get("GITHUB_EVENT_NAME", "")
    existing = reusable_artifact_exists(client.artifacts(artifact), artifact, event_name)
    plan = decide_plan(event_name=event_name, current_key=current_key, artifact_exists=existing)
    if enforce_capacity and plan.build and event_name == "pull_request":
        current_pr = os.environ.get("PR_NUMBER", "")
        ensure_capacity(client, repo_root, current_key, int(current_pr) if current_pr else None)

    print(f"offline-dependencies: key={plan.input_key} build={str(plan.build).lower()} reason={plan.reason}")
    write_output("input-key", plan.input_key)
    write_output("artifact-name", artifact)
    write_output("build", str(plan.build).lower())
    write_output("retention-days", str(plan.retention_days))


def command_resolve(repo_root: Path) -> None:
    client = client_from_environment()
    input_key = compute_repository_key(repo_root)
    artifact = latest_live_artifact(client.artifacts(artifact_name(input_key)), artifact_name(input_key))
    print(f"offline-dependencies: resolved key={input_key} artifact_id={artifact.artifact_id}")
    write_output("input-key", input_key)
    write_output("artifact-id", str(artifact.artifact_id))
    write_output("artifact-name", artifact.name)
    write_output("expires-at", artifact.expires_at)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("bun-version", "key", "plan", "resolve"))
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument("--enforce-capacity", action="store_true")
    args = parser.parse_args()

    try:
        repo_root = args.repo_root.resolve()
        if args.command == "bun-version":
            version = declared_bun_version((repo_root / BUN_PACKAGE_PATH).read_bytes())
            if version is None:
                raise StateError("frontend/package.json has no packageManager")
            print(version)
        elif args.command == "key":
            print(compute_repository_key(repo_root))
        elif args.command == "plan":
            command_plan(repo_root, enforce_capacity=args.enforce_capacity)
        else:
            command_resolve(repo_root)
    except (StateError, OSError, urllib.error.HTTPError, urllib.error.URLError) as error:
        print(f"offline-dependencies: {error}", file=sys.stderr)
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
