#!/usr/bin/env python3
"""
Audio Variant Generator for AI Music Survey
Created: 2026-02-11
Purpose: pool.json 기반으로 4종 variant 생성 (8s, 4s, 128k, 64k)
Dependencies: pydub, ffmpeg

IMPORTANT: pool.json에 등록된 파일만 처리. 잔차/임시 파일 무시.
"""

import json
import os
import sys
from pathlib import Path

try:
    from pydub import AudioSegment
except ImportError:
    print("pydub 설치 필요: pip install pydub")
    sys.exit(1)

# 프로젝트 루트 기준 경로
PROJECT_ROOT = Path(__file__).resolve().parent.parent
POOL_JSON = PROJECT_ROOT / "audio" / "pool.json"
HASHED_DIR = PROJECT_ROOT / "audio" / "hashed"
VARIANTS_DIR = HASHED_DIR / "variants"

VARIANT_CONFIGS = {
    "8s":   {"type": "trim", "duration_ms": 8000},
    "4s":   {"type": "trim", "duration_ms": 4000},
    "128k": {"type": "bitrate", "bitrate": "128k"},
    "64k":  {"type": "bitrate", "bitrate": "64k"},
}


def load_pool():
    """pool.json에서 트랙 목록 로드 (잔차 파일 방지: 여기 등록된 파일만 처리)"""
    with open(POOL_JSON, "r") as f:
        data = json.load(f)
    return data


def get_valid_filenames(tracks):
    """pool.json에 등록된 파일명만 추출"""
    filenames = set()
    for track in tracks:
        # "hashed/25e03eb342f1.mp3" -> "25e03eb342f1.mp3"
        basename = os.path.basename(track["file"])
        filenames.add(basename)
    return filenames


def generate_variants(tracks):
    """pool.json 트랙에 대해서만 variant 생성"""
    VARIANTS_DIR.mkdir(parents=True, exist_ok=True)

    valid_files = get_valid_filenames(tracks)
    total = len(tracks)
    created = 0
    skipped = 0
    errors = []

    for i, track in enumerate(tracks):
        basename = os.path.basename(track["file"])
        stem = Path(basename).stem  # e.g. "25e03eb342f1"
        src_path = HASHED_DIR / basename

        # pool.json에 있지만 파일이 없는 경우
        if not src_path.exists():
            errors.append(f"  [MISSING] {basename}")
            continue

        # 추가 안전장치: 파일명이 pool.json에 등록되어 있는지 확인
        if basename not in valid_files:
            print(f"  [SKIP] {basename} - pool.json에 미등록 (잔차 파일)")
            skipped += 1
            continue

        print(f"  [{i+1}/{total}] {basename}")

        try:
            audio = AudioSegment.from_mp3(str(src_path))

            for var_key, config in VARIANT_CONFIGS.items():
                out_name = f"{stem}_{var_key}.mp3"
                out_path = VARIANTS_DIR / out_name

                if out_path.exists():
                    skipped += 1
                    continue

                if config["type"] == "trim":
                    duration_ms = config["duration_ms"]
                    segment = audio[:duration_ms]
                    segment.export(str(out_path), format="mp3",
                                   parameters=["-b:a", "192k"])
                elif config["type"] == "bitrate":
                    audio.export(str(out_path), format="mp3",
                                 parameters=["-b:a", config["bitrate"]])

                created += 1

        except Exception as e:
            errors.append(f"  [ERROR] {basename}: {e}")

    return created, skipped, errors


def update_pool_json(data):
    """pool.json에 variants 및 adversarial_score 필드 추가"""
    for track in data["tracks"]:
        basename = os.path.basename(track["file"])
        stem = Path(basename).stem

        track["variants"] = {
            "8s":   f"hashed/variants/{stem}_8s.mp3",
            "4s":   f"hashed/variants/{stem}_4s.mp3",
            "128k": f"hashed/variants/{stem}_128k.mp3",
            "64k":  f"hashed/variants/{stem}_64k.mp3",
        }

        # adversarial_score: 초기값 null
        if "adversarial_score" not in track:
            track["adversarial_score"] = None

    # Boss Stage용 adversarial 트랙 수동 설정 (AI 8개 + Real 7개)
    # 높은 점수 = 사람도 헷갈리는 트랙
    adversarial_ids = {
        "ai_003": 0.95, "ai_017": 0.92, "ai_028": 0.90, "ai_041": 0.88,
        "ai_056": 0.87, "ai_072": 0.85, "ai_089": 0.83, "ai_094": 0.81,
        "real_005": 0.94, "real_019": 0.91, "real_033": 0.89, "real_048": 0.86,
        "real_062": 0.84, "real_077": 0.82, "real_091": 0.80,
    }
    for track in data["tracks"]:
        if track["id"] in adversarial_ids:
            track["adversarial_score"] = adversarial_ids[track["id"]]

    return data


def main():
    print("=== Audio Variant Generator ===")
    print(f"Pool: {POOL_JSON}")
    print(f"Source: {HASHED_DIR}")
    print(f"Output: {VARIANTS_DIR}")
    print()

    # pool.json 로드
    data = load_pool()
    tracks = data["tracks"]
    print(f"pool.json 트랙 수: {len(tracks)}")

    # 디렉토리 내 실제 파일 수 확인 (잔차 파일 경고)
    actual_files = set(f for f in os.listdir(HASHED_DIR)
                       if f.endswith(".mp3") and os.path.isfile(HASHED_DIR / f))
    valid_files = get_valid_filenames(tracks)
    residual = actual_files - valid_files
    if residual:
        print(f"\n[WARNING] 잔차 파일 {len(residual)}개 발견 (처리하지 않음):")
        for f in sorted(residual)[:5]:
            print(f"  - {f}")
        if len(residual) > 5:
            print(f"  ... 외 {len(residual)-5}개")
    print()

    # Variant 생성
    print("Variant 생성 중...")
    created, skipped, errors = generate_variants(tracks)
    print(f"\n완료: 생성 {created}개, 스킵 {skipped}개, 에러 {len(errors)}개")

    if errors:
        print("\n에러 목록:")
        for e in errors:
            print(e)

    # pool.json 업데이트
    print("\npool.json 업데이트 중...")
    updated_data = update_pool_json(data)
    with open(POOL_JSON, "w") as f:
        json.dump(updated_data, f, ensure_ascii=False)
    print("pool.json 업데이트 완료!")

    # 검증
    variant_count = len(list(VARIANTS_DIR.glob("*.mp3"))) if VARIANTS_DIR.exists() else 0
    expected = len(tracks) * len(VARIANT_CONFIGS)
    print(f"\n검증: variants/ 내 파일 {variant_count}개 (기대값: {expected}개)")
    if variant_count == expected:
        print("OK - 모든 variant 생성 완료!")
    else:
        print(f"WARNING - {expected - variant_count}개 부족")


if __name__ == "__main__":
    main()
