# 魔方陣 難易度の検査（版 8、製品のコード）

`/design-game-difficulty` の入口「新規」（`/add-puzzle` の difficulty・problem-pool の項目）で、調査で決めた版 8 をゲームのコードへ移し（F2）、問題集を作って当てた検査の結果。調査の比較実験で測った検査（A3・A5・B4 など）は、調査の資料 `docs/パズル/導入調査/魔方陣/魔方陣難易度.md` の値を出力元に書いた。

- 計測の場所: ブランチ `magic-square/work`。出力元のコマンドは `bun run --cwd frontend <script>`。
  - `generate:magic-square-pool`: 問題集を作るときの統計（収率・時間・採らなかった理由・レベルごとの特徴）。`-- --verify` で全問の確かめ直し。
  - `analyze:magic-square-difficulty -- reference`: 移植の期待値の 88 候補の全部の突き合わせ。
  - `analyze:magic-square-difficulty -- timing`: 生成条件ごとの1候補の時間と当たるレベル（各 12 候補）。
  - `analyze:magic-square-difficulty -- pool`: 同梱の問題集の全問の特徴・素朴な解き方・試遊に渡す問題。
- 時間は、同じ 4 コアで調査の観点2つ（問題供給・図鑑）が走っている間の壁時計（読み込みの平均 4〜8）。1候補・1問の時間はその分長く出ている。
- 人も AI もまだ遊んでいない。

| 検査 | 結果 | 要点 | 出力元 |
| --- | --- | --- | --- |
