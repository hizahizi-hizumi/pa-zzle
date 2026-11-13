// 試作の注ぐ動きの間に合わせて、今のゲームの音の素材を鳴らす。
import {
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import clearedSoundUrl from "@/games/water-sort/assets/sounds/cleared.flac";
import invalidSoundUrl from "@/games/water-sort/assets/sounds/invalid.flac";
import pouredBubble1SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-1.flac";
import pouredBubble2SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-2.flac";
import pouredBubble3SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-3.flac";
import pouredBubble4SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-4.flac";
import pouredBubble5SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-5.flac";
import pouredBubble6SoundUrl from "@/games/water-sort/assets/sounds/poured-bubble-6.flac";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import { prefersReducedMotion } from "@/lib/motion";
import {
  defineSoundEffect,
  playLayeredSound,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
  type SoundLayer,
} from "@/lib/sound-effects";
import { FLOW_END, FLOW_START, POUR_MS } from "./use-light-motion";

const invalidSound = defineSoundEffect(invalidSoundUrl);
const clearedSound = defineSoundEffect(clearedSoundUrl);
const FLOW_MS = POUR_MS * (FLOW_END - FLOW_START);
const bubbleLayers: SoundLayer[] = [
  { url: pouredBubble1SoundUrl, at: 0 },
  { url: pouredBubble2SoundUrl, at: 0.16 },
  { url: pouredBubble3SoundUrl, at: 0.3 },
  { url: pouredBubble4SoundUrl, at: 0.48 },
  { url: pouredBubble5SoundUrl, at: 0.64 },
  { url: pouredBubble6SoundUrl, at: 0.82 },
].map(({ url, at }) => ({
  sound: defineSoundEffect(url),
  offsetMs: FLOW_MS * at,
}));
const sounds: readonly SoundEffect[] = [
  invalidSound,
  clearedSound,
  ...bubbleLayers.map(({ sound }) => sound),
];

export function usePourSounds(operation: WaterSortOperation | null) {
  usePrepareSoundEffects(sounds);
  useOperationSound(operation, (op) => {
    const reduced = prefersReducedMotion();
    if (op.type === "invalid") {
      if (!reduced) playSound(invalidSound);
      return;
    }
    if (op.type !== "poured") return;
    playLayeredSound(bubbleLayers, {
      delayMs: reduced ? 0 : POUR_MS * FLOW_START,
      variation: REPEATED_SOUND_VARIATION,
    });
    if (op.isClearingMove && !reduced) {
      playSound(clearedSound, { delayMs: POUR_MS * FLOW_END });
    }
  });
}
