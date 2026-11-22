import glassTink1SoundUrl from "@/games/water-sort/assets/sounds/ideas/lab/glass-tink-1.flac";
import glassTink2SoundUrl from "@/games/water-sort/assets/sounds/ideas/lab/glass-tink-2.flac";
import pourTrickleSoundUrl from "@/games/water-sort/assets/sounds/ideas/lab/pour-trickle.flac";
import rackChimeSoundUrl from "@/games/water-sort/assets/sounds/ideas/lab/rack-chime.flac";
import stopperSqueakSoundUrl from "@/games/water-sort/assets/sounds/ideas/lab/stopper-squeak.flac";
import tubeLiftSoundUrl from "@/games/water-sort/assets/sounds/ideas/lab/tube-lift.flac";
import tubeRattleSoundUrl from "@/games/water-sort/assets/sounds/ideas/lab/tube-rattle.flac";
import { defineSoundEffect, type SoundEffect } from "@/lib/audio/sound-effects";

/** 口と口が触れ合うガラスの高い音。続けて注いでも同じ音が並ばないよう2つを交互に使う。 */
export const glassTinkSounds = [
  defineSoundEffect(glassTink1SoundUrl),
  defineSoundEffect(glassTink2SoundUrl),
] as const;
/** 細い口から試験管へ流れ込む音。満ちるほど管の響きが高くなる。 */
export const pourTrickleSound = defineSoundEffect(pourTrickleSoundUrl);
/** ゴム栓がきゅっと入る音。 */
export const stopperSqueakSound = defineSoundEffect(stopperSqueakSoundUrl);
/** 試験管立ての穴から試験管を抜く、ガラスと木の触れる音。 */
export const tubeLiftSound = defineSoundEffect(tubeLiftSoundUrl);
/** 注げない試験管が試験管立ての中でかたかた揺れる音。 */
export const tubeRattleSound = defineSoundEffect(tubeRattleSoundUrl);
/** 栓をした試験管どうしが試験管立ての中で鳴り合う音。 */
export const rackChimeSound = defineSoundEffect(rackChimeSoundUrl);

export const labSounds: readonly SoundEffect[] = [
  ...glassTinkSounds,
  pourTrickleSound,
  stopperSqueakSound,
  tubeLiftSound,
  tubeRattleSound,
  rackChimeSound,
];
