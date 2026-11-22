import { useEffect, useRef } from "react";
import type { GameProgress } from "@/games/play";
import {
  useClearSound,
  useOperationSound,
  usePrepareSoundEffects,
} from "@/games/play-sound-effects";
import blockedSoundUrl from "@/games/shuttle-parking/assets/sounds/blocked.flac";
import boarded1SoundUrl from "@/games/shuttle-parking/assets/sounds/boarded-1.flac";
import boarded2SoundUrl from "@/games/shuttle-parking/assets/sounds/boarded-2.flac";
import boarded3SoundUrl from "@/games/shuttle-parking/assets/sounds/boarded-3.flac";
import clearedSoundUrl from "@/games/shuttle-parking/assets/sounds/cleared.flac";
import departedSoundUrl from "@/games/shuttle-parking/assets/sounds/departed.flac";
import exitedSoundUrl from "@/games/shuttle-parking/assets/sounds/exited.flac";
import type { ShuttleParkingExitTimeline } from "@/games/shuttle-parking/play/exit-timeline";
import type { ShuttleParkingOperation } from "@/games/shuttle-parking/play/use-shuttle-parking-play";
import {
  defineSoundEffect,
  playSound,
  REPEATED_SOUND_VARIATION,
  type SoundEffect,
} from "@/lib/audio/sound-effects";
import { prefersReducedMotion } from "@/lib/motion";

const exitedSound = defineSoundEffect(exitedSoundUrl);
const blockedSound = defineSoundEffect(blockedSoundUrl);
/** 乗車は1回の出庫で何人も続くので、3本を順に回して同じ音の繰り返しに聞こえないようにする。 */
const boardedSounds = [
  defineSoundEffect(boarded1SoundUrl),
  defineSoundEffect(boarded2SoundUrl),
  defineSoundEffect(boarded3SoundUrl),
] as const;
const departedSound = defineSoundEffect(departedSoundUrl);
const clearedSound = defineSoundEffect(clearedSoundUrl);

const shuttleParkingSounds: readonly SoundEffect[] = [
  exitedSound,
  blockedSound,
  ...boardedSounds,
  departedSound,
  clearedSound,
];

type TimedSound = { atMs: number; kind: "boarded" | "departed" };

/** 出庫の流れから、乗車1人・出発1台ごとの音の時刻を並べる。人数や座席で音を変えない。 */
function listTimedSounds(timeline: ShuttleParkingExitTimeline): TimedSound[] {
  const sounds: TimedSound[] = [];
  timeline.frames.forEach((frame, index) => {
    const previous = timeline.frames[index - 1];
    if (previous && frame.boardedCount > previous.boardedCount) {
      sounds.push({ atMs: frame.atMs, kind: "boarded" });
    }
    if (frame.departingCarId !== null) {
      sounds.push({ atMs: frame.atMs, kind: "departed" });
    }
  });
  return sounds;
}

/** 最後の車が出発する時刻。クリアの音をこの時刻に合わせ、その出発の音は鳴らさない。 */
function findLastDepartureAtMs(timeline: ShuttleParkingExitTimeline): number {
  return (
    timeline.frames.findLast((frame) => frame.departingCarId !== null)?.atMs ??
    timeline.durationMs
  );
}

/**
 * 盤面操作とクリアの効果音。車が出る音と出られない音は押したときに、乗車と出発の音は動きの時刻ごとに1つずつ鳴らす。
 * 次の車を押すと、まだ鳴らしていない前の出庫の音は鳴らさない（動きも新しい出庫へ移るため）。
 * 動きを減らす設定では、乗車の音を鳴らさず、出発があれば出発の音を1つだけ車が出る音に続けて鳴らす。
 * クリアは最後の車が出発する時刻に合わせて鳴らし、動きを減らす設定では鳴らさない。
 */
export function useShuttleParkingSoundEffects(
  operation: ShuttleParkingOperation | null,
  progress: GameProgress,
): void {
  usePrepareSoundEffects(shuttleParkingSounds);
  const nextBoardedSoundRef = useRef(0);
  const clearing = progress === "clearing";

  useOperationSound(operation, (played) => {
    if (played.type === "blocked") {
      playSound(blockedSound);
      return;
    }
    playSound(exitedSound, { variation: REPEATED_SOUND_VARIATION });
    if (
      prefersReducedMotion() &&
      !clearing &&
      played.timeline.frames.some((frame) => frame.departingCarId !== null)
    ) {
      playSound(departedSound, { variation: REPEATED_SOUND_VARIATION });
    }
  });

  const exited = operation?.type === "exited" ? operation : null;
  useEffect(() => {
    if (exited === null || prefersReducedMotion()) return;
    const elapsedMs = Date.now() - exited.startedAt;
    const lastDepartureAtMs = findLastDepartureAtMs(exited.timeline);
    const timers = listTimedSounds(exited.timeline)
      .filter(({ atMs }) => atMs > elapsedMs)
      .filter(
        ({ atMs, kind }) =>
          !(clearing && kind === "departed" && atMs === lastDepartureAtMs),
      )
      .map(({ atMs, kind }) =>
        window.setTimeout(() => {
          if (kind === "departed") {
            playSound(departedSound, { variation: REPEATED_SOUND_VARIATION });
            return;
          }
          const sound =
            boardedSounds[nextBoardedSoundRef.current % boardedSounds.length];
          nextBoardedSoundRef.current += 1;
          if (sound) {
            playSound(sound, { variation: REPEATED_SOUND_VARIATION });
          }
        }, atMs - elapsedMs),
      );
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [exited, clearing]);

  useClearSound(progress, () => {
    const delayMs =
      exited === null
        ? 0
        : findLastDepartureAtMs(exited.timeline) -
          (Date.now() - exited.startedAt);
    playSound(clearedSound, { delayMs: Math.max(0, delayMs) });
  });
}

export const _private = { listTimedSounds, findLastDepartureAtMs };
