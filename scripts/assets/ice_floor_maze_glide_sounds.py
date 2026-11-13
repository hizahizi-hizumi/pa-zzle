"""アイスフロア迷路の、駒が氷の上を滑り続ける音（frontend/src/games/ice-floor-maze/assets/sounds/glided-*.flac）を書き出す。

滑り出しの音（slid.flac）は滑る距離によらず同じ短い音なので、長く滑る手には、滑っている間じゅう続く擦れの音を重ねる。
素材は使わず、乱数の雑音を氷の擦れの帯域に絞って作る。乱数の種を固定しているので、同じ版の numpy・ffmpeg なら同じ音になる。
ffmpeg が要る。

    uv run --python 3.13 --with numpy==2.5.3 python scripts/assets/ice_floor_maze_glide_sounds.py
"""

from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from numpy.typing import NDArray

REPOSITORY = Path(__file__).resolve().parents[2]
SOUND_DIRECTORY = REPOSITORY / "frontend/src/games/ice-floor-maze/assets/sounds"
SAMPLE_RATE = 48000

Signal = NDArray[np.float64]


@dataclass(frozen=True)
class Glide:
    """`duration`: 音の長さ（秒）。`peak_db`: 最大振幅（dBFS）。滑り出しの音（−25dBFS）より小さくする。"""

    name: str
    duration: float
    peak_db: float
    seed: int


GLIDES = (
    Glide(name="glided-short", duration=0.17, peak_db=-31.0, seed=7091),
    Glide(name="glided-long", duration=0.30, peak_db=-30.0, seed=7092),
)

# 氷を石が擦る、乾いた高い擦れ（3〜8kHz）に、石の重みの低い転がり（120〜320Hz）を少し足す。
HISS_BAND_HZ = (3000.0, 8000.0)
RUMBLE_BAND_HZ = (120.0, 320.0)
RUMBLE_RATIO = 0.35
ATTACK_SECONDS = 0.012
RELEASE_SECONDS = 0.05
# 滑っている間、擦れはわずかに弱まっていく。止まる音の直前で消える。
SUSTAIN_END_RATIO = 0.7


def band_noise(length: int, band_hz: tuple[float, float], random: np.random.Generator) -> Signal:
    spectrum = np.fft.rfft(random.standard_normal(length))
    frequencies = np.fft.rfftfreq(length, 1 / SAMPLE_RATE)
    low, high = band_hz
    edge = (high - low) * 0.25
    gain = np.clip((frequencies - (low - edge)) / edge, 0, 1) * np.clip(((high + edge) - frequencies) / edge, 0, 1)
    return np.fft.irfft(spectrum * gain, length)


def envelope(length: int) -> Signal:
    time = np.arange(length) / SAMPLE_RATE
    duration = length / SAMPLE_RATE
    attack = np.clip(time / ATTACK_SECONDS, 0, 1)
    release = np.clip((duration - time) / RELEASE_SECONDS, 0, 1)
    sustain = np.linspace(1.0, SUSTAIN_END_RATIO, length)
    return attack**2 * release**2 * sustain


def render(glide: Glide) -> Signal:
    length = round(glide.duration * SAMPLE_RATE)
    random = np.random.default_rng(glide.seed)
    hiss = band_noise(length, HISS_BAND_HZ, random)
    rumble = band_noise(length, RUMBLE_BAND_HZ, random)
    signal = (hiss / np.abs(hiss).max() + RUMBLE_RATIO * rumble / np.abs(rumble).max()) * envelope(length)
    return signal / np.abs(signal).max() * 10 ** (glide.peak_db / 20)


def write_flac(signal: Signal, path: Path) -> None:
    """他の効果音と同じ、モノラル・16bit・48kHz の FLAC（PADDING なし）で書き出す。"""
    pcm = np.round(signal * 32767).astype("<i2").tobytes()
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "s16le", "-ar", str(SAMPLE_RATE), "-ac", "1", "-i", "-",
            "-c:a", "flac", "-compression_level", "8", "-map_metadata", "-1", "-bitexact",
            str(path),
        ],
        input=pcm,
        check=True,
    )


def main() -> None:
    for glide in GLIDES:
        write_flac(render(glide), SOUND_DIRECTORY / f"{glide.name}.flac")


if __name__ == "__main__":
    main()
