---
paths:
  - "frontend/src/**/*.{ts,tsx}"
---

# React Hooks

## 適用除外

- `frontend/src/components/ui/**` は shadcn/ui の上流形状を維持するため、本規約の適用対象外とする。

## state

- stateは、その値を表示する場所ではなく、その意味を所有する責務で管理する。
- propsや既存stateからレンダー中に求められる値を、別のstateとして保持しない。
- propsをstateへ複製して `useEffect` で同期し続ける設計にしない。初期値として使う場合は、その契約を明確にする。

```tsx
// NG: score から導出できる値を別stateとして同期する
const [scoreLabel, setScoreLabel] = useState("");

useEffect(() => {
  setScoreLabel(`${score}点`);
}, [score]);

// OK
const scoreLabel = `${score}点`;
```

## effect

- `useEffect` は、React外部のシステムと状態を同期するために使用する。
- React内部のprops・state・レンダーだけで完結する処理に `useEffect` を使用しない。
- ユーザー操作に起因する処理は、state変化を `useEffect` で監視せずイベントハンドラで実行する。
- ブラウザAPI、タイマー、購読、ストレージなど、React外部との接続には `useEffect` を使用してよい。

```tsx
// NG: ユーザー操作をstate経由でeffectへ迂回する
const [submitted, setSubmitted] = useState(false);

useEffect(() => {
  if (submitted) {
    save();
  }
}, [submitted]);

function handleSubmit() {
  setSubmitted(true);
}
```

```tsx
// OK: ユーザー操作に起因する処理はイベントで実行する
function handleSubmit() {
  save();
}
```

```tsx
// OK: React外部の document と同期する
useEffect(() => {
  document.title = title;
}, [title]);
```
