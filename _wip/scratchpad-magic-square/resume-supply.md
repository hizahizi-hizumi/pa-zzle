# 問題供給（版 8 への追従）の再開メモ

カード: `cards/問題供給-v8.md`。作業ディレクトリ: `supply8/`（以下このディレクトリからの相対パス）。D = `work/docs/パズル/導入調査/魔方陣/調査コード`。

## 終わったこと

- 前の回の結果を `問題供給-v4.md` に写した（`問題供給.md` はまだ版 4 の中身のまま。最後に版 8 の結果で上書きする）。
- 版 4 の期待値と調査コードの控え: `supply8/expected-v4.json`・`supply8/magic_square_supply-v4.py`。
- `$D/magic_square_supply.py` を版 8 に書き換えた（構文確認と小さな試運転 `supply8/smoke/` は通った）。
  - 分類は `md.classify_givens`（版 8）・`SIZES_V6`。
  - PLAN は L2 が版 4 と同じ6条件、L3 が 5×5/6×6 の T2 k12・k13、L4 が T3 k13、L5 が T3 k12。
  - 候補は2段で調べる（作ってキーを出す → 規則の例・重複・同じ答え・近さで除かれない候補だけ分類する）。規則は分類より先に当てるが、採る問題は変わらない。
  - 例の魔方陣は 4×4 だけにした（5×5 の除外を外す案。版 4 の 5×5 は `EXAMPLE5_V4` として、analyze で当たる候補を数えるためだけに残した）。
  - 足したオプション: `--level-order`・`--level-quota`・`--max-visits`・`--progress`。analyze に、流れの区間ごとの当たる割合と、5×5 の例に当たる候補の数を足した。
  - check は、難易度の観点の `v8/run/classified.jsonl`（`scratchpad/v8/run/`）と同じ ID で比べる形にした。expected は `--cases-from` で版 4 の cases・transformed・near_pairs の盤面を保ち、level（と reason）だけを版 8 にする。
- 計測（標本）: 問題集の大きさの見込みを、難易度の観点の版 8 の範囲内 767 問から出した。2,500 問で約 169,700 B、gzip の比 0.24 で約 41 KB（版 4 は 170,026 B・39,821 B）。

## 途中のこと

- `run_main.sh` の1段目（`pool --levels 1 2`）を止めた。止めた時点のログ（`pool-L12.log` の最後の行）は L1 500 済み、L2 {5×5: 250, 4×4: 222}、L2 の流れで調べた候補 9,385、経過 3,594 秒（2プロセス）。L2 の 4×4 は、答えが使用済み（same-answer-d4）の候補を分類しない形で、魔方陣の重複なしで 222 まで進んだ。区間ごとの当たる割合は、完走後に analyze で出す。
- `cache.jsonl` は 13,422 行で、全部の行が JSON として読め、改行で終わっている（書きかけの行は無い）。書きかけがあったときは、最後の行を消してから再開する（`Cache` は1行ずつ `json.loads` するので、壊れた行があると読み込みで止まる）。
- 期待値（`$D/magic_square_supply.expected.json`）と資料（`問題供給.md`・`魔方陣供給実験.md`）はまだ変えていない。

## 再開の仕方

`supply8/run_main.sh` をそのまま流す（2プロセス、キャッシュから続く。L1 と L2 の済んだ分はキャッシュから組むので数分）。

```sh
cd scratchpad/magic-square/supply8
./run_main.sh   # 1段目: pool --levels 1 2 → pool-v8-L12.json（pool-L12.log）、2段目: pool --level-quota 3=100 4=100 5=100 → pool-v8.json（pool-all.log）。終わると run.log に L12・ALL
```

見込み: 1段目の残り 4×4 28 問は 10〜15 分ほど（答えの類が減るほど遅い）。2段目の L3〜L5 標本は 2プロセスで 50 分ほど（推測）。

## 残りの手順

1. `analyze --pool pool-v8-L12.json --cache cache.jsonl`（問い2: L2 の 4×4 の候補数・CPU・区間ごとの当たる割合）。
2. 比べる案: `pool --levels 1 2 --level-order 2 1 --near 4 --unique-d4-answer4 --jobs 2 --cache cache.jsonl --out pool-v8-L21.json` と analyze。
3. `run_main.sh` の2段目の後に `analyze --pool pool-v8.json`（問い1: 条件ごとの当たる割合・時間、500問の見込み。問い4: 大きさを実測で出し直す）。`check --cache cache.jsonl --classified ../../v8/run/classified.jsonl`。
4. `invariance --pool pool-v8.json --cache cache.jsonl --per 8 --seed 1 --jobs 2`（30 分ほど）、`recheck --n 40`、`examples --pool pool-v8.json --cache cache.jsonl`。
5. 問い5: `expected --pool pool-v8.json --cache cache.jsonl --cases-from expected-v4.json --out <一時>` を2回作り、`cmp` で同じかを確かめてから `$D/magic_square_supply.expected.json` に置く。製品側で変わる所（5×5 の例を外すなら `example-squares.ts`・`research-reference.json` の `examples` の "5"・`pool-rules.test.ts` の `solution_keys["5"]`）を結果に書く。
6. `問題供給.md` を版 8 の結果で書き直し、`$D/magic_square_supply.py` の先頭の「調査で流したコマンド」を実際に流したものに合わせる。
