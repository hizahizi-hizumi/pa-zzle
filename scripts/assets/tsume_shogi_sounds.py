"""詰将棋の効果音（frontend/src/games/tsume-shogi/assets/sounds/*.flac）を、VCSL の録音を加工して書き出す。

素材は sgossner/VCSL（CC0 1.0）のコミット c1ea7bcc の、スラップスティック・カホンの録音。
出典と加工の手順は、書き出し先の `VCSL.CC0.txt` にある。録音はリポジトリに同梱しないので、次のように取り出して、
そのディレクトリを渡す。ffmpeg（6.1）が要る。

    git clone --filter=blob:none --no-checkout https://github.com/sgossner/VCSL.git vcsl
    git -C vcsl checkout c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e -- \\
        "Idiophones/Struck Idiophones/Slapstick" "Idiophones/Struck Idiophones/Cajon"
    uv run --python 3.13 --with numpy==2.5.3 --with scipy==1.18.1 \\
        python scripts/assets/tsume_shogi_sounds.py --vcsl vcsl

録音は SHA-256 で確かめ、食い違えば書き出さずに止める。乱数は使わないので、同じ版の numpy・scipy・ffmpeg なら同じ音になる。
"""

from __future__ import annotations

import argparse
import hashlib
import subprocess
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from numpy.typing import NDArray
from scipy.signal import butter, lfilter, sosfilt

REPOSITORY = Path(__file__).resolve().parents[2]
SOUND_DIRECTORY = REPOSITORY / "frontend/src/games/tsume-shogi/assets/sounds"
SAMPLE_RATE = 48000

Signal = NDArray[np.float64]

RECORDINGS = {
    "slapstick_quiet_rr1": ("Slapstick", "e183168c1b9085ba2ab922e9e93eecbfc8f37a43803634827f37826cbe773325"),
    "slapstick_quiet_rr2": ("Slapstick", "d16ad5182b72ff6ab409d5cf9538a3086132f524d896998d5dfc694ccbf01fa8"),
    "slapstick_rr1": ("Slapstick", "e73b38bf43b385d95e2c790e7424526a91af8d1cdf484002912a4a8eabe73300"),
    "Cajon_hit2_f_rr1": ("Cajon", "ad85e345189439370fb54676813affba0e46f5d9f502aa63e995a2ea7a831960"),
    "Cajon_hit2_f_rr2": ("Cajon", "263ecb8dd1789dd67ad00e1383d04b052c3177af6d6e98fc32c34c896e55a868"),
    "Cajon_hit3_mp_rr1": ("Cajon", "9ec7c1b08b7e93a7f117a752ae168e23824a7d6e88e36c9d9e20f4b6672542b0"),
}


@dataclass(frozen=True)
class Finish:
    """書き出す前の仕上げ。`loudness` は 400ms 窓の最大ラウドネス（LUFS）で、他のゲームの同じ役割の音にそろえた値。"""

    loudness: float
    floor_db: float
    fade_ms: float


HIT_FINISH = Finish(loudness=-46.5, floor_db=-62, fade_ms=20)
REPLY_FINISH = Finish(loudness=-49.5, floor_db=-60, fade_ms=20)
FINISHES = {
    "piece-moved": HIT_FINISH,
    "piece-moved-2": HIT_FINISH,
    "piece-moved-3": HIT_FINISH,
    "piece-replied": REPLY_FINISH,
    "piece-replied-2": REPLY_FINISH,
    "rejected": Finish(loudness=-50.5, floor_db=-50, fade_ms=12),
    "refuted": Finish(loudness=-40.4, floor_db=-60, fade_ms=40),
}


def samples(ms: float) -> int:
    return int(ms / 1000 * SAMPLE_RATE)


def high_pass(signal: Signal, frequency: float) -> Signal:
    return sosfilt(butter(2, frequency, "highpass", fs=SAMPLE_RATE, output="sos"), signal)


def low_pass(signal: Signal, frequency: float) -> Signal:
    return sosfilt(butter(2, frequency, "lowpass", fs=SAMPLE_RATE, output="sos"), signal)


def peaking(signal: Signal, frequency: float, gain_db: float, q: float) -> Signal:
    amplitude = 10 ** (gain_db / 40)
    omega = 2 * np.pi * frequency / SAMPLE_RATE
    alpha = np.sin(omega) / (2 * q)
    b = [1 + alpha * amplitude, -2 * np.cos(omega), 1 - alpha * amplitude]
    a = [1 + alpha / amplitude, -2 * np.cos(omega), 1 - alpha / amplitude]
    return lfilter(np.array(b) / a[0], np.array(a) / a[0], signal)


def shelf(signal: Signal, frequency: float, gain_db: float, *, high: bool, slope: float = 0.8) -> Signal:
    amplitude = 10 ** (gain_db / 40)
    omega = 2 * np.pi * frequency / SAMPLE_RATE
    cos, sin = np.cos(omega), np.sin(omega)
    alpha = sin / 2 * np.sqrt((amplitude + 1 / amplitude) * (1 / slope - 1) + 2)
    k = 2 * np.sqrt(amplitude) * alpha
    if high:
        b = [
            amplitude * ((amplitude + 1) + (amplitude - 1) * cos + k),
            -2 * amplitude * ((amplitude - 1) + (amplitude + 1) * cos),
            amplitude * ((amplitude + 1) + (amplitude - 1) * cos - k),
        ]
        a = [
            (amplitude + 1) - (amplitude - 1) * cos + k,
            2 * ((amplitude - 1) - (amplitude + 1) * cos),
            (amplitude + 1) - (amplitude - 1) * cos - k,
        ]
    else:
        b = [
            amplitude * ((amplitude + 1) - (amplitude - 1) * cos + k),
            2 * amplitude * ((amplitude - 1) - (amplitude + 1) * cos),
            amplitude * ((amplitude + 1) - (amplitude - 1) * cos - k),
        ]
        a = [
            (amplitude + 1) + (amplitude - 1) * cos + k,
            -2 * ((amplitude - 1) + (amplitude + 1) * cos),
            (amplitude + 1) + (amplitude - 1) * cos - k,
        ]
    return lfilter(np.array(b) / a[0], np.array(a) / a[0], signal)


def cut(signal: Signal, length_ms: float, fade_ms: float) -> Signal:
    """先頭から `length_ms` で切り、最後の `fade_ms` を cos² で閉じる。"""
    result = signal[: samples(length_ms)].copy()
    fade = min(samples(fade_ms), len(result))
    result[-fade:] *= np.cos(np.linspace(0, np.pi / 2, fade)) ** 2
    return result


def decay(signal: Signal, time_constant_ms: float) -> Signal:
    return signal * np.exp(-np.arange(len(signal)) / (time_constant_ms / 1000 * SAMPLE_RATE))


def mix(*layers: tuple[Signal, float, float]) -> Signal:
    """（音, 音量 dB, 鳴り始め ms）を重ねる。"""
    length = max(samples(offset_ms) + len(signal) for signal, _, offset_ms in layers)
    result = np.zeros(length)
    for signal, gain_db, offset_ms in layers:
        start = samples(offset_ms)
        result[start : start + len(signal)] += signal * 10 ** (gain_db / 20)
    return result


def k_weight(signal: Signal) -> Signal:
    """ITU-R BS.1770 の K 特性（高域の棚と 38Hz の高域通過）。係数は RBJ の式で求める。"""
    shelf_amplitude = 10 ** (4.0 / 40)
    omega = 2 * np.pi * (1500.0 / SAMPLE_RATE)
    alpha = np.sin(omega) / (2 * (1 / np.sqrt(2)))
    root = 2 * np.sqrt(shelf_amplitude) * alpha
    a0 = (shelf_amplitude + 1) - (shelf_amplitude - 1) * np.cos(omega) + root
    shelf_b = np.array(
        [
            shelf_amplitude * ((shelf_amplitude + 1) + (shelf_amplitude - 1) * np.cos(omega) + root),
            -2 * shelf_amplitude * ((shelf_amplitude - 1) + (shelf_amplitude + 1) * np.cos(omega)),
            shelf_amplitude * ((shelf_amplitude + 1) + (shelf_amplitude - 1) * np.cos(omega) - root),
        ]
    )
    shelf_a = np.array(
        [
            a0,
            2 * ((shelf_amplitude - 1) - (shelf_amplitude + 1) * np.cos(omega)),
            (shelf_amplitude + 1) - (shelf_amplitude - 1) * np.cos(omega) - root,
        ]
    )
    omega = 2 * np.pi * (38.0 / SAMPLE_RATE)
    alpha = np.sin(omega) / (2 * 0.5)
    pass_b = np.array([(1 + np.cos(omega)) / 2, -(1 + np.cos(omega)), (1 + np.cos(omega)) / 2])
    pass_a = np.array([1 + alpha, -2 * np.cos(omega), 1 - alpha])
    shelved = lfilter(shelf_b / a0, shelf_a / a0, signal)
    return lfilter(pass_b / pass_a[0], pass_a / pass_a[0], shelved)


def momentary_loudness(signal: Signal) -> float:
    """400ms 窓の最大ラウドネス（LUFS）。短い音でも窓が収まるよう、前後に無音を足して測る。"""
    silence = np.zeros(samples(400))
    weighted = k_weight(np.concatenate([silence, signal, silence]))
    window = samples(400)
    energy = np.concatenate([[0], np.cumsum(weighted**2)])
    return -0.691 + 10 * np.log10(((energy[window:] - energy[:-window]) / window).max() + 1e-15)


def finish(signal: Signal, settings: Finish) -> Signal:
    """大きさをそろえ、ピークから `floor_db` 下がったところで切って `fade_ms` で閉じ、鳴り始めの前の無音を詰める。"""
    padded = np.r_[signal, np.zeros(samples(30))]
    result = padded * 10 ** ((settings.loudness - momentary_loudness(padded)) / 20)
    window = samples(2)
    envelope = np.sqrt(np.convolve(result**2, np.ones(window) / window, "same"))
    peak = envelope.argmax()
    below_floor = np.where(envelope[peak:] < envelope[peak] * 10 ** (settings.floor_db / 20))[0]
    fade = samples(settings.fade_ms)
    end = min(len(result), peak + (below_floor[0] if len(below_floor) else len(result)) + fade)
    result = result[:end].copy()
    fade = min(fade, len(result))
    result[-fade:] *= np.cos(np.linspace(0, np.pi / 2, fade)) ** 2
    magnitude = np.abs(result)
    start = max(0, np.argmax(magnitude > magnitude.max() * 10 ** (-50 / 20)) - samples(0.5))
    result = result[start:]
    return result * 10 ** ((settings.loudness - momentary_loudness(result)) / 20)


class Recordings:
    """VCSL の録音を、48kHz のモノラルにして、低域の揺れを除き、打った瞬間から始まる、ピークが 1 の音として読む。"""

    def __init__(self, vcsl: Path) -> None:
        self.vcsl = vcsl

    def __getitem__(self, name: str) -> Signal:
        instrument, digest = RECORDINGS[name]
        path = self.vcsl / "Idiophones/Struck Idiophones" / instrument / f"{name}.wav"
        if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise SystemExit(f"録音が VCSL c1ea7bcc のものと違う: {path}")
        decoded = subprocess.run(
            [
                "ffmpeg",
                "-nostdin",
                "-v",
                "error",
                "-i",
                str(path),
                "-ac",
                "1",
                "-ar",
                str(SAMPLE_RATE),
                "-f",
                "f32le",
                "-",
            ],
            check=True,
            capture_output=True,
        ).stdout
        signal = high_pass(high_pass(np.frombuffer(decoded, dtype="<f4").astype(np.float64), 45), 45)
        magnitude = np.abs(signal)
        onset = np.argmax(magnitude > magnitude.max() * 10 ** (-30 / 20))
        return signal[max(0, onset - samples(0.6)) :] / (magnitude.max() + 1e-12)


def piece_hit(slapstick: Signal, cajon: Signal, cajon_db: float = -17) -> Signal:
    """駒を打つ音。スラップスティックの「パシッ」の下に、カホンの胴の鳴りを 110〜900Hz に絞って重ねる。"""
    body = cut(high_pass(low_pass(cajon, 900), 110), 140, 50)
    return mix((cut(slapstick, 160, 40), 0, 0), (body, cajon_db, 0.4))


def operation_sounds(recordings: Recordings) -> dict[str, Signal]:
    quiet_1, quiet_2 = recordings["slapstick_quiet_rr1"], recordings["slapstick_quiet_rr2"]
    full = recordings["slapstick_rr1"]
    cajon_f_1, cajon_f_2 = recordings["Cajon_hit2_f_rr1"], recordings["Cajon_hit2_f_rr2"]
    cajon_mp = recordings["Cajon_hit3_mp_rr1"]
    moved = piece_hit(quiet_1, cajon_f_1)
    rejected = high_pass(quiet_1, 160)
    rejected = low_pass(low_pass(rejected, 1500), 1500)
    rejected = decay(peaking(rejected, 700, 2, 1.0), 35)
    return {
        "piece-moved": moved,
        "piece-moved-2": piece_hit(quiet_2, cajon_f_2),
        "piece-moved-3": piece_hit(cut(full, 120, 40), cajon_mp, -16),
        "piece-replied": shelf(piece_hit(quiet_2, cajon_mp, -18), 3500, -3.0, high=True),
        "piece-replied-2": shelf(piece_hit(quiet_1, cajon_f_2, -18), 3500, -3.0, high=True),
        "rejected": rejected,
        "refuted": mix((moved, 0, 0), (low_pass(low_pass(cajon_f_1, 500), 500), -2, 2)),
    }


def without_padding(flac: bytes) -> bytes:
    """FLAC のメタデータから PADDING のブロックを外す。ffmpeg の FLAC は 8KB の PADDING を書くため。"""
    position = 4
    blocks: list[bytearray] = []
    while True:
        header = flac[position]
        length = int.from_bytes(flac[position + 1 : position + 4], "big")
        if header & 0x7F != 1:
            blocks.append(bytearray(flac[position : position + 4 + length]))
        position += 4 + length
        if header & 0x80:
            break
    for block in blocks:
        block[0] &= 0x7F
    blocks[-1][0] |= 0x80
    return flac[:4] + b"".join(blocks) + flac[position:]


def write_flac(path: Path, signal: Signal) -> None:
    """16bit の FLAC にする。STREAMINFO に長さと MD5 を書き戻せるよう、ffmpeg にはパイプではなくファイルへ書かせる。"""
    if np.abs(signal).max() >= 0.95:
        raise SystemExit(f"ピークが大きすぎる: {path.name}")
    subprocess.run(
        [
            "ffmpeg",
            "-nostdin",
            "-v",
            "error",
            "-y",
            "-f",
            "f32le",
            "-ar",
            str(SAMPLE_RATE),
            "-ac",
            "1",
            "-i",
            "-",
            "-c:a",
            "flac",
            "-sample_fmt",
            "s16",
            str(path),
        ],
        input=signal.astype("<f4").tobytes(),
        check=True,
    )
    path.write_bytes(without_padding(path.read_bytes()))


def write_sounds(sounds: dict[str, Signal], directory: Path) -> None:
    for name, sound in sounds.items():
        write_flac(directory / f"{name}.flac", finish(sound, FINISHES[name]))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--vcsl", type=Path, required=True, help="sgossner/VCSL を c1ea7bcc で取り出したディレクトリ")
    parser.add_argument(
        "--output", type=Path, default=SOUND_DIRECTORY, help="書き出し先（既定は詰将棋の効果音のディレクトリ）"
    )
    arguments = parser.parse_args()

    recordings = Recordings(arguments.vcsl)
    write_sounds(operation_sounds(recordings), arguments.output)


if __name__ == "__main__":
    main()
