"""ウォーターソートの効果音のうち、注いだボトルが1色で満杯になったときの音を合成して書き出す。

書き出し先は frontend/src/games/water-sort/assets/sounds/bottle-completed.flac。ほかの音はこのスクリプトでは書き換えない。

- bottle-completed.flac: ガラスの瓶に蓋がはまる短い「コッ」に、上がっていく小さなきらめきの3音を重ねた音。

録音は使わず、蓋は減衰する部分音の和と短い雑音で、きらめきは高めの鐘の部分音で作る。
雑音は種を決めた乱数で作るので、同じ版の numpy・ffmpeg なら同じ音になる。ffmpeg（6.1）が要る。

    uv run --python 3.13 --with numpy==2.5.3 python scripts/assets/water_sort_sounds.py

大きさは、50ms 窓の最大 RMS を、注ぐ泡の音（poured-bubble-1.flac）より一段強く、クリア音（cleared.flac）より弱くする。
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import numpy as np
from numpy.typing import NDArray

REPOSITORY = Path(__file__).resolve().parents[2]
SOUND_DIRECTORY = REPOSITORY / "frontend/src/games/water-sort/assets/sounds"
SAMPLE_RATE = 48000

Signal = NDArray[np.float64]


def seconds(duration: float) -> NDArray[np.float64]:
    return np.arange(int(SAMPLE_RATE * duration)) / SAMPLE_RATE


def lowpass(signal: Signal, cutoff: float) -> Signal:
    """1次の低域通過。"""
    coefficient = np.exp(-2 * np.pi * cutoff / SAMPLE_RATE)
    output = np.empty_like(signal)
    state = 0.0
    for index, value in enumerate(signal):
        state = (1 - coefficient) * value + coefficient * state
        output[index] = state
    return output


def highpass(signal: Signal, cutoff: float) -> Signal:
    return signal - lowpass(signal, cutoff)


def delayed(signal: Signal, delay: float, length: int) -> Signal:
    output = np.zeros(length)
    start = int(SAMPLE_RATE * delay)
    end = min(length, start + len(signal))
    output[start:end] = signal[: end - start]
    return output


def attack(time: NDArray[np.float64], duration: float) -> NDArray[np.float64]:
    return np.minimum(1.0, time / duration)


def cap_click(rng: np.random.Generator) -> Signal:
    """ガラスの瓶の口に蓋がはまる音。瓶の高めの部分音を短く鳴らし、はまった瞬間の乾いた雑音を重ねる。"""
    time = seconds(0.12)
    frequency = 1180.0
    body = (
        np.sin(2 * np.pi * frequency * time) * np.exp(-time / 0.03)
        + 0.6 * np.sin(2 * np.pi * frequency * 2.32 * time) * np.exp(-time / 0.018)
        + 0.35 * np.sin(2 * np.pi * frequency * 3.9 * time) * np.exp(-time / 0.01)
    )
    noise = rng.standard_normal(len(time))
    click = highpass(lowpass(noise, 5200), 900) * np.exp(-time / 0.004)
    return (body + 1.4 * click) * attack(time, 0.0008)


def sparkle(frequency: float, duration: float) -> Signal:
    """きらめきの1音。高めの鐘の部分音を、高いものほど早く減らす。"""
    time = seconds(duration)
    partials = [(1.0, 1.0, 1.0), (2.0, 0.3, 0.5), (3.01, 0.14, 0.3)]
    tone = sum(
        amplitude * np.sin(2 * np.pi * frequency * ratio * time) * np.exp(-time / (0.11 * share))
        for ratio, amplitude, share in partials
    )
    return tone * attack(time, 0.002)


def rms50(signal: Signal) -> float:
    window = int(0.05 * SAMPLE_RATE)
    if len(signal) <= window:
        return float(np.sqrt(np.mean(signal**2)))
    energy = np.convolve(signal**2, np.ones(window) / window, "valid")
    return float(np.sqrt(energy.max()))


def read(name: str) -> Signal:
    output = subprocess.run(
        [
            "ffmpeg", "-loglevel", "error", "-i", str(SOUND_DIRECTORY / f"{name}.flac"),
            "-f", "s16le", "-ac", "1", "-ar", str(SAMPLE_RATE), "-",
        ],
        capture_output=True,
        check=True,
    )
    return np.frombuffer(output.stdout, dtype="<i2").astype(np.float64) / 32768


def write(name: str, signal: Signal) -> None:
    if np.abs(signal).max() >= 1:
        raise ValueError(f"{name} clips")
    samples = np.round(signal * 32767).astype("<i2")
    subprocess.run(
        [
            "ffmpeg", "-loglevel", "error", "-y", "-f", "s16le", "-ar", str(SAMPLE_RATE), "-ac", "1", "-i", "-",
            "-sample_fmt", "s16", "-compression_level", "12", str(SOUND_DIRECTORY / f"{name}.flac"),
        ],
        input=samples.tobytes(),
        check=True,
    )


def main() -> None:
    rng = np.random.default_rng(20261113)
    duration = 0.42
    length = int(SAMPLE_RATE * duration)
    # E6・G#6・B6 を、蓋がはまった直後から 45ms おきに重ねて上がっていく。
    sparkles = sum(
        0.42 * delayed(sparkle(frequency, duration), 0.03 + index * 0.045, length)
        for index, frequency in enumerate([1318.5, 1661.2, 1975.5])
    )
    sound = delayed(cap_click(rng), 0, length) + sparkles
    fade = int(SAMPLE_RATE * 0.05)
    sound[-fade:] *= np.linspace(1, 0, fade) ** 2

    poured = rms50(read("poured-bubble-1"))
    cleared = rms50(read("cleared"))
    # 2つの音の大きさの、dB で 1/3 だけクリア音に寄せた大きさにする。
    target = poured * (cleared / poured) ** (1 / 3)
    write("bottle-completed", sound / rms50(sound) * target)


if __name__ == "__main__":
    main()
