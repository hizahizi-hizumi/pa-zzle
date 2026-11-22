import counterKnockSoundUrl from "@/games/water-sort/assets/sounds/ideas/bar/counter-knock.flac";
import glassTingSoundUrl from "@/games/water-sort/assets/sounds/ideas/bar/glass-ting.flac";
import iceDropSoundUrl from "@/games/water-sort/assets/sounds/ideas/bar/ice-drop.flac";
import lampSwitchSoundUrl from "@/games/water-sort/assets/sounds/ideas/bar/lamp-switch.flac";
import spoonTouchSoundUrl from "@/games/water-sort/assets/sounds/ideas/bar/spoon-touch.flac";
import pouredBubble1SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-1.flac";
import pouredBubble2SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-2.flac";
import pouredBubble3SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-3.flac";
import pouredBubble4SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-4.flac";
import pouredBubble5SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-5.flac";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import { isCompletedGlass } from "@/games/water-sort/ui/ideas/bar/bar-glass-geometry";
import {
  BAR_POUR_DURATION_MS,
  BAR_POUR_PHASE,
} from "@/games/water-sort/ui/ideas/bar/bar-pour-timeline";
import {
  defineSoundEffect,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
  type SoundLayer,
} from "@/lib/audio/sound-effects";
import { prefersReducedMotion } from "@/lib/motion";

/** 注げないとき、グラスの厚い底がカウンターに当たる鈍い音。 */
const counterKnockSound = defineSoundEffect(counterKnockSoundUrl);
/** 差したバースプーンが、注ぎ先のグラスの縁に触れる小さな金属の音。 */
const spoonTouchSound = defineSoundEffect(spoonTouchSoundUrl);
/** そろったグラスに氷がひとつ落ちる「カラン」。 */
const iceDropSound = defineSoundEffect(iceDropSoundUrl);
/** 店の灯りのスイッチ。 */
const lampSwitchSound = defineSoundEffect(lampSwitchSoundUrl);
/** 灯りがともったグラスの、静かに澄んだ響き（C6）。 */
const glassTingSound = defineSoundEffect(glassTingSoundUrl);

/**
 * 柄を伝って液面に落ちる液の、小さな泡の音。今の画面と同じ泡を、とろみのある液に聞こえるよう遅く・小さく鳴らす。
 * `transferProgress` は液が移っている時間の中での鳴り始め。
 */
const trickleBubbles = [
  { url: pouredBubble1SoundUrl, transferProgress: 0 },
  { url: pouredBubble2SoundUrl, transferProgress: 0.2 },
  { url: pouredBubble3SoundUrl, transferProgress: 0.37 },
  { url: pouredBubble4SoundUrl, transferProgress: 0.55 },
  { url: pouredBubble5SoundUrl, transferProgress: 0.74 },
].map(({ url, transferProgress }) => ({
  sound: defineSoundEffect(url),
  transferProgress,
}));

export const barSounds: readonly SoundEffect[] = [
  counterKnockSound,
  spoonTouchSound,
  iceDropSound,
  lampSwitchSound,
  glassTingSound,
  ...trickleBubbles.map(({ sound }) => sound),
];

const TRICKLE_VOLUME = 0.55;
const TRICKLE_PLAYBACK_RATE = 0.8;

function atPhase(phase: number): number {
  return prefersReducedMotion() ? 0 : BAR_POUR_DURATION_MS * phase;
}

export function playBarOperationSound(operation: WaterSortOperation) {
  switch (operation.type) {
    case "invalid":
      if (!prefersReducedMotion()) {
        playSound(counterKnockSound);
      }
      return;
    case "poured": {
      const reduced = prefersReducedMotion();
      if (!reduced) {
        playSound(spoonTouchSound, {
          delayMs: atPhase(BAR_POUR_PHASE.spoonSettled),
          variation: REPEATED_SOUND_VARIATION,
        });
      }
      const transferMs = reduced
        ? 300
        : BAR_POUR_DURATION_MS *
          (BAR_POUR_PHASE.transferEnd - BAR_POUR_PHASE.transferStart);
      const layers = trickleBubbles.map(
        ({ sound, transferProgress }): SoundLayer => ({
          sound,
          offsetMs: transferMs * transferProgress,
        }),
      );
      for (const layer of layers) {
        playSound(layer.sound, {
          delayMs: atPhase(BAR_POUR_PHASE.transferStart) + layer.offsetMs,
          volume: TRICKLE_VOLUME,
          playbackRate: TRICKLE_PLAYBACK_RATE,
          variation: REPEATED_SOUND_VARIATION,
        });
      }
      const destination =
        operation.stateAfter[operation.destinationBottleIndex] ?? [];
      if (isCompletedGlass(destination)) {
        playSound(iceDropSound, {
          delayMs: reduced ? transferMs : atPhase(BAR_POUR_PHASE.iceLand),
        });
      }
      return;
    }
  }
}

/** 店の灯りが入るときのスイッチ。 */
export function playLampSwitch() {
  playSound(lampSwitchSound);
}

/** 五音音階（C・D・E・G・A）を、灯りがともる順に上がっていく。 */
const tingScale = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2, 9 / 4, 5 / 2];
const TING_VOLUME = 0.5;

export function playGlassTing(order: number, count: number) {
  const step =
    count <= tingScale.length
      ? order
      : Math.round((order * (tingScale.length - 1)) / (count - 1));
  playSound(glassTingSound, {
    playbackRate: tingScale[step] ?? 1,
    volume: TING_VOLUME,
  });
}
