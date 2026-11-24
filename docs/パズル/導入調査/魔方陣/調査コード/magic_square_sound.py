"""魔方陣の音の観点: 同梱している効果音（frontend/src/**/*.flac）の本数・大きさ・長さ・音の大きさを測る。

アプリはタイトルで、`frontend/src/frontend.tsx` の `import.meta.glob("./**/*.flac")` が拾う FLAC をすべて読み込んでから
入る（ADR-0011・SPEC-005）。新しいゲームの効果音の本数と合計の大きさは、その待ちに足される。ここでは、
今の FLAC を同じ範囲で拾い、ゲームごと・役割ごとに次を測る。

- ファイルの大きさ（バイト）と、メタデータの種類（PADDING が残っていないか）
- 形式（チャンネル数・ビット数・標本化周波数）と長さ（秒）
- ピーク（dBFS）
- 50ms 窓の最大 RMS（dBFS）: `scripts/assets/bridges_sounds.py` の `rms50` と同じ定義
- 400ms 窓の最大ラウドネス（LUFS）: `scripts/assets/tsume_shogi_sounds.py` の `momentary_loudness` と同じ定義

FLAC は標準ライブラリだけで復号する。復号した標本は STREAMINFO の MD5 と突き合わせ、合わなければ止める。
乱数は使わない。最後に、魔方陣の効果音の案ごとの本数と合計の大きさを、測った役割ごとの値から見積もる（見積もりは計測ではない）。

    python3 docs/パズル/導入調査/魔方陣/調査コード/magic_square_sound.py [--root <リポジトリのルート>]
"""

from __future__ import annotations

import argparse
import hashlib
import math
import statistics
import sys
from array import array
from dataclasses import dataclass
from fnmatch import fnmatch
from pathlib import Path

DEFAULT_ROOT = Path(__file__).resolve().parents[5]

# 役割。名前は DESIGN.md「効果音を鳴らすとき」「効果音の強さ」の段に合わせる。
ROLE_OPERATION = "操作の成立"
ROLE_BLOCKED = "不成立"
ROLE_MISTAKE = "ミスとして数える操作"
ROLE_CLEAR = "クリア"
ROLE_APP = "アプリ"

# (ゲームのディレクトリ, ファイル名の型, 役割, 盤面に物を置く操作か)。上から順に最初に合ったものを使う。
# 役割は各ゲームの `ui/use-<game>-sound-effects.ts` の使い方と、パズル仕様（docs/プロダクト/パズル/）でミスに数えるかから読んだ。
ROLE_TABLE: list[tuple[str, str, str, bool]] = [
    ("(app)", "*", ROLE_APP, False),
    ("*", "cleared*", ROLE_CLEAR, False),
    ("*", "clear-note-*", ROLE_CLEAR, False),
    ("nanpure", "mistake-entered", ROLE_MISTAKE, False),
    ("minesweeper", "mine-stepped", ROLE_MISTAKE, False),
    ("tsume-shogi", "refuted", ROLE_MISTAKE, False),
    # パーキングジャムは出られない手をミスに数える（PZL-007 のチュートリアルの節）。
    ("parking-jam", "blocked", ROLE_MISTAKE, False),
    ("*", "blocked", ROLE_BLOCKED, False),
    ("*", "invalid", ROLE_BLOCKED, False),
    ("tsume-shogi", "rejected", ROLE_BLOCKED, False),
    ("nanpure", "digit-entered", ROLE_OPERATION, True),
    ("takuzu", "tile-?-placed", ROLE_OPERATION, True),
    ("reflection", "piece-placed", ROLE_OPERATION, True),
    ("bridges", "bridge-placed", ROLE_OPERATION, True),
    ("minesweeper", "flag-placed", ROLE_OPERATION, True),
    ("*", "*", ROLE_OPERATION, False),
]

# 案ごとの音。(名前, 役割, 見積もりに使う既存の音の型)。大きさは、型に合う既存の音の中央値と置いて見積もる。
PlanSound = tuple[str, str, str]
PLACE_LIKE = "place-like"
CLEAR_STEP = "clear-step"
CLEAR_FINAL = "clear-final"
PLANS: dict[str, list[PlanSound]] = {
    "最小（置く・クリア1本）": [
        ("置く", ROLE_OPERATION, PLACE_LIKE),
        ("クリア", ROLE_CLEAR, CLEAR_FINAL),
    ],
    "段を1本にする（置く・不成立・段の1本を高さを変えて3回・仕上げ）": [
        ("置く", ROLE_OPERATION, PLACE_LIKE),
        ("不成立", ROLE_BLOCKED, ROLE_BLOCKED),
        ("クリアの段", ROLE_CLEAR, CLEAR_STEP),
        ("クリアの仕上げ", ROLE_CLEAR, CLEAR_FINAL),
    ],
    "推奨（置く・不成立・クリアの3方向の段と仕上げ）": [
        ("置く", ROLE_OPERATION, PLACE_LIKE),
        ("不成立", ROLE_BLOCKED, ROLE_BLOCKED),
        ("クリアの段（行）", ROLE_CLEAR, CLEAR_STEP),
        ("クリアの段（列）", ROLE_CLEAR, CLEAR_STEP),
        ("クリアの段（斜め）", ROLE_CLEAR, CLEAR_STEP),
        ("クリアの仕上げ", ROLE_CLEAR, CLEAR_FINAL),
    ],
    "多い（推奨に、列がそろう音と、ミスとして数える外す音を足す）": [
        ("置く", ROLE_OPERATION, PLACE_LIKE),
        ("列がそろう", ROLE_OPERATION, PLACE_LIKE),
        ("ミスとして数える外す", ROLE_MISTAKE, ROLE_MISTAKE),
        ("不成立", ROLE_BLOCKED, ROLE_BLOCKED),
        ("クリアの段（行）", ROLE_CLEAR, CLEAR_STEP),
        ("クリアの段（列）", ROLE_CLEAR, CLEAR_STEP),
        ("クリアの段（斜め）", ROLE_CLEAR, CLEAR_STEP),
        ("クリアの仕上げ", ROLE_CLEAR, CLEAR_FINAL),
    ],
}

# 転送時間の計算に使う帯域（bit/s）。計測ではなく、仮定の帯域での割り算。HTTP の往復や同時接続の数は含めない。
ASSUMED_BANDWIDTHS = [("400kbps", 400_000), ("1.6Mbps", 1_600_000), ("10Mbps", 10_000_000)]
# `frontend/src/lib/app-launch.ts` の `SOUND_LOADING_LIMIT_MS`。
SOUND_LOADING_LIMIT_S = 4.0


class FlacError(ValueError):
    pass


class BitReader:
    def __init__(self, data: bytes, byte_position: int) -> None:
        self.data = data
        self.pos = byte_position * 8

    def read(self, count: int) -> int:
        if count == 0:
            return 0
        position = self.pos
        start = position >> 3
        offset = position & 7
        length = (offset + count + 7) >> 3
        chunk = int.from_bytes(self.data[start : start + length], "big")
        self.pos = position + count
        return (chunk >> (length * 8 - offset - count)) & ((1 << count) - 1)

    def read_signed(self, count: int) -> int:
        if count == 0:
            return 0
        value = self.read(count)
        if value & (1 << (count - 1)):
            value -= 1 << count
        return value

    def read_unary(self) -> int:
        """1 が来るまでの 0 の数。"""
        data = self.data
        index = self.pos >> 3
        offset = self.pos & 7
        current = data[index] & (0xFF >> offset)
        zeros = 0
        while current == 0:
            zeros += 8 - offset
            offset = 0
            index += 1
            current = data[index]
        lead = 8 - current.bit_length()
        zeros += lead - offset
        self.pos = (index << 3) + lead + 1
        return zeros

    def read_rice(self, count: int, parameter: int, out: list[int]) -> None:
        data = self.data
        position = self.pos
        mask = (1 << parameter) - 1
        append = out.append
        for _ in range(count):
            index = position >> 3
            offset = position & 7
            current = data[index] & (0xFF >> offset)
            quotient = 0
            while current == 0:
                quotient += 8 - offset
                offset = 0
                index += 1
                current = data[index]
            lead = 8 - current.bit_length()
            quotient += lead - offset
            position = (index << 3) + lead + 1
            if parameter:
                start = position >> 3
                bit = position & 7
                length = (bit + parameter + 7) >> 3
                chunk = int.from_bytes(data[start : start + length], "big")
                value = (quotient << parameter) | ((chunk >> (length * 8 - bit - parameter)) & mask)
                position += parameter
            else:
                value = quotient
            append((value >> 1) ^ -(value & 1))
        self.pos = position

    def align(self) -> None:
        self.pos = (self.pos + 7) & ~7


@dataclass(frozen=True)
class FlacAudio:
    sample_rate: int
    channels: int
    bits_per_sample: int
    total_samples: int
    md5_matches: bool | None
    metadata_types: tuple[str, ...]
    padding_bytes: int
    audio_offset: int
    samples: list[list[int]]


METADATA_NAMES = {0: "STREAMINFO", 1: "PADDING", 2: "APPLICATION", 3: "SEEKTABLE", 4: "VORBIS_COMMENT", 5: "CUESHEET", 6: "PICTURE"}
SAMPLE_RATES = {1: 88200, 2: 176400, 3: 192000, 4: 8000, 5: 16000, 6: 22050, 7: 24000, 8: 32000, 9: 44100, 10: 48000, 11: 96000}
SAMPLE_SIZES = {1: 8, 2: 12, 4: 16, 5: 20, 6: 24, 7: 32}


def decode_flac(data: bytes) -> FlacAudio:
    if data[:4] != b"fLaC":
        raise FlacError("fLaC で始まらない")
    position = 4
    metadata: list[str] = []
    padding_bytes = 0
    sample_rate = channels = bits = total = 0
    md5 = b""
    while True:
        header = data[position]
        block_type = header & 0x7F
        length = int.from_bytes(data[position + 1 : position + 4], "big")
        body = data[position + 4 : position + 4 + length]
        metadata.append(METADATA_NAMES.get(block_type, f"TYPE{block_type}"))
        if block_type == 1:
            padding_bytes += 4 + length
        if block_type == 0:
            packed = int.from_bytes(body[10:18], "big")
            sample_rate = packed >> 44
            channels = ((packed >> 41) & 0x7) + 1
            bits = ((packed >> 36) & 0x1F) + 1
            total = packed & ((1 << 36) - 1)
            md5 = body[18:34]
        position += 4 + length
        if header & 0x80:
            break
    audio_offset = position
    reader = BitReader(data, position)
    decoded: list[list[int]] = [[] for _ in range(channels)]
    while (reader.pos >> 3) + 2 < len(data):
        decode_frame(reader, sample_rate, bits, decoded)
    decoded_total = len(decoded[0])
    if total and decoded_total != total:
        raise FlacError(f"標本の数が STREAMINFO と合わない: {decoded_total} != {total}")
    md5_matches: bool | None = None
    if any(md5):
        md5_matches = audio_md5(decoded, bits) == md5
        if not md5_matches:
            raise FlacError("復号した標本の MD5 が STREAMINFO と合わない")
    return FlacAudio(
        sample_rate=sample_rate,
        channels=channels,
        bits_per_sample=bits,
        total_samples=decoded_total,
        md5_matches=md5_matches,
        metadata_types=tuple(metadata),
        padding_bytes=padding_bytes,
        audio_offset=audio_offset,
        samples=decoded,
    )


def audio_md5(channels: list[list[int]], bits: int) -> bytes:
    """FLAC の MD5 は、チャンネルを交互に並べた標本を、ビット数を切り上げたバイト幅の符号付きリトルエンディアンで並べたもの。"""
    width = (bits + 7) // 8
    interleaved = [sample for frame in zip(*channels, strict=True) for sample in frame]
    if width == 2:
        packed = array("h", interleaved)
        if sys.byteorder == "big":
            packed.byteswap()
        return hashlib.md5(packed.tobytes()).digest()
    return hashlib.md5(b"".join(value.to_bytes(width, "little", signed=True) for value in interleaved)).digest()


def decode_frame(reader: BitReader, stream_rate: int, stream_bits: int, out: list[list[int]]) -> None:
    if reader.read(15) != 0x7FFC:
        raise FlacError(f"フレームの同期符号が無い（{reader.pos // 8 - 2} バイト目）")
    reader.read(1)  # 区切り方（固定か可変か）。標本の数は下のブロックの大きさで足りる。
    block_code = reader.read(4)
    rate_code = reader.read(4)
    assignment = reader.read(4)
    size_code = reader.read(3)
    reader.read(1)
    first = reader.read(8)  # UTF-8 と同じ形のフレーム番号。続くバイトを読み飛ばす。
    extra = 0
    while first & (0x80 >> extra) and extra < 7:
        extra += 1
    for _ in range(max(0, extra - 1)):
        reader.read(8)
    if block_code == 1:
        block_size = 192
    elif 2 <= block_code <= 5:
        block_size = 576 << (block_code - 2)
    elif block_code == 6:
        block_size = reader.read(8) + 1
    elif block_code == 7:
        block_size = reader.read(16) + 1
    elif block_code >= 8:
        block_size = 256 << (block_code - 8)
    else:
        raise FlacError("ブロックの大きさの符号が予約値")
    if rate_code == 12:
        reader.read(8)
    elif rate_code in (13, 14):
        reader.read(16)
    elif rate_code not in (0, *SAMPLE_RATES):
        raise FlacError("標本化周波数の符号が予約値")
    bits = stream_bits if size_code == 0 else SAMPLE_SIZES[size_code]
    reader.read(8)  # CRC-8
    channel_count = assignment + 1 if assignment < 8 else 2
    subframes = []
    for channel in range(channel_count):
        side = (assignment == 8 and channel == 1) or (assignment == 9 and channel == 0) or (assignment == 10 and channel == 1)
        subframes.append(decode_subframe(reader, block_size, bits + (1 if side else 0)))
    reader.align()
    reader.read(16)  # CRC-16
    if assignment == 8:
        left, side = subframes
        subframes = [left, [a - b for a, b in zip(left, side, strict=True)]]
    elif assignment == 9:
        side, right = subframes
        subframes = [[a + b for a, b in zip(side, right, strict=True)], right]
    elif assignment == 10:
        mid, side = subframes
        left, right = [], []
        for m, s in zip(mid, side, strict=True):
            m = (m << 1) | (s & 1)
            left.append((m + s) >> 1)
            right.append((m - s) >> 1)
        subframes = [left, right]
    for channel, samples in zip(out, subframes, strict=True):
        channel.extend(samples)


FIXED_COEFFICIENTS = {0: [], 1: [1], 2: [2, -1], 3: [3, -3, 1], 4: [4, -6, 4, -1]}


def decode_subframe(reader: BitReader, block_size: int, bits: int) -> list[int]:
    if reader.read(1):
        raise FlacError("サブフレームの先頭の0が無い")
    kind = reader.read(6)
    wasted = 0
    if reader.read(1):
        wasted = reader.read_unary() + 1
    bits -= wasted
    if kind == 0:
        samples = [reader.read_signed(bits)] * block_size
    elif kind == 1:
        samples = [reader.read_signed(bits) for _ in range(block_size)]
    elif 8 <= kind <= 12:
        order = kind - 8
        samples = [reader.read_signed(bits) for _ in range(order)]
        residual = decode_residual(reader, block_size, order)
        predict(samples, residual, FIXED_COEFFICIENTS[order], 0)
    elif kind >= 32:
        order = kind - 31
        samples = [reader.read_signed(bits) for _ in range(order)]
        precision = reader.read(4) + 1
        shift = reader.read_signed(5)
        coefficients = [reader.read_signed(precision) for _ in range(order)]
        residual = decode_residual(reader, block_size, order)
        predict(samples, residual, coefficients, shift)
    else:
        raise FlacError(f"サブフレームの種類が予約値: {kind}")
    if wasted:
        samples = [sample << wasted for sample in samples]
    return samples


def decode_residual(reader: BitReader, block_size: int, order: int) -> list[int]:
    method = reader.read(2)
    if method > 1:
        raise FlacError("残差の符号化方式が予約値")
    parameter_bits = 4 if method == 0 else 5
    escape = (1 << parameter_bits) - 1
    partition_order = reader.read(4)
    partitions = 1 << partition_order
    residual: list[int] = []
    for partition in range(partitions):
        count = (block_size >> partition_order) - (order if partition == 0 else 0)
        parameter = reader.read(parameter_bits)
        if parameter == escape:
            raw_bits = reader.read(5)
            residual.extend(reader.read_signed(raw_bits) for _ in range(count))
        else:
            reader.read_rice(count, parameter, residual)
    return residual


def predict(samples: list[int], residual: list[int], coefficients: list[int], shift: int) -> None:
    order = len(coefficients)
    append = samples.append
    if order == 0:
        samples.extend(residual)
        return
    for value in residual:
        prediction = 0
        for lag, coefficient in enumerate(coefficients, start=1):
            prediction += coefficient * samples[-lag]
        append(value + (prediction >> shift))


def to_float(audio: FlacAudio) -> list[float]:
    """1チャンネル目を -1〜1 の値にする（今の FLAC はすべてモノラル）。"""
    scale = float(1 << (audio.bits_per_sample - 1))
    return [sample / scale for sample in audio.samples[0]]


def peak_db(signal: list[float]) -> float:
    peak = max(abs(value) for value in signal)
    return 20 * math.log10(peak) if peak > 0 else -math.inf


def rms50_db(signal: list[float], sample_rate: int) -> float:
    """50ms 窓の最大 RMS。窓より短い音は全体の RMS（bridges_sounds.py の rms50 と同じ）。"""
    window = int(0.05 * sample_rate)
    squares = [value * value for value in signal]
    if len(squares) <= window:
        energy = sum(squares) / len(squares)
    else:
        running = sum(squares[:window])
        best = running
        for index in range(window, len(squares)):
            running += squares[index] - squares[index - window]
            best = max(best, running)
        energy = best / window
    return 10 * math.log10(energy) if energy > 0 else -math.inf


def biquad(signal: list[float], b: list[float], a: list[float]) -> list[float]:
    b0, b1, b2 = (value / a[0] for value in b)
    _, a1, a2 = (value / a[0] for value in a)
    x1 = x2 = y1 = y2 = 0.0
    output = []
    for x in signal:
        y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1 = x1, x
        y2, y1 = y1, y
        output.append(y)
    return output


def k_weight(signal: list[float], sample_rate: int) -> list[float]:
    """ITU-R BS.1770 の K 特性。tsume_shogi_sounds.py の k_weight と同じ係数（RBJ の式）。"""
    amplitude = 10 ** (4.0 / 40)
    omega = 2 * math.pi * 1500.0 / sample_rate
    alpha = math.sin(omega) / (2 * (1 / math.sqrt(2)))
    root = 2 * math.sqrt(amplitude) * alpha
    cos = math.cos(omega)
    shelf_b = [
        amplitude * ((amplitude + 1) + (amplitude - 1) * cos + root),
        -2 * amplitude * ((amplitude - 1) + (amplitude + 1) * cos),
        amplitude * ((amplitude + 1) + (amplitude - 1) * cos - root),
    ]
    shelf_a = [
        (amplitude + 1) - (amplitude - 1) * cos + root,
        2 * ((amplitude - 1) - (amplitude + 1) * cos),
        (amplitude + 1) - (amplitude - 1) * cos - root,
    ]
    omega = 2 * math.pi * 38.0 / sample_rate
    alpha = math.sin(omega) / (2 * 0.5)
    cos = math.cos(omega)
    pass_b = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2]
    pass_a = [1 + alpha, -2 * cos, 1 - alpha]
    return biquad(biquad(signal, shelf_b, shelf_a), pass_b, pass_a)


def momentary_lufs(signal: list[float], sample_rate: int) -> float:
    """400ms 窓の最大ラウドネス。前後に 400ms の無音を足して測る（tsume_shogi_sounds.py と同じ）。"""
    window = int(0.4 * sample_rate)
    silence = [0.0] * window
    weighted = k_weight(silence + signal + silence, sample_rate)
    squares = [value * value for value in weighted]
    running = sum(squares[:window])
    best = running
    for index in range(window, len(squares)):
        running += squares[index] - squares[index - window]
        best = max(best, running)
    return -0.691 + 10 * math.log10(best / window + 1e-15)


@dataclass(frozen=True)
class Measurement:
    game: str
    name: str
    role: str
    place_like: bool
    bytes: int
    padding_bytes: int
    audio_offset: int
    metadata: tuple[str, ...]
    sample_rate: int
    channels: int
    bits: int
    duration_s: float
    peak_db: float
    rms50_db: float
    lufs: float
    md5_matches: bool | None

    @property
    def net_bytes(self) -> int:
        """PADDING を外したときの大きさ。書き出しの決まり（PADDING なし）に合わせた大きさとして比べる。"""
        return self.bytes - self.padding_bytes


def classify(game: str, name: str) -> tuple[str, bool]:
    for game_pattern, name_pattern, role, place_like in ROLE_TABLE:
        if fnmatch(game, game_pattern) and fnmatch(name, name_pattern):
            return role, place_like
    raise AssertionError("ROLE_TABLE の最後の行がすべてに合う")


def game_of(path: Path, source: Path) -> str:
    parts = path.relative_to(source).parts
    return parts[1] if parts[0] == "games" else "(app)"


def measure(path: Path, source: Path) -> Measurement:
    data = path.read_bytes()
    audio = decode_flac(data)
    signal = to_float(audio)
    game = game_of(path, source)
    name = path.stem
    role, place_like = classify(game, name)
    return Measurement(
        game=game,
        name=name,
        role=role,
        place_like=place_like,
        bytes=len(data),
        padding_bytes=audio.padding_bytes,
        audio_offset=audio.audio_offset,
        metadata=audio.metadata_types,
        sample_rate=audio.sample_rate,
        channels=audio.channels,
        bits=audio.bits_per_sample,
        duration_s=audio.total_samples / audio.sample_rate,
        peak_db=peak_db(signal),
        rms50_db=rms50_db(signal, audio.sample_rate),
        lufs=momentary_lufs(signal, audio.sample_rate),
        md5_matches=audio.md5_matches,
    )


def kib(value: float) -> str:
    return f"{value / 1024:.1f}"


def range_text(values: list[float], digits: int = 1) -> str:
    if not values:
        return "-"
    return f"{min(values):.{digits}f}〜{max(values):.{digits}f}（中央 {statistics.median(values):.{digits}f}）"


def print_files(measurements: list[Measurement]) -> None:
    print("## ファイルごと\n")
    print("| ゲーム | 音 | 役割 | 置く操作 | バイト | うち PADDING | バイト/秒（PADDING を外す） | 長さ(s) | ピーク(dBFS) | RMS50(dBFS) | LUFS(400ms) | 形式 | メタデータ | MD5 |")
    print("|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|---|")
    for item in measurements:
        form = f"{item.channels}ch/{item.bits}bit/{item.sample_rate}Hz"
        md5 = {True: "一致", False: "不一致", None: "未記録"}[item.md5_matches]
        print(
            f"| {item.game} | {item.name} | {item.role} | {'○' if item.place_like else ''} | {item.bytes} | "
            f"{item.padding_bytes} | {item.net_bytes / item.duration_s:.0f} | {item.duration_s:.3f} | {item.peak_db:.1f} | {item.rms50_db:.1f} | {item.lufs:.1f} | {form} | "
            f"{'+'.join(item.metadata)} | {md5} |"
        )
    print()


def print_games(measurements: list[Measurement]) -> dict[str, tuple[int, int]]:
    print("## ゲームごと\n")
    print("| ゲーム | 本数 | 合計(KiB) | PADDING を外した合計(KiB) | 操作の成立 | 不成立 | ミス | クリア | クリアの合計(KiB、PADDING を外す) |")
    print("|---|---:|---:|---:|---:|---:|---:|---:|---:|")
    totals: dict[str, tuple[int, int]] = {}
    for game in sorted({item.game for item in measurements}):
        items = [item for item in measurements if item.game == game]
        count = len(items)
        raw_size = sum(item.bytes for item in items)
        size = sum(item.net_bytes for item in items)
        totals[game] = (count, size)
        by_role = {role: sum(1 for item in items if item.role == role) for role in (ROLE_OPERATION, ROLE_BLOCKED, ROLE_MISTAKE, ROLE_CLEAR)}
        clear_size = sum(item.net_bytes for item in items if item.role == ROLE_CLEAR)
        print(
            f"| {game} | {count} | {kib(raw_size)} | {kib(size)} | {by_role[ROLE_OPERATION]} | {by_role[ROLE_BLOCKED]} | "
            f"{by_role[ROLE_MISTAKE]} | {by_role[ROLE_CLEAR]} | {kib(clear_size)} |"
        )
    games = {game: value for game, value in totals.items() if game != "(app)"}
    counts = [count for count, _ in games.values()]
    sizes = [size for _, size in games.values()]
    print()
    print(f"- ゲームの数: {len(games)}")
    print(f"- ゲームごとの本数: {min(counts)}〜{max(counts)}（中央 {statistics.median(counts)}）")
    print(f"- ゲームごとの合計（PADDING を外す）: {kib(min(sizes))}〜{kib(max(sizes))} KiB（中央 {kib(statistics.median(sizes))} KiB）")
    app_total = sum(item.bytes for item in measurements)
    padding_total = sum(item.padding_bytes for item in measurements)
    print(f"- アプリ全体: {len(measurements)} 本、{kib(app_total)} KiB（{app_total} バイト）")
    print(f"- うち PADDING: {kib(padding_total)} KiB（{padding_total} バイト）。外すと {kib(app_total - padding_total)} KiB")
    duration_total = sum(item.duration_s for item in measurements)
    # AudioContext は復号した音を 32bit 浮動小数で持つ。標本化周波数は端末で変わりうるので、48kHz のままの場合の値。
    decoded_bytes = sum(item.duration_s * item.sample_rate * item.channels * 4 for item in measurements)
    print(f"- 長さの合計: {duration_total:.2f} 秒。復号して 32bit 浮動小数で持つと約 {kib(decoded_bytes)} KiB（48kHz のままの場合）")
    print()
    return totals


def print_roles(measurements: list[Measurement]) -> None:
    print("## 役割ごと（ゲームの音だけ）\n")
    print("| 役割 | 本数 | バイト（PADDING を外す） | 長さ(s) | ピーク(dBFS) | RMS50(dBFS) | LUFS(400ms) |")
    print("|---|---:|---|---|---|---|---|")
    groups = {
        ROLE_OPERATION: [item for item in measurements if item.role == ROLE_OPERATION],
        "操作の成立のうち盤面に物を置く音": [item for item in measurements if item.place_like],
        ROLE_BLOCKED: [item for item in measurements if item.role == ROLE_BLOCKED],
        ROLE_MISTAKE: [item for item in measurements if item.role == ROLE_MISTAKE],
        ROLE_CLEAR: [item for item in measurements if item.role == ROLE_CLEAR],
        "クリアのうち段ごとの音": clear_steps(measurements),
        "クリアのうち仕上げの1本": clear_finals(measurements),
    }
    for label, items in groups.items():
        print(
            f"| {label} | {len(items)} | {range_text([item.net_bytes for item in items], 0)} | "
            f"{range_text([item.duration_s for item in items], 3)} | {range_text([item.peak_db for item in items])} | "
            f"{range_text([item.rms50_db for item in items])} | {range_text([item.lufs for item in items])} |"
        )
    print()
    print("盤面に物を置く音:", ", ".join(f"{item.game}/{item.name}" for item in groups["操作の成立のうち盤面に物を置く音"]))
    print()


def clear_steps(measurements: list[Measurement]) -> list[Measurement]:
    """番号の付いた段の音（cleared-wave-3 など、clear-note-* を含む）。"""
    return [item for item in measurements if item.role == ROLE_CLEAR and (item.name[-1].isdigit() or item.name.startswith("clear-note-"))]


def clear_finals(measurements: list[Measurement]) -> list[Measurement]:
    """段を持たないゲームのクリア音と、段の後の仕上げの音（cleared-chord・cleared-end・cleared-resonance・cleared-strike）。"""
    steps = set(map(id, clear_steps(measurements)))
    return [item for item in measurements if item.role == ROLE_CLEAR and id(item) not in steps]


def print_plans(all_measurements: list[Measurement], totals: dict[str, tuple[int, int]]) -> None:
    print("## 魔方陣の案ごとの見積もり（計測ではない）\n")
    measurements = [item for item in all_measurements if item.game != "(app)"]
    templates = {
        PLACE_LIKE: [item for item in measurements if item.place_like],
        ROLE_BLOCKED: [item for item in measurements if item.role == ROLE_BLOCKED],
        ROLE_MISTAKE: [item for item in measurements if item.role == ROLE_MISTAKE],
        CLEAR_STEP: clear_steps(measurements),
        CLEAR_FINAL: clear_finals(measurements),
    }
    size_by_template = {key: statistics.median([item.net_bytes for item in items]) for key, items in templates.items()}
    game_sizes = [size for game, (_, size) in totals.items() if game != "(app)"]
    game_counts = [count for game, (count, _) in totals.items() if game != "(app)"]
    app_total = sum(item.bytes for item in all_measurements)
    print("見積もりは、各音を、同じ型の既存の音の PADDING を外したバイト数の中央値と置いたもの。ゲームの合計も PADDING を外して比べる。")
    for key, value in size_by_template.items():
        print(f"- {key}: {value:.0f} バイト")
    print()
    print("| 案 | 本数 | 見積もり(KiB) | 既存ゲームの中で大きい方から | アプリ全体に足した後(KiB) | 増える割合 |")
    print("|---|---:|---:|---|---:|---:|")
    for plan, sounds in PLANS.items():
        size = sum(size_by_template[template] for _, _, template in sounds)
        rank = 1 + sum(1 for other in game_sizes if other > size)
        print(
            f"| {plan} | {len(sounds)} | {kib(size)} | {rank}番目（{len(game_sizes) + 1} 中） | {kib(app_total + size)} | "
            f"{size / app_total * 100:.1f}% |"
        )
    print()
    print(f"既存ゲームの本数の中央値 {statistics.median(game_counts)} 本、合計の中央値 {kib(statistics.median(game_sizes))} KiB。")
    print()
    print("## 仮定の帯域での転送時間（割り算。往復の時間・同時接続・圧縮の有無は含めない）\n")
    print("| 帯域 | 今の全 FLAC(s) | 上限 4 秒で運べる量(KiB) |")
    print("|---|---:|---:|")
    for label, bandwidth in ASSUMED_BANDWIDTHS:
        seconds = app_total * 8 / bandwidth
        capacity = bandwidth * SOUND_LOADING_LIMIT_S / 8
        print(f"| {label} | {seconds:.2f} | {kib(capacity)} |")
    print()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT, help="リポジトリのルート")
    arguments = parser.parse_args()
    source = arguments.root / "frontend" / "src"
    paths = sorted(source.glob("**/*.flac"))
    if not paths:
        raise SystemExit(f"FLAC が見つからない: {source}")
    measurements = [measure(path, source) for path in paths]
    print(f"# 効果音の計測（{source} の **/*.flac、{len(paths)} 本）\n")
    print_files(measurements)
    totals = print_games(measurements)
    print_roles([item for item in measurements if item.game != "(app)"])
    print_plans(measurements, totals)
    formats = {(item.channels, item.bits, item.sample_rate) for item in measurements}
    padded = [f"{item.game}/{item.name}" for item in measurements if "PADDING" in item.metadata]
    unchecked = [f"{item.game}/{item.name}" for item in measurements if item.md5_matches is None]
    print("## 形式の確かめ\n")
    print(f"- 形式（チャンネル, ビット, Hz）の種類: {sorted(formats)}")
    print(f"- PADDING が残っている音: {padded or 'なし'}")
    print(f"- MD5 が記録されていない音: {unchecked or 'なし'}（記録されている音は、復号した標本の MD5 がすべて一致した）")


if __name__ == "__main__":
    main()
