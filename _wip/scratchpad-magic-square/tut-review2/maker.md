# magic-square チュートリアル 作る側の見直し（rev3 `4ad53c69`）

画像の置き場所: `/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/tut-review2/maker/`（以下 `maker/`）

## 大原則の違反

はっきり反している所は見つからなかった。下の不具合1は、一言と盤面が食い違うので P5 に触れる。

## 不具合

### 1. 違う数のヒントが「印の付いたマス」と言うのに、印が出ない（テストも無い）

- 再現: 手を離した後で、(1,1) を選んで 14 を押して外す → (2,2) を選んで 2 を押して外す → (2,2) に 1 を入れる（どの列も空きが2つ以上あるので違反にならない）→「ヒント」を押す。一言は「印の付いたマスの数が違います／そのマスを選んで別の数を押すと入れ直せます」になるが、(2,2) に印が無い。
- 原因: 数を入れた後もそのマスは選ばれたままになる（`selectedCellIndex: fitsStep ? null : cellIndex`）。`getCellCue` はヒントのマスが選ばれていると印を消すが、`findMagicSquareTutorialHint` の `wrong-value` の一言は、選んでいるかどうかで変えていない。違反の一言は選んでいるかどうかで言い分けているのに、ヒントだけ言い分けていない。違う数を入れてすぐにヒントを押すという、いちばん通りやすい道でこうなる。
- テスト: `tutorial.test.ts` の「違う数が入っている場合」は、(3,4) に 15 を入れて作った盤面で確かめている。この盤面は3行目が埋まって違反になるので、画面ではヒントを押せない（`hintRequestable` が偽）。違反にならない違う数が残った盤面と、そのマスを選んだままヒントを押す場合は、tutorial と UI のどちらのテストにも無い。
- 画像: `maker/probe-reduced/14-free-wrong-1-at-2-2-silent.png`、`maker/probe-reduced/15-free-hint-with-silent-wrong.png`

### 2. 該当パズルの仕様が worktree に無い（正本の欠け）

- `docs/プロダクト/パズル/` に魔方陣の仕様が無い。そのため、SKILL.md の動作フロー1と2-3が拠り所にする「段階設計」の難易度1の挑戦を、正本で確かめられない。
- 代わりに、scratchpad の `難易度.md` にある「L1 は 4×4 で1マス空きの列をたどれば解ける」に照らした。さらに本番のレベル1 No.1 を、「空いたマスが1つだけ残った列を埋める」読みだけで8手で解き切れることを確かめた（`maker/solve-l1-end.png`）。読みとテストの中身は、この L1 の読みと合っている。

### 3. （軽い・判断が分かれる）入口の一文が、本番のどの盤面にも当てはまる言い方で「1〜16」と言う

- 入口の一文は「1〜16の数を1つずつマスに入れて／縦・横・斜めの列の合計を全て同じにするパズルです」。5×5 と 6×6 では 1〜25 と 1〜36 になるが、完成の一言で「遊び方」に任せたと伝えているのは合計だけになる。
- レベル1は 4×4 なので、P8 には響かない。P7 の「本番で成り立つことだけを言う」の境目にあたる。
- 画像: `maker/mobile/08-intro.png`、`maker/mobile/89-completed.png`

## 確かめて問題が無かったこと

- 通した設定: 通常（1280×800）、375×667 のタッチ、375×667 のタッチと reduced motion。どれも入口から完成まで通し、ブラウザのエラーは0件だった。ログは `maker/{desktop,mobile,reduced}/summary.txt`。
- 外れた手も試した。
  - 印のある手順の外れた手: 印の無いマス、最初から置いてある数、選ぶ前に押した数、印と違う数。どれも盤面を変えずに印を濃くし直す（例: `maker/mobile/18-op-number-before-select.png`）。
  - ルールを伝える手順で違う数を入れると、本番と同じ違反の表示と、列の名前を言う一言が出る（`maker/mobile/33-row-wrong-15.png`）。
  - 探す手順: 最初から置いてある数のマス、置いた数のマス、まだ決まらないマスの選択と入力、マスを選ばずに押した数。どれにも一言か本番と同じ揺れで応える（`maker/mobile/59〜64`）。
- 手を離した後: マスを選んでも、5秒待っても、手がかりは出ない（`maker/mobile/72-free-idle-5s.png`）。違反がある間は「ヒント」を出さない。直すマスの印と一言の出し分けも合っている（`maker/mobile/76-free-select-other-while-violated.png`）。
- ルールの扱い: 数を置く・置き換える・同じ数で外す操作は、本番と同じ `enterMagicSquareValue` を使う。数の欄の状態は本番と同じ `listMagicSquareValueStates` から作る。列の判定は本番と同じ `listMagicSquareLineEvaluations` を使う。受け付けない押し方では、本番と同じ揺れと音を返す。まだ伝えていない向きの列の違反だけを、そろっていない列として見せる（GAME-010 のとおり）。
- 2-3 の条件: 操作の手がゴールと一致すること、ルール後の各手が伝えたルールで決まること、各ルールが1手以上の決め手になること、考えずに通れないこと、手を離した後に解き切れること、読みがもう一度以上要ること。どれもテストにある。`bun run test -- src/games/magic-square/tutorial src/games/magic-square/ui/MagicSquareTutorial` は 56 件すべて通った。
- 置き場所と共通部品: `tutorial/tutorial.ts`・`ui/MagicSquareTutorial.tsx` に置き、`TutorialOverlay`（stage）と `TutorialCrossFadeIntroScene` を使う。印・合図・覆いは `TutorialCue`（mark・pointer は center・acknowledgement）と `TutorialSpotlight` だけで描き、覆う範囲は `TUTORIAL_SPOTLIGHT_AREA_ATTRIBUTE` で決め、`spotlighting` を渡す。列の手順で指を出さず輪郭だけにするのは SCR-008 に沿う（指が決め手の数を隠すため）。
- もう一度は入口を飛ばして最初の手順から始まる。プレイから開いた場合は完成の一言が言い分けられている（`maker/probe-play/05-completed-from-play.png`、`maker/probe-play/06-again-400ms.png`）。
