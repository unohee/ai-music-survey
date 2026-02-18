#!/usr/bin/env python3
"""
Audio Pool Expansion Script
Created: 2026-02-18
Purpose: 기존 200트랙 풀에 300트랙 추가하여 총 500트랙으로 확장
Dependencies: pydub, ffmpeg

소스:
  AI (150 new):
    - AIME/suno_v3:  60트랙 (120s → 12s segment)
    - AIME/suno_v35: 50트랙 (240s → 12s segment)
    - AIME/udio:     40트랙 (33s → 12s segment)
    - youtube_ai:    (fallback, 필요 시)
  Real (150 new):
    - AIME/jamendo:  100트랙 (88s → 12s segment)
    - csv_covers:    50트랙 (54-151s → 12s segment)
"""

import json
import os
import sys
import random
import hashlib
from pathlib import Path
import functools

# 모든 print를 flush=True로
print = functools.partial(print, flush=True)

try:
    from pydub import AudioSegment
except ImportError:
    print("pydub 필요: pip install pydub")
    sys.exit(1)

# 경로 설정
PROJECT_ROOT = Path(__file__).resolve().parent.parent
POOL_JSON = PROJECT_ROOT / "audio" / "pool.json"
HASHED_DIR = PROJECT_ROOT / "audio" / "hashed"

# 소스 경로
AIME_BASE = Path("/media/unohee/seagate4tb/ai_music_datasets/AIME")
PROCESSED_BASE = Path("/media/unohee/seagate4tb/ai_detection/data/processed")

SOURCES = {
    "ai": [
        {"path": AIME_BASE / "ai" / "suno_v3",  "count": 60, "ext": "*.wav"},
        {"path": AIME_BASE / "ai" / "suno_v35", "count": 50, "ext": "*.wav"},
        {"path": AIME_BASE / "ai" / "udio",     "count": 40, "ext": "*.wav"},
    ],
    "real": [
        {"path": AIME_BASE / "real" / "mtg_jamendo", "count": 100, "ext": "*.wav"},
        {"path": PROCESSED_BASE / "real" / "csv_covers", "count": 50, "ext": "*.wav"},
    ],
}

SEGMENT_DURATION_MS = 12000  # 12초
MIN_DURATION_MS = 14000      # 최소 14초 이상인 트랙만 사용
SKIP_MS = 3000               # 앞뒤 3초 스킵 (인트로/아웃트로 회피)
TARGET_BITRATE = "192k"
SAMPLE_RATE = 44100
CHANNELS = 2


def load_pool():
    """기존 pool.json 로드"""
    with open(POOL_JSON, "r") as f:
        return json.load(f)


def get_existing_hashes(pool_data):
    """기존 트랙의 해시 파일명 수집 (중복 방지)"""
    return {os.path.basename(t["file"]) for t in pool_data["tracks"]}


def hash_filename(source_path: str, offset_ms: int) -> str:
    """소스 경로 + 오프셋으로 고유 해시 생성"""
    key = f"{source_path}:{offset_ms}"
    return hashlib.sha256(key.encode()).hexdigest()[:12] + ".mp3"


def select_source_files(source_dir: Path, ext: str, count: int) -> list:
    """소스 디렉토리에서 랜덤으로 count개 파일 선택"""
    files = sorted(source_dir.glob(ext))
    if not files:
        print(f"  [WARNING] {source_dir}에 {ext} 파일 없음")
        return []

    # MIN_DURATION 이상인 파일만 필터 (전체 스캔 대신 샘플링)
    random.shuffle(files)
    selected = []
    for f in files:
        if len(selected) >= count:
            break
        try:
            audio = AudioSegment.from_file(str(f))
            if len(audio) >= MIN_DURATION_MS:
                selected.append(f)
        except Exception as e:
            print(f"  [SKIP] {f.name}: {e}")
            continue

    print(f"  {source_dir.name}: {len(selected)}/{count}개 선택 (전체 {len(files)}개)")
    return selected


def cut_segment(audio: AudioSegment) -> AudioSegment:
    """오디오에서 랜덤 12초 세그먼트 추출"""
    duration_ms = len(audio)
    # 유효 범위: skip~(duration-skip-segment)
    max_start = duration_ms - SKIP_MS - SEGMENT_DURATION_MS
    min_start = SKIP_MS
    if max_start <= min_start:
        # 트랙이 짧은 경우: 가능한 범위에서 추출
        min_start = 0
        max_start = max(0, duration_ms - SEGMENT_DURATION_MS)

    start = random.randint(min_start, max_start)
    segment = audio[start:start + SEGMENT_DURATION_MS]

    # 스테레오 + 44.1kHz 보장
    segment = segment.set_channels(CHANNELS).set_frame_rate(SAMPLE_RATE)

    return segment, start


def process_tracks(label: int, sources: list, start_index: int, existing_hashes: set):
    """트랙 처리: 소스에서 세그먼트 추출 → MP3 → pool entry 생성"""
    prefix = "ai" if label == 0 else "real"
    new_tracks = []
    idx = start_index

    for source_cfg in sources:
        src_dir = source_cfg["path"]
        count = source_cfg["count"]
        ext = source_cfg["ext"]

        print(f"\n[{prefix.upper()}] {src_dir.name} ({count}개 목표)")
        files = select_source_files(src_dir, ext, count)

        for src_file in files:
            try:
                audio = AudioSegment.from_file(str(src_file))
                segment, offset = cut_segment(audio)

                # 해시 파일명 생성
                hashed_name = hash_filename(str(src_file), offset)
                while hashed_name in existing_hashes:
                    offset += 1000  # 충돌 시 오프셋 조정
                    hashed_name = hash_filename(str(src_file), offset)

                out_path = HASHED_DIR / hashed_name

                # MP3 192kbps로 내보내기
                segment.export(
                    str(out_path),
                    format="mp3",
                    parameters=["-b:a", TARGET_BITRATE],
                )

                track_id = f"{prefix}_{idx:03d}"
                new_tracks.append({
                    "id": track_id,
                    "file": f"hashed/{hashed_name}",
                    "label": label,
                    "duration": 12,
                    "variants": {},
                    "adversarial_score": None,
                })

                existing_hashes.add(hashed_name)
                idx += 1
                print(f"  [{idx - start_index}/{count}] {track_id} ← {src_file.name} @{offset}ms")

            except Exception as e:
                print(f"  [ERROR] {src_file.name}: {e}")
                continue

    return new_tracks


def main():
    random.seed(42)  # 재현성

    print("=" * 60)
    print("Audio Pool Expansion Script")
    print("=" * 60)

    # 외장 HDD 확인
    if not AIME_BASE.exists():
        print(f"[ERROR] 외장 HDD 미마운트: {AIME_BASE}")
        sys.exit(1)

    # 기존 풀 로드
    pool_data = load_pool()
    existing = pool_data["tracks"]
    existing_hashes = get_existing_hashes(pool_data)
    print(f"기존 트랙: {len(existing)}개 ({len(existing_hashes)}개 해시)")

    # AI 트랙 확장 (ai_100 ~ ai_249)
    print("\n" + "=" * 60)
    print("AI 트랙 추가 (목표: 150개)")
    print("=" * 60)
    ai_tracks = process_tracks(
        label=0,
        sources=SOURCES["ai"],
        start_index=100,
        existing_hashes=existing_hashes,
    )

    # Real 트랙 확장 (real_100 ~ real_249)
    print("\n" + "=" * 60)
    print("Real 트랙 추가 (목표: 150개)")
    print("=" * 60)
    real_tracks = process_tracks(
        label=1,
        sources=SOURCES["real"],
        start_index=100,
        existing_hashes=existing_hashes,
    )

    # pool.json 업데이트
    all_new = ai_tracks + real_tracks
    pool_data["tracks"].extend(all_new)
    pool_data["totalTracks"] = len(pool_data["tracks"])
    pool_data["version"] = "2.0"
    pool_data["description"] = "Audio Survey Pool — Expanded"

    with open(POOL_JSON, "w") as f:
        json.dump(pool_data, f, ensure_ascii=False)

    print("\n" + "=" * 60)
    print("결과 요약")
    print("=" * 60)
    total_ai = len([t for t in pool_data["tracks"] if t["label"] == 0])
    total_real = len([t for t in pool_data["tracks"] if t["label"] == 1])
    print(f"새로 추가: AI {len(ai_tracks)}개 + Real {len(real_tracks)}개 = {len(all_new)}개")
    print(f"전체 풀: AI {total_ai}개 + Real {total_real}개 = {pool_data['totalTracks']}개")
    print(f"pool.json 업데이트 완료!")
    print(f"\n다음 단계: python scripts/prepare_variants.py")


if __name__ == "__main__":
    main()
