#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
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
INPUT_PATHS: Final = (
    ".github/actions/offline-dependencies/inputs.env",
    ".bun-version",
    "frontend/bun.lock",
    "tools/semantic-lint/bun.lock",
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


def read_repository_inputs(repo_root: Path) -> dict[str, bytes]:
    return {path: (repo_root / path).read_bytes() for path in INPUT_PATHS}


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
    artifact_name: str
    build: bool
    reason: str
    active_keys: tuple[str, ...]
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


def decide_plan(
    *,
    event_name: str,
    current_key: str,
    base_key: str | None,
    artifact_exists: bool,
    active_keys: set[str],
    retained_active_keys: set[str],
) -> Plan:
    requested_keys = active_keys | {current_key}
    dependency_changed = base_key != current_key
    retention_days = retention_days_for_event(event_name)

    if event_name == "workflow_dispatch":
        return Plan(
            input_key=current_key,
            artifact_name=artifact_name(current_key),
            build=True,
            reason="manual force build",
            active_keys=tuple(sorted(requested_keys)),
            retention_days=retention_days,
        )

    if event_name == "push":
        return Plan(
            input_key=current_key,
            artifact_name=artifact_name(current_key),
            build=not artifact_exists,
            reason=(
                "main dependency artifact missing or retention exceeds limit"
                if not artifact_exists
                else "reuse existing dependency artifact"
            ),
            active_keys=tuple(sorted(requested_keys)),
            retention_days=retention_days,
        )

    if not dependency_changed:
        if not artifact_exists:
            raise StateError(
                "Offline Dependencies Artifact for the current main dependency key is missing. "
                "This PR does not change dependency inputs, so it will not rebuild the shared main artifact. "
                "Run Repository Snapshot manually on main first."
            )
        return Plan(
            input_key=current_key,
            artifact_name=artifact_name(current_key),
            build=False,
            reason="dependency inputs unchanged; reuse main artifact",
            active_keys=tuple(sorted(requested_keys)),
            retention_days=retention_days,
        )

    if artifact_exists:
        return Plan(
            input_key=current_key,
            artifact_name=artifact_name(current_key),
            build=False,
            reason="reuse matching PR dependency artifact",
            active_keys=tuple(sorted(requested_keys)),
            retention_days=retention_days,
        )

    if len(retained_active_keys) >= MAX_ACTIVE_KEYS:
        raise StateError(
            "Offline Dependencies Artifact capacity exceeded. "
            f"The repository keeps at most {MAX_ACTIVE_KEYS} materialized dependency sets "
            "for current main and open PRs. "
            "Merge, update, or close one of the dependency-changing PRs before creating another dependency set."
        )

    return Plan(
        input_key=current_key,
        artifact_name=artifact_name(current_key),
        build=True,
        reason="PR dependency artifact missing",
        active_keys=tuple(sorted(requested_keys)),
        retention_days=retention_days,
    )


def deletion_ids(artifacts: list[Artifact], active_keys: set[str], *, inactive_only: bool) -> list[int]:
    grouped: dict[str, list[Artifact]] = {}
    deletion: list[int] = []

    for artifact in artifacts:
        input_key = artifact.input_key
        if input_key is None or artifact.expired:
            continue
        if input_key not in active_keys:
            deletion.append(artifact.artifact_id)
            continue
        grouped.setdefault(input_key, []).append(artifact)

    if inactive_only:
        return sorted(deletion)

    for items in grouped.values():
        newest = max(items, key=lambda item: (item.created_at, item.artifact_id))
        deletion.extend(item.artifact_id for item in items if item.artifact_id != newest.artifact_id)
    return sorted(deletion)


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

    def ref_key(self, ref: str) -> str | None:
        contents: dict[str, bytes] = {}
        for path in INPUT_PATHS:
            encoded_path = urllib.parse.quote(path, safe="/")
            encoded_ref = urllib.parse.quote(ref, safe="")
            try:
                data = self._request_json(f"/repos/{self.repository}/contents/{encoded_path}?ref={encoded_ref}")
            except urllib.error.HTTPError as error:
                if error.code == HTTP_NOT_FOUND:
                    return None
                raise
            if not isinstance(data, dict) or data.get("encoding") != "base64":
                raise StateError(f"unexpected content response for {path} at {ref}")
            raw_content = data.get("content")
            if not isinstance(raw_content, str):
                raise StateError(f"content is missing for {path} at {ref}")
            contents[path] = base64.b64decode(raw_content)
        return compute_key(contents)

    def artifacts(self) -> list[Artifact]:
        artifacts: list[Artifact] = []
        page = 1
        while True:
            data = self._request_json(f"/repos/{self.repository}/actions/artifacts?per_page={PAGE_SIZE}&page={page}")
            if not isinstance(data, dict) or not isinstance(data.get("artifacts"), list):
                raise StateError("artifact response is invalid")
            items = data["artifacts"]
            artifacts.extend(Artifact.from_api(item) for item in items)
            if len(items) < PAGE_SIZE:
                return artifacts
            page += 1

    def delete_artifact(self, artifact_id: int) -> None:
        self._delete(f"/repos/{self.repository}/actions/artifacts/{artifact_id}")


def active_keys(
    client: GitHubClient,
    *,
    current_pr_number: int | None = None,
    current_key: str | None = None,
    exclude_current_pr: bool = False,
) -> set[str]:
    keys: set[str] = set()
    main_key = client.ref_key(client.main_sha())
    if main_key is not None:
        keys.add(main_key)

    for pr_number, head_sha in client.open_pull_requests():
        if pr_number == current_pr_number:
            if exclude_current_pr:
                continue
            if current_key is not None:
                keys.add(current_key)
                continue
        pr_key = client.ref_key(head_sha)
        if pr_key is not None:
            keys.add(pr_key)
    return keys


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


def command_plan(repo_root: Path) -> None:
    client = client_from_environment()
    event_name = os.environ.get("GITHUB_EVENT_NAME", "")
    current_pr_raw = os.environ.get("PR_NUMBER", "")
    current_pr_number = int(current_pr_raw) if current_pr_raw else None
    current_key = compute_repository_key(repo_root)
    artifact = artifact_name(current_key)
    artifacts = client.artifacts()
    existing = reusable_artifact_exists(artifacts, artifact, event_name)

    base_key: str | None = None
    if event_name == "pull_request":
        base_sha = os.environ.get("PR_BASE_SHA")
        if not base_sha:
            raise StateError("PR_BASE_SHA is required for pull_request")
        base_key = client.ref_key(base_sha)

    other_keys = active_keys(
        client,
        current_pr_number=current_pr_number,
        exclude_current_pr=True,
    )
    retained_keys = {
        item.input_key
        for item in artifacts
        if item.input_key is not None and not item.expired and item.input_key in other_keys
    }
    plan = decide_plan(
        event_name=event_name,
        current_key=current_key,
        base_key=base_key,
        artifact_exists=existing,
        active_keys=other_keys,
        retained_active_keys=retained_keys,
    )

    print(f"offline-dependencies: key={plan.input_key} build={str(plan.build).lower()} reason={plan.reason}")
    print(f"offline-dependencies: active_keys={','.join(plan.active_keys)}")
    write_output("input-key", plan.input_key)
    write_output("artifact-name", plan.artifact_name)
    write_output("build", str(plan.build).lower())
    write_output("active-keys", ",".join(plan.active_keys))
    write_output("retention-days", str(plan.retention_days))


def command_resolve(repo_root: Path) -> None:
    client = client_from_environment()
    input_key = compute_repository_key(repo_root)
    artifact = latest_live_artifact(client.artifacts(), artifact_name(input_key))
    print(f"offline-dependencies: resolved key={input_key} artifact_id={artifact.artifact_id}")
    write_output("input-key", input_key)
    write_output("artifact-id", str(artifact.artifact_id))
    write_output("artifact-name", artifact.name)
    write_output("expires-at", artifact.expires_at)


def command_replace_current(repo_root: Path) -> None:
    client = client_from_environment()
    current_key = compute_repository_key(repo_root)
    for artifact in client.artifacts():
        if artifact.input_key == current_key and not artifact.expired:
            print(f"offline-dependencies: replacing artifact id={artifact.artifact_id}")
            client.delete_artifact(artifact.artifact_id)


def command_prune(repo_root: Path, *, inactive_only: bool) -> None:
    client = client_from_environment()
    current_pr_raw = os.environ.get("PR_NUMBER", "")
    current_pr_number = int(current_pr_raw) if current_pr_raw else None
    current_key = compute_repository_key(repo_root) if current_pr_number is not None else None
    keys = active_keys(
        client,
        current_pr_number=current_pr_number,
        current_key=current_key,
    )
    artifacts = client.artifacts()
    ids = deletion_ids(artifacts, keys, inactive_only=inactive_only)
    for artifact_id in ids:
        print(f"offline-dependencies: deleting artifact id={artifact_id}")
        client.delete_artifact(artifact_id)
    print(f"offline-dependencies: retained active_keys={','.join(sorted(keys))}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("key", "plan", "prune", "replace-current", "resolve"))
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument("--inactive-only", action="store_true")
    args = parser.parse_args()

    try:
        repo_root = args.repo_root.resolve()
        if args.command == "key":
            print(compute_repository_key(repo_root))
        elif args.command == "plan":
            command_plan(repo_root)
        elif args.command == "replace-current":
            command_replace_current(repo_root)
        elif args.command == "resolve":
            command_resolve(repo_root)
        else:
            command_prune(repo_root, inactive_only=args.inactive_only)
    except (StateError, OSError, urllib.error.HTTPError, urllib.error.URLError) as error:
        print(f"offline-dependencies: {error}", file=sys.stderr)
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
