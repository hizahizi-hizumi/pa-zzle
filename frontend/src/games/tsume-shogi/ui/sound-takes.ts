import type { SoundEffect } from "@/lib/audio/sound-effects";

/**
 * 同じ音を録り直した複数のテイク。鳴らすたびに `pick` で1本を選び、直前に選んだテイクは続けて選ばない。
 * 回数の多い操作の音を、共通の揺らぎだけでなく録音の違いでも変えるために使う。
 */
export type SoundTakes = {
  readonly takes: readonly [SoundEffect, ...SoundEffect[]];
  pick(): SoundEffect;
};

export function defineSoundTakes(
  takes: readonly [SoundEffect, ...SoundEffect[]],
): SoundTakes {
  let previousIndex: number | null = null;
  return {
    takes,
    pick() {
      previousIndex = pickTakeIndex(takes.length, previousIndex, Math.random());
      return takes[previousIndex] ?? takes[0];
    },
  };
}

/**
 * `takeCount` 本のテイクから次に鳴らす1本の番号を、0 以上 1 未満の `random` で選ぶ。
 * 直前のテイクがあれば、それを除いた残りから同じ確からしさで選ぶ。テイクが1本だけなら、それを続けて選ぶ。
 */
function pickTakeIndex(
  takeCount: number,
  previousIndex: number | null,
  random: number,
): number {
  if (previousIndex === null || takeCount < 2) {
    return Math.floor(random * takeCount);
  }
  const indexAmongOthers = Math.floor(random * (takeCount - 1));
  return indexAmongOthers < previousIndex
    ? indexAmongOthers
    : indexAmongOthers + 1;
}

export const _private = { pickTakeIndex };
