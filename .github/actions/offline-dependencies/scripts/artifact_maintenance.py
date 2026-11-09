#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
import urllib.error
from pathlib import Path

from artifact_state import Artifact, GitHubClient, client_from_environment
from repository_refs import RepositoryReader

SNAPSHOT_PATTERN = re.compile(
    r"^repository-(?:snapshot-(main|pr-[0-9]+)-([0-9a-f]{40})\.zip|bundle-(main|pr-[0-9]+)-([0-9a-f]{40})\.bundle|environment-(main|pr-[0-9]+)-([0-9a-f]{40})\.json)$"
)


def obsolete_ids(
    artifacts: list[Artifact],
    *,
    active_targets: dict[str, str],
    active_keys: set[str],
) -> list[int]:
    ids: list[int] = []
    for artifact in artifacts:
        if artifact.expired:
            continue
        snapshot = SNAPSHOT_PATTERN.fullmatch(artifact.name)
        if snapshot is not None:
            groups = snapshot.groups()
            target, sha = next((groups[i], groups[i + 1]) for i in (0, 2, 4) if groups[i] is not None)
            if active_targets.get(target) != sha:
                ids.append(artifact.artifact_id)
        elif (key := artifact.input_key) is not None and key not in active_keys:
            ids.append(artifact.artifact_id)
    return sorted(ids)


def maintain(client: GitHubClient, reader: RepositoryReader) -> None:
    main_sha = client.main_sha()
    pull_requests = client.open_pull_requests()
    if reader.head_sha() != main_sha or not reader.fetch_refs(main_sha, pull_requests):
        print("Artifact Maintenance: refs moved during fetch; skip deletion")
        return

    active_targets = {"main": main_sha}
    active_targets.update({f"pr-{number}": sha for number, sha in pull_requests})
    active_keys: set[str] = set()
    for sha in set(active_targets.values()):
        key = reader.dependency_key(sha)
        if key is not None:
            active_keys.add(key)

    artifacts = client.artifacts()
    if client.main_sha() != main_sha or client.open_pull_requests() != pull_requests:
        print("Artifact Maintenance: refs changed during scan; skip deletion")
        return

    ids = obsolete_ids(artifacts, active_targets=active_targets, active_keys=active_keys)
    print(f"Artifact Maintenance: active_refs={len(active_targets)} active_keys={len(active_keys)} obsolete={len(ids)}")
    for artifact_id in ids:
        try:
            client.delete_artifact(artifact_id)
        except urllib.error.HTTPError as error:
            if error.code != 404:
                raise
        print(f"Artifact Maintenance: deleted {artifact_id}")


if __name__ == "__main__":
    try:
        maintain(client_from_environment(), RepositoryReader(Path.cwd()))
    except (OSError, RuntimeError, urllib.error.URLError) as error:
        print(f"Artifact Maintenance: {error}", file=sys.stderr)
        raise SystemExit(1) from error
