---
paths:
  - "frontend/src/**/*.{ts,tsx,css}"
  - "frontend/scripts/dependency-rules*.ts"
  - "frontend/biome.json"
---

# アプリコードの責務と配置

- 所有者は規則・状態・不変条件・変更理由・公開契約で決める。
- 具体ゲーム・共通ゲーム契約・Page・View・親専用子は `game-structure.md`・`pages.md`・`views.md`・`typescript-react.md` の該当する規則に従う。
- `app/game-integration/` は具体ゲームの登録とプレイ・記録・結果・遷移への接続を所有する。
- `app/game-home/` は各ゲームのホーム画面の合成と専用UIを所有する。
- `app/navigation/` は具体ゲームの登録情報を必要としないURL・遷移の契約を所有する。
- `app/shell/` はアプリ全体の外枠と場面に応じたBGMの選択・接続を所有する。
- `features/records/` はプレイの記録・試行・自己ベストの保存と計算を所有する。
- `features/zukan/` は問題別の進捗・閲覧・絞り込みを所有する。
- `features/collection/` はゲーム横断の集計・推移を所有する。
- `features/random-play/` は出題条件と候補の選択を所有する。
- `features/settings/` は設定UIとゲームの並び順を所有する。
- `components/` は複数の画面・ゲームで意味と操作を共有するUIを所有する。
- `lib/` は機能固有の意味を知らない技術基盤を所有する。
- `lib/audio/` は音声の取得・復号・再生・音量保持を所有する。
- `lib/app-launch.ts` は共有起動ランタイムの限定例外として、タイトルの読み込み進捗・開始・終了・購読を所有する。
- 領域をまたぐ参照は `frontend/scripts/dependency-rules.ts` で公開したモジュールと依存方向に従う。
- 新しい責務は所有範囲・公開契約・依存方向を定めてから階層を選ぶ。
- トップレベルの新領域を設ける判断は `docs/adr/` に記録する。
- 新しい責務ディレクトリは `frontend/scripts/dependency-rules.ts` に登録し、許可・禁止のBiome CLIテストを通してからコードを置く。
