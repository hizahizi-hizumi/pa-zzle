# ピクトグラム / アイコン設計の外部調査

Issue #90 の独自PoCを一般知見へ接続するための調査メモ。pa-zzle 固有の正解形状を定義する文書ではない。

## 1. ISO 9186: 理解可能性と知覚品質を分けて試験する

### ISO 9186-1:2014

Graphical symbols — Test methods — Part 1: Method for testing comprehensibility

https://www.iso.org/standard/59226.html

要点:

- 図記号が意図した意味をどの程度伝えられるかを試験する
- 補助説明文なしで正しく理解されることを狙う
- 「意味を伝えられるか」を独立した試験対象として扱う

pa-zzle への適用:

- 完成UIではゲーム名を併記しても、診断時にはゲーム名を隠して意味的距離を確認する
- 「見た目が整っている」ことと「対象ゲームに結びつく」ことを別評価にする

### ISO 9186-2:2008

Graphical symbols — Test methods — Part 2: Method for testing perceptual quality

https://www.iso.org/standard/43484.html

要点:

- 図記号を構成する各要素が、意図した物体または形として識別できるかを試験する
- 意味全体を理解できる以前に、構成要素そのものが知覚できる必要がある

pa-zzle への適用:

- ナンプレの数字が格子線に負ける、液体境界が潰れる、という問題は「意味」ではなく構成要素の知覚品質として切り分ける
- 実表示サイズで構成要素を確認する工程をSkillへ入れる

## 2. McDougall, Curry & de Bruijn (1999): アイコン評価を複数軸で扱う

Measuring symbol and icon characteristics: norms for concreteness, complexity, meaningfulness, familiarity, and semantic distance for 239 symbols

https://pubmed.ncbi.nlm.nih.gov/10502873/
DOI: 10.3758/BF03200730

要点:

- アイコン/記号について、具体性、複雑性、意味の分かりやすさ、親しみ、意味的距離を独立した特性として定量化している
- 「抽象 / 具体」だけで良し悪しを決めるのではなく、複数軸で評価する必要がある

pa-zzle への適用:

- Issue #90 の「抽象度」を1本の尺度として扱わない
- 特に **意味的距離** と **視覚複雑性** を別々に下げる
- 単純化で意味的距離が悪化した場合、単純化を正解としない

## 3. Goetz & Neider (2024): 具体的で単純なアイコンは視覚探索で有利

Keep it real, keep it simple: the effects of icon characteristics on visual search

https://www.tandfonline.com/doi/full/10.1080/0144929X.2023.2286527

要点:

- 具体性、視覚複雑性、弁別性と視覚探索性能の関係を検討
- 高い具体性は探索を助ける一方、複雑性が高いと対象確認に時間がかかる傾向を報告
- 「具体性を捨てて抽象化する」ことと「複雑性を下げる」ことは同義ではない

pa-zzle への適用:

- ゲーム中に実際に見る対象・構造から始める
- 具体的な対象を維持したまま、状態数・線密度・重複情報を削る
- 実ゲームの縮小表示と汎用記号の中間を、「具体だが単純」として探す

## 4. Zhang et al. (2024): 意味的距離は視覚探索性能に影響する

Semantic distance of icons: Impact on user cognitive performance and a new model for semantic distance classification

https://doi.org/10.1016/j.ergon.2024.103610

要点:

- アイコンの意味的距離が視覚探索性能へ有意に影響すると報告
- 図形と対象概念の関係性は、単なるスタイル差とは別の重要因子

pa-zzle への適用:

- 「格子だからナンプレ」「水滴だからウォーターソート」といった遠い比喩で済ませず、対象ゲームとの関係を近づける
- 汎用アイコン化でゲーム固有性が失われる問題を、意味的距離として評価する

## 5. IBM Design Language: グリッド、余白、線、光学補正でセット品質を揃える

IBM Design Language — Pictograms

https://www.ibm.com/design/language/iconography/pictograms/design/

要点:

- 32px × 32px のマスターグリッドを使う
- 外周余白を安全域として持つ
- 一貫した線仕様を使いつつ、必要なら視覚重量のために光学的調整を行う
- 全サイズで細部が成立するよう調整する

pa-zzle への適用:

- 共通化するのはゲーム固有図形ではなく、表示枠、余白、線幅の確認方法、比較方法
- 数値上の中央・同サイズより、一覧での光学的重量を確認する
- 固定 `viewBox` と実表示サイズ比較を再現可能な工程にする

## 6. Material Design: ライブエリアとキ―ラインで視覚比率を揃える

Material Design — Icons

https://m1.material.io/style/icons.html

要点:

- グリッド、ライブエリア、外周パディングを定義する
- 正方形・円・縦長・横長など異なる形状でも、キ―ラインを使って視覚的な比率を揃える
- 形状ごとに同じ数値寸法へ押し込むのではなく、知覚上の整合を取る

pa-zzle への適用:

- ボトル群と正方格子のように外形が違うピクトグラムを、単純な幅/高さ一致だけで揃えない
- 比較シート上で占有率と余白を確認する

## 7. Fluent 2: 小サイズでは視覚重量と複雑性を明示的に管理する

Fluent 2 — Iconography

https://fluent2.microsoft.design/iconography

要点:

- アイコンは概念・対象・操作を意味的に表し、認識しやすさを優先する
- 小サイズ向けの見え方と視覚重量を考慮する
- 修飾要素を追加しすぎて複雑化しない
- 色追加は視覚バランスを崩しうるため慎重に扱う

pa-zzle への適用:

- 追加情報は意味上必要な場合だけ足す
- 色数を増やすことを識別性の第一手段にしない
- 実表示サイズで「弱すぎる要素」を見つける

## 8. Issue #90 への統合結論

外部知見から支持される部分:

- 意味が伝わるかと、構成要素が見えるかを分けて評価する
- 具体性と複雑性を別軸として扱う
- 意味的距離を重要な評価軸にする
- 共通グリッド、余白、線、実表示サイズでセット品質を揃える
- 機械的な寸法一致だけでなく光学補正を許容する

pa-zzle のPoCで得た独自仮説:

- ゲーム一覧では「対象/構造」と「状態/記号」のような役割の違う特徴の組み合わせが少ない情報量で効く可能性がある
- 余白を情報分離として積極的に使える
- ゲーム本体の縮小再現ではなく、識別に必要な最小構成へ再構成する

独自仮説は3ゲーム目以降で再現性を検証し、外部知見と同等の一般則として扱わない。
