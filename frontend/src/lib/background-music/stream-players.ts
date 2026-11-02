/**
 * BGM をストリーミング再生する `<audio>` 要素を、決まった数だけ作って使い回す。
 *
 * iOS Safari は、利用者の操作の中で一度再生した要素でないと、操作の外での再生（画面が移ったときの曲の切り替えなど）を拒む。
 * そのため要素は作り捨てず、最初の操作の中で全ての要素を一度再生させておく（`unlockStreamPlayers`）。
 * それでも再生を拒まれた要素は、次の操作の中で再生し直す。
 */

/** BGM をストリーミング再生する `<audio>` 要素1つと、その状態。 */
export type StreamPlayer = {
  readonly element: HTMLAudioElement;
  /** 要素の音を AudioContext へ通す口。要素ごとに一度しか作れないので、作ったら使い回す。 */
  source: MediaElementAudioSourceNode | null;
  /** 読み込ませている曲の URL。何も読み込ませていなければ `null`。 */
  url: string | null;
  /** 曲のファイルを持っているときに、要素へ読み込ませるために作った URL。使い終えたら破棄する。 */
  objectUrl: string | null;
  /** 曲を流すために使っているか。使っていない要素は、別の曲の読み込みに回せる。 */
  inUse: boolean;
  /** 音を出しているか。 */
  playing: boolean;
  /** ネットワークからの読み込みが一区切りついたか（続けて再生できるだけ読み込んだか、読み込めなかったか）。 */
  settled: boolean;
  /** 利用者の操作の中で再生を許されたか。`unlocking` は、許されたかの答えを待っている間。 */
  unlock: "locked" | "unlocking" | "unlocked";
  /** 再生を頼んだが、利用者が操作していないために拒まれているか。 */
  blocked: boolean;
};

/** 使い回す要素の数。曲を切り替えるときに、フェードアウトする曲とフェードインする曲を同時に流せるだけ持つ。 */
const STREAM_PLAYER_COUNT = 2;

const players: StreamPlayer[] = [];
let changeListener: (() => void) | null = null;

/** 要素の状態（再生を始めた・読み込みが一区切りついた・再生を拒まれた）が変わったら `onChange` を呼ぶ。 */
export function listenForStreamPlayerChanges(onChange: () => void): void {
  changeListener = onChange;
}

function notifyChange() {
  changeListener?.();
}

/**
 * `url` の曲を読み込ませた要素を返す。読み込ませた要素が無ければ、使っていない要素に読み込ませる。
 * `file` を渡すと、ネットワークから読み込まず、そのファイルを読み込ませる。全ての要素を使っていれば `null`。
 */
export function getStreamPlayer(
  url: string,
  file: Blob | null,
): StreamPlayer | null {
  const loaded = players.find((player) => player.url === url);
  if (loaded) {
    return loaded;
  }
  const player = findFreeStreamPlayer();
  if (!player) {
    return null;
  }
  loadStreamPlayer(player, url, file);
  return player;
}

function findFreeStreamPlayer(): StreamPlayer | null {
  const free = players.find((player) => !player.inUse && player.url === null);
  if (free) {
    return free;
  }
  if (players.length < STREAM_PLAYER_COUNT) {
    return createStreamPlayer();
  }
  const idle = players.find((player) => !player.inUse);
  if (idle) {
    releaseStreamPlayer(idle);
  }
  return idle ?? null;
}

function createStreamPlayer(): StreamPlayer {
  const element = new Audio();
  const player: StreamPlayer = {
    element,
    source: null,
    url: null,
    objectUrl: null,
    inUse: false,
    playing: false,
    settled: false,
    unlock: "locked",
    blocked: false,
  };
  element.preload = "none";
  element.addEventListener("playing", function markPlaying() {
    player.playing = true;
    notifyChange();
  });
  element.addEventListener("pause", function markPaused() {
    player.playing = false;
  });
  element.addEventListener("canplaythrough", function markSettled() {
    settleStreamPlayer(player);
  });
  element.addEventListener("error", function markFailed() {
    if (player.url === null) {
      return;
    }
    if (import.meta.env.DEV) {
      console.warn(`BGM を再生できない: ${player.url}`, element.error);
    }
    settleStreamPlayer(player);
  });
  players.push(player);
  return player;
}

function settleStreamPlayer(player: StreamPlayer) {
  if (player.settled || player.url === null) {
    return;
  }
  player.settled = true;
  notifyChange();
}

function loadStreamPlayer(
  player: StreamPlayer,
  url: string,
  file: Blob | null,
) {
  const { element } = player;
  player.url = url;
  player.objectUrl = file ? URL.createObjectURL(file) : null;
  // 読み解いてバッファのループへ渡すまでのつなぎ。読み解けなかったときも、要素のループで流し続ける。
  element.loop = true;
  element.preload = "auto";
  element.src = player.objectUrl ?? url;
}

/** `url` の曲をネットワークから読み込んでいる最中の要素があるか。 */
export function isStreamingFromNetwork(url: string): boolean {
  return players.some(
    (player) =>
      player.url === url && player.objectUrl === null && !player.settled,
  );
}

/** 要素の音を `context` へ通す口を返す。 */
export function connectStreamPlayer(
  player: StreamPlayer,
  context: AudioContext,
): MediaElementAudioSourceNode {
  if (player.source?.context === context) {
    return player.source;
  }
  player.source = context.createMediaElementSource(player.element);
  return player.source;
}

/** 曲を流すために要素を使い、再生を始める。拒まれたら、次の `unlockStreamPlayers` で再生し直す。 */
export function playStreamPlayer(player: StreamPlayer): void {
  player.inUse = true;
  player.blocked = false;
  if (player.unlock === "locked") {
    player.unlock = "unlocking";
  }
  player.element.play().then(
    function markUnlocked() {
      player.unlock = "unlocked";
    },
    function handleRejectedPlay(error: unknown) {
      if (isNotAllowedError(error)) {
        player.unlock = "locked";
        player.blocked = player.inUse;
        notifyChange();
        return;
      }
      player.unlock = "unlocked";
      if (!player.inUse || isAbortError(error)) {
        return;
      }
      if (import.meta.env.DEV) {
        console.warn(`BGM を再生できない: ${player.url}`, error);
      }
    },
  );
}

/** 要素を使い終え、読み込みを止めて、別の曲に使えるようにする。 */
export function releaseStreamPlayer(player: StreamPlayer): void {
  const { element } = player;
  player.inUse = false;
  player.playing = false;
  player.settled = false;
  player.blocked = false;
  player.url = null;
  element.pause();
  element.removeAttribute("src");
  element.load();
  if (player.objectUrl !== null) {
    URL.revokeObjectURL(player.objectUrl);
    player.objectUrl = null;
  }
}

/** 使っていない要素のうち、`keep` 以外の曲を読み込ませている要素の読み込みを止める。 */
export function releaseIdleStreamPlayers(keep: (url: string) => boolean): void {
  for (const player of players) {
    if (!player.inUse && player.url !== null && !keep(player.url)) {
      releaseStreamPlayer(player);
    }
  }
}

/** 全ての要素を利用者の操作の中で再生させ終えておらず、操作を待つ必要があるか。 */
export function streamPlayersNeedUserGesture(): boolean {
  return (
    players.length < STREAM_PLAYER_COUNT ||
    players.some((player) => player.unlock !== "unlocked" || player.blocked)
  );
}

/**
 * 利用者の操作の中で呼び、全ての要素をこの先いつでも再生できるようにする。
 * 拒まれていた再生はやり直し、使っていない要素は一度再生してすぐ止める。要素の音は先に `context` へ通しておき、外へは出さない。
 */
export function unlockStreamPlayers(context: AudioContext): void {
  while (players.length < STREAM_PLAYER_COUNT) {
    createStreamPlayer();
  }
  for (const player of players) {
    connectStreamPlayer(player, context);
    if (player.blocked) {
      playStreamPlayer(player);
    } else if (player.unlock === "locked" && !player.inUse) {
      primeStreamPlayer(player);
    }
  }
}

function primeStreamPlayer(player: StreamPlayer) {
  const { element } = player;
  player.unlock = "unlocking";
  const playing = element.play();
  element.pause();
  playing.then(
    function markUnlocked() {
      player.unlock = "unlocked";
      notifyChange();
    },
    function markUnlockedUnlessRefused(error: unknown) {
      player.unlock = isNotAllowedError(error) ? "locked" : "unlocked";
      notifyChange();
    },
  );
}

function isNotAllowedError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotAllowedError";
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
