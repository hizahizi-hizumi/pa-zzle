# AmuQuery プロダクト定義

ここはAmuQueryの**現在仕様**を定義する場所です。

要求から実装へ直接飛ばず、次の層で管理します。

```text
user-requirements/
    ↓
system-requirements/
    ↓
user-stories/ + acceptance-criteria/
    ↓
specification/
    ↓
screen-design/ / 実装
```

## ディレクトリ

- `user-requirements/`: 利用者要求・目的・成功状態
- `system-requirements/`: システムが満たす要件
- `specification/`: 現在の具体的な実装契約
- `user-stories/`: 利用者の行動単位
- `acceptance-criteria/`: 完成・公開可能と判定する条件
- `screen-design/`: Webの情報設計・画面仕様
- `gap-analysis/`: 現在実装と要求・要件の差分

各ディレクトリの `README.md` は索引です。本文を1ファイルへ集約しません。

## ファイル命名

各名前空間の `README.md` は索引です。
本文は文書IDそのものをファイル名にします。

```text
RQ-001.md
FR-001.md
NFR-001.md
SPEC-001.md
US-L01.md
AC-001.md
SCR-001.md
G-009.md
```

原則 `1 ID = 1ファイル` です。
