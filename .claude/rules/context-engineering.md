---
paths:
  - "CLAUDE.md"
  - "AGENTS.md"
  - "CLAUDE.local.md"
  - ".claude/**/*.md"
  - "docs/**/*.md"
---

# 決まりと手順の置き場所

- テスト・静的検査・Hooks で守らせられる決まりは、それで守らせる
- Hooks で守らせた決まりは、`AGENTS.md`・`CLAUDE.md`・ルールに書かない
- 新しい決まりや手順は、次のうち最初に当てはまるところに置く
  1. 全ファイルの作業で毎セッション要る決まり: `AGENTS.md`・`CLAUDE.md` か、`paths` の無いルール
  2. 特定のパスのファイルを編集するときだけ要る決まり: `paths` のあるルール（`.claude/rules/`）
  3. 特定の作業の手順: スキル（`.claude/skills/<name>/`）
  4. 独立したコンテキストで任せる作業: エージェント（`.claude/agents/<name>.md`）
  5. どのスキルにも属さない横断的な開発の知識: `docs/`
- サブディレクトリに `CLAUDE.md`・`AGENTS.md` を作らず、サブディレクトリに固有の決まりは `paths` のあるルールに書く
- `docs/` に置いた文書は、`AGENTS.md` に読むタイミングを書く
- `docs/` のどの文書に書くかは、`.claude/rules/documents.md` を読んで決める
- `AGENTS.md` と `CLAUDE.md` のどちらに書くかは、`.claude/rules/agents-md.md` を読んで決める
