# #883 — 案2に基づくファイル単位の仮配置と依存検証（M3への入力）

**状態：設計台帳。全ファイルの行先は仮割当てであり、移動決定・コード変更ではない。**

## 基準・対象

- 基準ref：`main@2c470846ba31447b5f498bd2646e3121eba439a5`。
- Repository Snapshot Artifact：`14046136249`、HEAD一致、ZIP SHA-256 `2c96a4889a463d9ff55afb7f44e94fe318a28577088ce95180662f225e1a97a7`。
- [案2の修正版](./directory-options.md) の**ファイルの現住所・仮配置先**を [file-placement-map.csv](./file-placement-map.csv) に全件記録する。
- CSV列：`current_path` / `target_path` / `decision` / `rationale`。`A:keep`は責務・ディレクトリ維持確定、`keep`は移動不要の仮判定、`move`は新責務への仮移動、`absorb_A`は既存Aの`views/`へ仮吸収、`outside_scope`は今回のソース構造再編の対象外。
- ファイル名・パスの判定は、親コンポーネントの私有子やテストを親と一緒に扱う規則で展開した。**各行の意味上の所有権を人手で全件確定したことを意味しない。**

## 集計

| 判定 | ファイル数 |
|---|---:|
| Aの責務と配置を維持（`games/`・`pages/`・`views/`・`components/ui/`） | 1,135 |
| A以外で変更しない（汎用UI・技術基盤・資産等） | 116 |
| `app/`・`features/`へ移動 | 164 |
| Aの`views/`へ吸収 | 27 |
| `frontend/src/`以外で今回は移動しない | 657 |
| **合計** | **2,099** |

移動が発生するのは`frontend/src/`の191ファイル（テストを含む）。**移動先パスの衝突は0件**。残る1,251ファイルの`frontend/src/`内の配置は変えない。

主な行先：

| 現行 | 仮の配置先 | 理由 |
|---|---|---|
| `game-catalog/<game>/`、カタログ本体、`playable-game.tsx`等 | `app/game-integration/` | ゲーム登録・ゲーム別の接続能力 |
| `game-catalog/game-navigation.ts`、`use-random-play-entry.ts` | `app/game-integration/` | `GameCatalogEntry`を用いるため。app/navigationとの双方向参照を防止 |
| `game-catalog/play-location-state.ts`、`problem-id-query.ts`、結果のlocation state・遷移 | `app/navigation/` | カタログに依存しないURL契約と遷移 |
| `game-catalog/game-home.*`、`zukan/ui/GameHomeScreen*` | `app/game-home/` | 11ゲーム共通のゲームホーム体験 |
| `game-catalog/app-home.*`、`components/{AppTitleScreen,GameSelectionGallery}*` | `views/PuzzleSelectionView/` | このView専用の表示・状態 |
| `records/ui/PlayRecordsScreen*`、`collection/ui/CollectionScreen*` | `views/PlayRecordsView/` | 記録画面のみに属する表示・私有子UI |
| `records/play-records-location-state.ts` | `views/` | 記録画面専用の復帰情報 |
| `records/ui/play-timeline-entry-description.ts` | `app/game-integration/` | 登録済みゲームを使う履歴表示契約 |
| `records/`の保存・比較・自己ベスト等 | `features/records/` | 記録の正本と共通規則 |
| `zukan/`の計算・閲覧状態・番号 | `features/zukan/` | 図鑑の規則 |
| `collection/collection.ts` | `features/collection/` | 横断集計 |
| `game-catalog/random-problem-selection.ts`、`lib/random-problem-settings.ts`等 | `features/random-play/` | 出題条件の意味と選択 |
| `lib/game-selection-order-setting.ts`、`components/SettingsDialog*` | `features/settings/` | 設定値と設定UI |
| `components/AppShell*` | `app/shell/` | アプリの外枠 |
| `components/GameCatalogContext.tsx` | `features/settings/` | 設定UIだけが消費する表示用ゲーム情報の契約 |

Aのゲーム内約1,026ファイルは構造を維持。各ゲームの出題条件・記録アダプターを無条件に`features/`へ吸い出さない。

## 静的参照の確認

- 本番ファイル間の静的参照：**3,595件**。テストを含めた静的参照：**5,071件**（うちテスト由来1,476件）。
- `?raw`付きSVG参照も正規化して参照元と参照先のパスを解決した。**未解決の参照先は0件**。
- 移動元または参照先が変わる本番import辺は948件。これはそのまま**修正が948箇所必要という意味ではない**（一括リネームで参照が追従するため）。
- 新構造で禁じる方向へ向かう静的参照は、**移動先を割り当てただけの段階では3件**。内訳と修正案は [directory-options.md](./directory-options.md)。
- app内のグループ間の相互参照は、`game-navigation.ts`と`use-random-play-entry.ts`をgame-integrationへ置くことで解消する。残る`app/game-integration→features/random-play`の依存に対する逆向きの1件も、選択APIの契約を細くすることで解消する。
- `games↔components`、`games↔records`の**ディレクトリ集計上**の双方参照は既存の構造。共通契約と個別ゲームの実装を見分けて評価し、単純な双方向エッジだけで循環と判定しない。

## M1・M2の先行ゲートと、M3で残る確認

- [ ] **M1：所有・非所有、配置・新設条件、依存方向を定義し、正本規則を確定する。**
- [ ] **M2：新構造のBiome境界・テストへの適用・負例/正例・未登録ディレクトリ検出を実装し、移動前にCIで実証する。**
- [ ] **M3：** 移動候補191ファイルをグループで追い、各行の実際の所有者を確定する。Aからの参照先と私有子/テストを特に確認する。
- [ ] 禁止方向の3参照を、`ClearedProblemSource`・`ZukanGameSource`・設定ダイアログの描画関数で解消できることを実装時に確かめる。
- [ ] ゲームの登録契約`GameCatalogEntry`の肥大化が実装を難しくする場合のみ分割する。事前に形式的なinterface数を増やさない。
- [ ] `frontend/scripts/dependency-rules.ts`・生成される`frontend/biome.json`、`.claude/rules/game-structure.md`・`views.md`・`shadcn-ui.md`の参照パスとglobを同期する。
- [ ] importだけでなく、テスト中の`vi.mock`、動的import、CSS、ルーター特殊ファイル、保存キー・問題ID・画像や音の`import.meta.glob`を検証する。
- [ ] Issue [#249](https://github.com/hizahizi-hizumi/pa-zzle/issues/249)の記録責務移動と整合するかを確認し、Issueを二重化させない。
- [ ] **M4：M1/M2を通過してから**契約単位・責務単位で実装し、型検査・テスト・ビルド・画面のPlaywright検証を通す。検査を移動のために無効化しない。途中でmainを取り込まない。

## 引き継ぎ

1. [Issue #883](https://github.com/hizahizi-hizumi/pa-zzle/issues/883) を読み、実装の許可範囲とAの5確定境界を確認する。
2. [責務定義・移動前の検査ゲート](./ownership-governance.md)を先に確認する。この文書と`file-placement-map.csv`で現在位置と仮配置先を得る。**CSVの各行は最終承認ではない**。
3. 最新refの`AGENTS.md`・適用規約と、HEAD一致のRepository Snapshot Artifactを確認する。異なるHEADなら一覧を再生成して差分を確認する。
4. 設計判断・未確定事項を本資料に残し、決まった原則だけを正本文書へ反映する。

