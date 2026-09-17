# ChatGPT環境での画面確認

ChatGPT実行環境で `pa-zzle` のVite開発サーバーをPlaywright / Chromiumから確認する手順。

## 前提

この環境では次の制約がある。

- Chromiumには管理ポリシー `URLBlocklist: ["*"]` が適用されており、`page.goto("http://127.0.0.1:3000/")` は `net::ERR_BLOCKED_BY_ADMINISTRATOR` になる。
- 外部パッケージレジストリへ依存せず、Repository SnapshotとOffline Dependenciesを使う。
- Playwrightは `/opt/pyvenv`、Chromiumは `/usr/bin/chromium` にある。

Chromiumの管理ポリシーは変更しない。ViteへのHTTP通信をPython側で行い、Playwrightの要求中継でブラウザへ返す。

## 1. Repository SnapshotとOffline Dependenciesを用意する

Repository Snapshot Artifactは対象refの最新HEADとSHAが一致するものを使う。

対象Snapshotと同じRepository Snapshot workflow runにある `repository-environment-<target>-<sha>.json` を取得する。`snapshot.sha` が対象refの最新HEADと一致することを確認し、`offline_dependencies.artifact_id` でOffline Dependenciesを取得する。過去のworkflow runから依存Artifactを探索しない。

Offline Dependenciesを展開し、`manifest.env` の `INPUT_KEY` と環境マニフェストの `offline_dependencies.key`、対象Snapshotから計算したkeyが一致することを確認する。

```sh
python3 .github/actions/offline-dependencies/scripts/artifact_state.py key --repo-root .
cat /path/to/offline-dependencies/manifest.env
```

`frontend/node_modules` をOffline Dependenciesへ向ける。

```sh
ln -s /path/to/offline-dependencies/frontend/node_modules frontend/node_modules
```

## 2. Viteを起動する

```sh
frontend/node_modules/.bin/vite \
  --config frontend/vite.chatgpt.config.ts \
  --host 127.0.0.1 \
  --port 3000 \
  --strictPort
```

`vite.chatgpt.config.ts` は実行時の `src` モジュールを依存最適化の入口として指定する。これにより、新しい実行環境でもViteの起動中に依存最適化を完了させ、Playwright描画中の再最適化によるページ再読み込みを防ぐ。

`curl` では開発サーバーへ直接到達できることを確認できる。

```sh
curl --fail http://127.0.0.1:3000/
```

Chromiumの `page.goto()` は管理ポリシーで失敗するため、画面確認には使わない。

## 3. Playwrightで開く

`scripts/chatgpt_playwright.py` の `ChatGPTBrowser` を使う。

```python
import re
import sys

sys.path.insert(0, "scripts")
from chatgpt_playwright import ChatGPTBrowser

with ChatGPTBrowser(path="/") as browser:
    page = browser.page

    page.get_by_role(
        "heading",
        name="今日はどのパズルで遊びますか？",
    ).wait_for()
    page.get_by_role(
        "link",
        name=re.compile("カラーウォーターソート"),
    ).click()
    page.get_by_role(
        "heading",
        name="カラーウォーターソート",
    ).wait_for()

    page.screenshot(path="/tmp/pa-zzle.png", full_page=True)
    browser.assert_no_browser_errors()
```

実行には環境組み込みのPlaywrightを使う。

```sh
/opt/pyvenv/bin/python /tmp/check_page.py
```

任意のルートから確認したい場合は `path` を指定する。

```python
with ChatGPTBrowser(path="/games/sudoku") as browser:
    browser.page.get_by_role("heading", name="ナンプレ").wait_for()
```

レスポンシブ確認では同じ `page` の画面幅を変更する。

```python
page.set_viewport_size({"width": 390, "height": 844})
page.screenshot(path="/tmp/pa-zzle-mobile.png", full_page=True)
```

## 仕組み

Viteは `vite.chatgpt.config.ts` により依存最適化を起動時に完了させる。その後、`ChatGPTBrowser` は次の処理を行う。

1. PythonからViteのHTMLを取得し、`page.set_content()` で `about:blank` に描画する。
2. `<base>` をViteへ向け、JS・CSS・画像などの要求を `page.route()` で捕捉する。
3. 捕捉した要求をPythonからViteへ送り、`route.fulfill()` でブラウザへ返す。
4. `about:blank` では `createBrowserRouter` が正しいURLを得られないため、ブラウザへ返すGeneroutedの最適化済みモジュールだけを `createMemoryRouter` に差し替える。
5. `ChatGPTBrowser(path=...)` の値をMemory Routerの初期ルートとして使う。

リポジトリのソースやChromiumの管理ポリシーは変更しない。差し替えは画面確認中のPlaywright応答だけに適用される。

このため `page.url` はアプリのルートを表さず `about:blank` のままになる。ルート確認は表示内容、リンク操作後の状態、または `ChatGPTBrowser(path=...)` で行う。

Memory Routerへ差し替えているため、アドレスバーのURL、ブラウザの戻る・進む、`window.history` / `window.location` に依存する挙動は本手順では忠実に検証できない。それらは別のテストで確認し、この手順では画面描画・アプリ内遷移・操作結果を検証する。

## 確認項目

画面変更を確認するときは、少なくとも以下を実施する。

- 対象画面を実際に描画する。
- 変更箇所をPlaywrightで操作する。
- `browser.assert_no_browser_errors()` で `pageerror`、`console.error`、失敗した要求がないことを確認する。
- 見た目が重要な変更ではスクリーンショットを確認する。
- レスポンシブ対応に関係する変更ではスマートフォン相当の画面幅でも確認する。

## 失敗したとき

`Generouted browser router ... was not found` または `createMemoryRouter ... was not found` が出た場合、Generouted / React Router / Viteの出力形式が変わっている。`scripts/chatgpt_playwright.py` の差し替え処理を現行依存に合わせて更新し、直接 `page.goto()` へ戻さない。
