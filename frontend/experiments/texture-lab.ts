import "./texture-lab.css";

const games = [
  ["water-sort", "ウォーターソート"],
  ["nanpure", "ナンプレ"],
  ["minesweeper", "マインスイーパー"],
  ["parking-jam", "パーキングジャム"],
  ["slide-puzzle", "スライドパズル"],
  ["takuzu", "バイナリパズル"],
  ["reflection", "リフレクション"],
  ["hitofude-puzzle", "一筆パズル"],
  ["ice-floor-maze", "アイスフロア迷路"],
  ["tsume-shogi", "詰将棋"],
] as const;
const variants = [
  ["original", "0 現状", "揃えない現状を、比較の基準にする。"],
  [
    "lines",
    "1 輪郭だけ",
    "線で描く盤の外枠・罫線と、開いたマスの地だけを整理。材質・影は残す。",
  ],
  [
    "individual",
    "2 個別に磨く",
    "将棋の木目や車の描き込みは残し、強い影だけを抑える。ゲーム間で同じ質感にはしない。",
  ],
  [
    "objects",
    "3 載る物を揃える",
    "木目・光沢を省き、盤は平面に。駒・ボトル・岩などに弱い厚みを付ける。",
  ],
  [
    "movable",
    "4 動く物を揃える",
    "同じ簡略化でも、厚みは動かす物・開けるマスに限定。固定された岩・縁石は平面に。",
  ],
  [
    "flat",
    "5 平面に寄せる",
    "材質・厚み・影を省く。ゲームの色・形・操作・動きは残す。",
  ],
] as const;
const params = new URLSearchParams(location.search);
const host = document.getElementById("lab");
if (!host) throw new Error("Missing lab");
host.innerHTML = `
  <header><a href="/">pa-zzle</a><span>626 · 質感の比較</span></header>
  <h1>揃えると、遊びたくなる？</h1>
  <p class="intro">統一を前提にせず、今の姿と比べる。同じ問題を実際に触って、読みやすさ・触りたさ・題材らしさを見る。</p>
  <form id="controls">
    <label>比較する案<select id="variant">${variants.map(([id, label]) => `<option value="${id}">${label}</option>`).join("")}</select></label>
    <label>ゲーム<select id="game">${games.map(([id, name]) => `<option value="${id}">${name}</option>`).join("")}</select></label>
    <label>レベル<select id="level">${[1, 2, 3, 4, 5].map((n) => `<option>${n}</option>`).join("")}</select></label>
    <label>並べ方<select id="view"><option value="compare">現状と横並び</option><option value="single">案だけ大きく</option><option value="overview">10ゲーム一覧</option></select></label>
    <button type="button" id="reset">同じ問題でやり直す</button>
  </form>
  <p id="description"></p>
  <p class="hint">操作・動きは本番と同じ。案を切り替えても途中の盤面を保ちます。左右の操作は独立。成績は保存しません。</p>
  <section id="frames" aria-label="盤面の比較"></section>
  <footer>見るポイント：盤面を追いやすいか ／ 触る物が分かるか ／ 題材の楽しさが残るか ／ 並べたときに嬉しいか。<br>すべて未採用の試作。1〜5は輪郭の整理を共通の土台にしています。</footer>
`;
function select(id: string) {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLSelectElement)) throw new Error(`Missing ${id}`);
  return element;
}
const variant = select("variant");
const game = select("game");
const level = select("level");
const view = select("view");
variant.value = variants.some(([id]) => id === params.get("variant"))
  ? params.get("variant")!
  : "individual";
game.value = games.some(([id]) => id === params.get("game"))
  ? params.get("game")!
  : "tsume-shogi";
level.value = /^[1-5]$/.test(params.get("level") ?? "")
  ? params.get("level")!
  : "3";
view.value = ["single", "overview"].includes(params.get("view") ?? "")
  ? params.get("view")!
  : "compare";
const frames = document.getElementById("frames")!;
function saveUrl() {
  history.replaceState(
    null,
    "",
    `?${new URLSearchParams({ variant: variant.value, game: game.value, level: level.value, view: view.value })}`,
  );
}
function describe() {
  document.getElementById("description")!.textContent =
    variants.find(([id]) => id === variant.value)?.[2] ?? "";
  for (const frame of frames.querySelectorAll("iframe[data-candidate]")) {
    if (frame instanceof HTMLIFrameElement)
      frame.contentWindow?.postMessage(
        { type: "texture-variant", variant: variant.value },
        location.origin,
      );
  }
  for (const label of frames.querySelectorAll("[data-candidate-label]"))
    label.textContent =
      variants.find(([id]) => id === variant.value)?.[1] ?? "";
  saveUrl();
}
window.addEventListener("message", (event: MessageEvent) => {
  if (event.origin !== location.origin || event.data?.type !== "texture-ready")
    return;
  for (const frame of frames.querySelectorAll("iframe[data-candidate]")) {
    if (
      frame instanceof HTMLIFrameElement &&
      frame.contentWindow === event.source
    ) {
      frame.contentWindow?.postMessage(
        { type: "texture-variant", variant: variant.value },
        location.origin,
      );
    }
  }
});
function addFrame(id: string, name: string, candidate: boolean) {
  const card = document.createElement("article");
  const heading = document.createElement("h2");
  heading.textContent =
    view.value === "overview" ? name : candidate ? "" : "0 現状";
  if (candidate && view.value !== "overview")
    heading.dataset.candidateLabel = "";
  const viewport = document.createElement("div");
  viewport.className = "viewport";
  const frame = document.createElement("iframe");
  frame.title = `${name}・${candidate ? "比較する案" : "現状"}`;
  frame.src = `/texture-lab-play.html?${new URLSearchParams({ game: id, level: level.value, variant: candidate ? variant.value : "original" })}`;
  if (candidate) frame.dataset.candidate = "";
  viewport.append(frame);
  card.append(heading, viewport);
  frames.append(card);
}
function renderFrames() {
  frames.replaceChildren();
  frames.className = view.value;
  game.disabled = view.value === "overview";
  if (view.value === "overview") {
    for (const [id, name] of games) addFrame(id, name, true);
  } else {
    const name = games.find(([id]) => id === game.value)![1];
    if (view.value === "compare") addFrame(game.value, name, false);
    addFrame(game.value, name, true);
  }
  describe();
}
variant.addEventListener("change", describe);
for (const control of [game, level, view])
  control.addEventListener("change", renderFrames);
document.getElementById("reset")!.addEventListener("click", renderFrames);
renderFrames();
