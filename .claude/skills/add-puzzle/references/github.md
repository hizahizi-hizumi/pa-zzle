# GitHub の操作

この環境では GraphQL を使う `gh pr *` が 403 で失敗する。GitHub MCP ツール（ToolSearch で `mcp__github__*` をロード）を優先し、無ければ `gh api` の REST を使う。`/pr` Skill は使わない（`gh pr create` と自動 rebase を含むため）。PR 本文の型は `references/implementation.md` の「PR 本文」。

| 操作 | MCP | `gh api` |
|---|---|---|
| PR 作成（オープン） | `create_pull_request`（`draft: false`） | `gh api repos/{owner}/{repo}/pulls -f title=… -f head=<段> -f base=<前段> -F body=@<ファイル>` |
| 段の PR を探す | `list_pull_requests`（`head: <owner>:<段>`, `state: all`） | `gh api 'repos/{owner}/{repo}/pulls?state=all&head={owner}:<段>'` |
| オープンの PR を一覧する | `list_pull_requests`（`state: open`） | `gh api 'repos/{owner}/{repo}/pulls?state=open&per_page=100' --jq '.[] \| "\(.number) \(.head.ref) \(.title)"'` |
| オープンの Issue を探す | `search_issues`（`repo:{owner}/{repo} is:issue is:open <語>`）か `list_issues` | `gh api 'repos/{owner}/{repo}/issues?state=open&per_page=100' --jq '.[] \| select(.pull_request \| not) \| "\(.number) \(.title)"'` |
| 本文の取得・更新 | `pull_request_read`（`get`）・`update_pull_request` | `gh api repos/{owner}/{repo}/pulls/<番号>`・`gh api -X PATCH repos/{owner}/{repo}/pulls/<番号> -F body=@<ファイル>` |
| CI の結果 | `pull_request_read`（`get_check_runs`） | `gh api 'repos/{owner}/{repo}/commits/<段>/check-runs?check_name=quality-gate'` |
| Issue 作成・更新 | `issue_write` | `gh api repos/{owner}/{repo}/issues -f title=… -F body=@<ファイル>` |
| プレビュー URL | ― | 下記 |

プレビュー URL は Workers Builds の check run から取る。PR の無いブランチでも出る。版ごとの `Preview URL` と、ブランチの `Preview Alias URL` がある。

```sh
gh api "repos/{owner}/{repo}/commits/<sha>/check-runs" \
  --jq '.check_runs[] | select(.name | startswith("Workers Builds")) | .output.summary'
```

## 決まり

- PR 本文は「取得 → 書き換え → 更新」で直す。ほかの節を消さない。
- CI は、段を完成させたとき・積み直しの後・人間に知らせる前に確かめる。待ち続けない。実行中（`pending`・`in_progress`）なら他の作業を進め、知らせる前にもう一度確かめる。失敗していれば直す。
- PR 監視・定期確認・スケジュール実行を設定しない。
