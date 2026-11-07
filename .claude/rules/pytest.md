---
paths:
  - "backend/**/test_*.py"
  - "backend/**/conftest.py"
---

# pytest のテストの書き方

## 配置

- テストは対象モジュールと同じディレクトリに `test_<対象モジュール>.py` として置く
- fixture はテストモジュールの中に定義し、複数のテストモジュールが使うときだけ `conftest.py` に移す
- `conftest.py` は、それを使うテストモジュールだけが読み込む場所に置く

## テスト名

- テスト関数名は `test_` に続けて、期待する動作を具体的に書いた日本語の散文にし、`こと` で終える
- テスト関数名に条件を表す `〜場合` `〜時` を入れない
- 条件を示すときは `Test<条件>の場合` クラスでまとめ、その中のテスト関数名には期待する動作だけを書く
- `Test<条件>の場合` の `<条件>` は日本語の散文で書く
- 対象コード内部の識別子や状態名でしか表せない条件は、条件のクラスにせず、対象を表すクラス・fixture・`@pytest.mark.parametrize` の入力で表す
- 同じ関数・メソッドを複数のテストで検証するときは、対象を表す `Test...` クラスでまとめる
- 対象を表す `Test...` クラスの名前には、対象の関数・メソッド・クラスの名前に対応するコード表記を使う
- モジュール名だけを表すクラスは作らない
- CLI オプション・列挙値・ID・パス・コード識別子などの機械識別子やリテラルそのものを検証するときは、散文に言い換えず実際の表記を書く
- fixture・helper・変数など、テスト関数名のほかにテストコードの中で参照する識別子は、日本語の散文にせずコード表記で名付ける

## 事前準備 / 実行 / 検証

- 事前準備は fixture か `@pytest.mark.parametrize` で行い、テスト関数には実行と検証だけを書く

  ```python
  OK:
  @pytest.fixture
  def user_id() -> int:
      return 1


  def test_ユーザーを取得できること(user_id: int) -> None:
      result = get_user(user_id)

      assert result.id == user_id

  NG:
  def test_ユーザーを取得できること() -> None:
      user_id = 1

      result = get_user(user_id)

      assert result.id == user_id
  ```

- テストデータ・入力値・外部状態・使い回すサブプロセスのコマンドは fixture で用意する
- fixture は既定の `function` スコープで定義し、`session` / `module` スコープと `autouse=True` は理由があるときだけ使う
- 一部のテストだけ既存の fixture と値が違うときは、テスト関数で fixture を受け取り、そのテストに固有の差分だけを変える
- 実行ではテスト対象を呼び出して戻り値や観測結果を変数で受け、検証ではその変数を `assert` する
- 実行と検証の間に空行を入れる
- 例外を投げることを検証するときは、`pytest.raises` で囲んだテスト対象の呼び出しを実行とする

  ```python
  OK:
  def test_不正な入力を拒否すること(invalid_input: str) -> None:
      with pytest.raises(ValueError):
          parse_user(invalid_input)
  ```

- アサーションではテスト対象の公開契約を検証する

## 入力違いのケース

- 同じ期待動作を入力違いで検証するときは `@pytest.mark.parametrize` を使う
- `@pytest.mark.parametrize` にケース名を付けるときは、`ids` に条件やケースの内容を日本語の散文で書く