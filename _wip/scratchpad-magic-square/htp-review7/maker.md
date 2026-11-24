# 魔方陣の遊び方 作る側の見直し（rev3 / 79133cb2）

画像とログの置き場所: `/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/maker/`（以下 `maker/`）。
スクリプト: `maker/home.cjs`（ホームから開いて3タブと全例の手がかりを押す）・`maker/play.cjs`（途中まで遊んでメニューから開く）・`maker/extra.cjs`（手がかりの外の押し方・重なりの計測・クリア・ゴールの飛ばし）。
PC 1280・iPhone 13・iPhone 13＋動きを減らす・幅 320 で実行。ブラウザのエラーは全組み合わせで 0。`bun run test -- src/games/magic-square/ui/MagicSquareHowToPlayDialog …` は 7 ファイル 109 件が通る（`maker/vitest.log`）。

## 違反

1. 基本の形「ルールのタブ／判定の下のわけ」（別のルールで弾かれたわけを言う）と「例の ✓ / ✕ が盤面の印象と食い違わない」に反する: ルール2（盤面にまだ無い数を置けます）の手がかりの最後の手が最初から置いてある14を選ぶので、手がかりを押し終えた姿では「✓ まだ置ける」の札をどれを押しても受け付けられず、小さな揺れだけでわけが出ない（動きを減らす設定では揺れも音も無く何も起きない）。
   - 再現: ルールのタブ → 2つ目の例 → 手がかりどおり「1行4列」→「11」→「1行1列 14」→ ✓ の付いた「6」を押す。
   - 画像: `maker/phone/rule2-step3.png`（押し終えた姿。14 を選んだまま ✓ が並ぶ）・`maker/phone/x-rule2-press-check-after-hints-mid.png`（6 を押した直後。凡例のまま）・`maker/phone-rm/x-rule2-press-check-after-hints.png`。ログ `maker/extra-phone.out` の `rule2 press ✓6`。
   - 同じ原因: メモの例でメモの入れ方のまま置いた数のマス（14）を選んで数を押しても、5つ目のメモと同じ「揺れが小さく分かりにくい」弾かれ方なのにわけが出ない（`maker/phone/x-op3-memo-on-placed-mid.png`）。手がかりの外なので重さは下。
2. 基本の形「重ねる物」（単位の中身を隠さない）と H8 に反する: ルール3の最初から置いてある「14」のマスの ✕ の印が数の字の右上にかかる（字の箱との重なり PC 7.9×6.4px・iPhone 13 5.8×5.6px・幅320 5.8×6.0px）。幅320では「4」の上端が印に隠れる。コードのコメント（`TouchableExample.tsx` の `cellMarkStyle`「中央の数にかからず」）とも食い違う。1桁の「4」のマスでは重ならない。
   - 再現: ルールのタブ → 3つ目の例（最初の姿のまま）。
   - 画像: `maker/crop-w320-rule3-14-mark.png`・`maker/crop-phone-rule3-marks.png`・`maker/crop-pc-rule3-14-mark.png`（元 `maker/w320/rule3-step1.png`・`maker/phone/rules-04.png`・`maker/pc/rule3-initial.png`）。計測 `maker/extra-*.out` の `rule3 overlaps`。

## 不具合（コード・テスト）

3. 基本の形「触れる例／判定と反応」（例の判定と遷移を遊び方の側で書き写さない）から外れる書き写しがある。
   - `ui/MagicSquareHowToPlayDialog/example-board.ts` の `isMagicSquareExampleMemoFull` が `puzzle/rules.ts` の `canToggleMagicSquareMemo` の上限の条件を写して「メモは4つまで」を出すかを決めている。
   - 同じファイルの `lineReasons` が `ui/board/MagicSquareBoard.tsx` の `lineStatusPhrases` の言葉を写している（本番の言葉が変わると例のわけだけ古くなる。テストは両方を文字列で固定しているので気づけはする）。
   - `use-touchable-example.ts` の `enterValue` の受け付けない判定（`input.type === "rejected" || selectedCellIndex === null`）が `play/use-magic-square-play.ts` の `inputValueInPlay` を写している。
   - 再現: コードを読む（画面の不具合ではない）。
4. 3-2 のテストの抜け: 例で受け付けない押し方をしたとき、どの盤面のマスか札が揺れるか（`operationBoard` で振り分ける `boardRejection`）を確かめるテストが無い。例のテストは受け付けない音と言葉だけを見ている（`MagicSquareHowToPlayDialog/*.test.*` に揺れ・`rejection` の検査は無い）。1 のルール2の押し終えた姿で ✓ の札を押したときの振る舞いもテストに無い。
   - 再現: worktree で `grep -ln "shake\|rejection" frontend/src/games/magic-square/ui/MagicSquareHowToPlayDialog/*.test.*` が何も返さない。

## 迷いそうな所で項目が見つかるか（プレイ中のメニューから開いて確かめた）

途中まで遊んだ盤面（`maker/phone/play-06-before-menu.png`: 斜めが 35 で赤・置き直し 1・メモ4つ）から開くと、赤の意味はルールの最初の項目、置き直しが増えたわけは採点の「置き直し」と流れの図、揺れて入らないわけはルール3とメモの項目、くぼんだ数はルール2で見つかる。
- 弱い所: 盤の下の角の数がどちらの斜めの合計か（右下が左上からの斜め・左下が右上からの斜め）は文で言っておらず、ゴールの盤面と操作1の例でマスを選んだときの帯でしか読めない（重さは下。表の書き出しでは「操作1の例」で見せる扱い）。

## 基本の形からの外れ（わけが読めるか）

- ルール2を札ごとの ✓ / ✕ と札の今の状態の凡例（まだ置ける／もう置いてある）にした: 項目の表の根拠に書いてある。ただし 1 の押し終えた姿では「まだ置ける」が今選んでいるマスには置けない姿と並ぶ。
- ルール3の弾かれたわけを `HowToPlayVerdict` の `reason` でなく凡例の場所に入れ替えて出す・印をマスの右上の角に 0.28 倍で置く・印のあるマスの手がかりの枠を外に引く: 根拠に書いてある（2 の重なりは根拠の想定と食い違う）。
- ルール1の対を `stacked` にして盤面ごとに数の札を並べた: 根拠と `figure-boards.ts` のコメントに書いてある。
- 5つ目のメモと最初から置いてある数で、本番に無い言葉を例の下に足した: 根拠に書いてある（GAME-007 の「判定の言葉を添えるのはよい」の範囲）。
- 5×5・6×6 の表のまとまり（`HowToPlayValueTable`）・採点の「待った・盤面を戻す」の減点の無い行・操作の待ったの補足の「置き直しに数えます」: どれも根拠に書いてある。
- メモの例に押せる待ったを置いた（文も手がかりも無い）: 根拠（本番と同じ並び）に書いてある。

## 確かめて問題の無かった所

- 置き場所: 画面は `ui/MagicSquareHowToPlayDialog.tsx`、図・盤面のデータ・例の状態は `ui/MagicSquareHowToPlayDialog/`、遊び方だけの見せ方は本番の部品の任意の props（`region`・`renderCellOverlay`・`renderValueOverlay`・`overlay`）、ホーム・プレイ・`game-guide.tsx` への登録、テストのコロケーション。H7 の文字のクラスはゲームの側に無い。
- ルール・操作・状態の知らせ・数え方と本番の一致: 盤面を戻す（外した数をどれも数える・時間は戻らない・メモも消す）・待った（メモも戻す・例外も効く）・置き直しの例外（`changesMagicSquareLineVerdict`）・速さ（20秒＋空き1つ10秒・2倍で0点）・メニューの3つの操作と「…」の見た目（`maker/phone/play-07-menu.png`）。本番に Esc とキー操作は無く、遊び方にも無い。
- 動き: 開くたびにルールのタブとゴールの再生から始まる（`maker/pc/play-13-reopen.png`）・途中で盤面を押すと最後の姿へ飛ぶ・タブを戻しても触った例と選んだマスを保つ（`maker/phone/rules-back-01.png`）・動きを減らす設定ではゴールを動かさずに見せる（`maker/phone-rm/goal-0900.png`）・操作1の例のクリア演出（`maker/phone/x-op1-clear-400.png`）と解き終えた後は押しても選ばない。
- 盤面の大きさ: 例と流れの図のマスはどの幅でも互いに同じ大きさで、ゴールのマスと見比べて同じ物に見える（iPhone 13 は例 46.8px・ゴール 45px、PC は例 64.8px・ゴール 85px、幅320 は例 41px・ゴール 36px）。横のはみ出しは 0。
