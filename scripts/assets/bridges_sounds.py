"""ブリッジパズルの効果音のうち、橋を架ける・重ねる・外す・阻まれた音と、全島が灯り切ったときの和音を合成して書き出す。

書き出し先は frontend/src/games/bridges/assets/sounds/ の次の5つ。島が灯る段ごとの音（cleared-light-*.flac）はこのスクリプトでは書き換えない。

- bridge-placed.flac: 1本目の板が相手の島に着く、木の1打。
- bridge-doubled.flac: 2本目の板が着く、木の2打。2打目は1打目より5半音高くし、1本目と形でも高さでも聞き分けられるようにする。
- bridge-removed.flac: 外した板が水に落ちる、小さな水の音。
- blocked.flac: 板が阻んだ橋に当たる、鈍い木の音。
- cleared-chord.flac: ド・ミ・ソの鐘の和音に、寄せて返す波の層を重ねた音。

録音は使わず、木の板と鐘は減衰する部分音の和で、水の音は高さの上がる泡と、低くこもった雑音で作る。
雑音は種を決めた乱数で作るので、同じ版の numpy・ffmpeg なら同じ音になる。ffmpeg（6.1）が要る。

    uv run --python 3.13 --with numpy==2.5.3 python scripts/assets/bridges_sounds.py

大きさは、50ms 窓の最大 RMS を、同じ役割の今の音（ほかのゲームの同じ頻度の操作の音にそろえた値）に合わせる。
"""

from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from numpy.typing import NDArray

REPOSITORY = Path(__file__).resolve().parents[2]
SOUND_DIRECTORY = REPOSITORY / "frontend/src/games/bridges/assets/sounds"
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


def wood_knock(frequency: float, decay: float, rng: np.random.Generator, brightness: float = 1.0) -> Signal:
    """木の板を軽く打った音。板の部分音（1・2.6・4.3 倍）を短く減らし、打った瞬間の乾いた雑音を重ねる。"""
    time = seconds(0.09)
    body = (
        np.sin(2 * np.pi * frequency * time) * np.exp(-time / decay)
        + 0.5 * brightness * np.sin(2 * np.pi * frequency * 2.6 * time) * np.exp(-time / (decay * 0.45))
        + 0.22 * brightness * np.sin(2 * np.pi * frequency * 4.3 * time) * np.exp(-time / (decay * 0.25))
    )
    noise = rng.standard_normal(len(time))
    click = highpass(lowpass(lowpass(noise, 2400 * brightness), 2400 * brightness), 400) * np.exp(-time / 0.003)
    return (body + 1.2 * click) * attack(time, 0.0012)


def water_plop(rng: np.random.Generator) -> Signal:
    """小さなものが水に落ちる音。水面を打つこもった雑音のあとに、高さの上がる泡を鳴らす。"""
    time = seconds(0.11)
    splash = lowpass(highpass(rng.standard_normal(len(time)), 300), 2200) * np.exp(-time / 0.012)
    bubble_time = time - 0.012
    pitch = 420 * np.exp(np.clip(bubble_time, 0, None) / 0.05)
    phase = 2 * np.pi * np.cumsum(np.where(bubble_time > 0, pitch, 0)) / SAMPLE_RATE
    bubble = np.where(bubble_time > 0, np.sin(phase) * np.exp(-np.clip(bubble_time, 0, None) / 0.03), 0)
    bubble *= attack(np.clip(bubble_time, 0, None), 0.003)
    return 0.55 * splash + bubble


def dull_thud(rng: np.random.Generator) -> Signal:
    """木と木が鈍く当たる音。低い胴鳴りを短く減らし、こもった当たりの雑音を重ねる。"""
    time = seconds(0.12)
    body = np.sin(2 * np.pi * 165 * time) * np.exp(-time / 0.03) + 0.45 * np.sin(
        2 * np.pi * 165 * 2.3 * time
    ) * np.exp(-time / 0.014)
    knock = lowpass(rng.standard_normal(len(time)), 900) * np.exp(-time / 0.01)
    return lowpass(body + 1.4 * knock, 2500) * attack(time, 0.002)


def bell(frequency: float, duration: float, decay: float) -> Signal:
    """鐘の音。基音と、鐘らしい高めの部分音（2・2.76・5.4 倍）を、高いものほど早く減らす。"""
    time = seconds(duration)
    partials = [(1.0, 1.0, 1.0), (2.0, 0.35, 0.55), (2.76, 0.22, 0.35), (5.4, 0.08, 0.15)]
    tone = sum(
        amplitude * np.sin(2 * np.pi * frequency * ratio * time) * np.exp(-time / (decay * share))
        for ratio, amplitude, share in partials
    )
    return tone * attack(time, 0.002)


def wave_wash(duration: float, rng: np.random.Generator) -> Signal:
    """浜に寄せて返す波。低くこもった雑音を、ゆっくり膨らませてから引かせる。"""
    time = seconds(duration)
    noise = lowpass(lowpass(highpass(rng.standard_normal(len(time)), 120), 900), 1400)
    swell = np.sin(np.pi * np.clip(time / duration, 0, 1)) ** 1.6
    return noise * swell


def rms50(signal: Signal) -> float:
    window = int(0.05 * SAMPLE_RATE)
    if len(signal) <= window:
        return float(np.sqrt(np.mean(signal**2)))
    energy = np.convolve(signal**2, np.ones(window) / window, "valid")
    return float(np.sqrt(energy.max()))


@dataclass(frozen=True)
class Finish:
    """書き出す前の仕上げ。`rms50_db` は 50ms 窓の最大 RMS（dBFS）、`fade_ms` は終わりを消す長さ。"""

    rms50_db: float
    fade_ms: float = 8


def finish(signal: Signal, settings: Finish) -> Signal:
    fade = int(SAMPLE_RATE * settings.fade_ms / 1000)
    shaped = signal.copy()
    shaped[-fade:] *= np.linspace(1, 0, fade) ** 2
    return shaped / rms50(shaped) * 10 ** (settings.rms50_db / 20)


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
    rng = np.random.default_rng(20261111)
    placed_pitch = 392.0
    doubled_pitch = placed_pitch * 2 ** (5 / 12)

    placed = wood_knock(placed_pitch, 0.02, rng)
    write("bridge-placed", finish(placed, Finish(rms50_db=-37.0)))

    length = int(SAMPLE_RATE * 0.15)
    doubled = delayed(wood_knock(placed_pitch, 0.018, rng), 0, length) + 0.9 * delayed(
        wood_knock(doubled_pitch, 0.02, rng), 0.06, length
    )
    write("bridge-doubled", finish(doubled, Finish(rms50_db=-37.0)))

    write("bridge-removed", finish(water_plop(rng), Finish(rms50_db=-38.5)))
    write("blocked", finish(dull_thud(rng), Finish(rms50_db=-35.5)))

    duration = 1.0
    length = int(SAMPLE_RATE * duration)
    chord = (
        0.55 * bell(523.25, duration, 0.5)
        + bell(1046.5, duration, 0.42)
        + 0.8 * bell(1318.5, duration, 0.36)
        + 0.7 * bell(1567.98, duration, 0.32)
    )
    waves = delayed(wave_wash(0.85, rng), 0.05, length)
    chord = chord / np.abs(chord).max() + 0.32 * waves / np.abs(waves).max()
    write("cleared-chord", finish(chord, Finish(rms50_db=-28.3, fade_ms=60)))


if __name__ == "__main__":
    main()
