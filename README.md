# AI vs Real Music Survey

AI 생성 음악과 실제 연주를 구별하는 게이미피케이션 설문 조사 시스템.
스테이지 기반 게임으로 연구 데이터를 수집하고, 라이프/리더보드로 바이럴 확산을 유도합니다.

## Live

https://unohee.github.io/ai-music-survey/

## 게임 흐름

```
Welcome (리더보드 + 닉네임/IP 바인딩)
  ▼
워밍업 5문제 (라이프 소모 없음, 연구 데이터 수집)
  ▼
Stage 1: Normal        — 12s 원본, 5문제, 기본 10점
Stage 2: Time Pressure — 8s 클립, 5문제, 기본 15점
Stage 3: Codec 128k    — 128kbps, 5문제, 기본 20점
Stage 4: Lo-Fi 64k     — 64kbps, 5문제, 기본 25점
Stage 5: Speed Round   — 4s 클립, 5문제, 기본 30점
Stage 6: Adversarial   — 모델이 헷갈린 트랙, 5문제, 기본 40점
  ▼
All Clear → 결과 + 리더보드

* 라이프 3개, 오답 시 -1, 0이면 Game Over
```

## 구조

```
├── index.html              # 메인 게임 UI (7개 화면)
├── js/app.js               # 게임 로직, 스테이지 시스템, API 연동
├── css/style.css           # 스타일 (다크 테마, 스테이지 UI)
├── audio/
│   ├── pool.json           # 200개 트랙 메타데이터 + variants
│   ├── hashed/             # 원본 192kbps 12s MP3 (200개)
│   └── hashed/variants/    # 생성된 variant (800개, .gitignore)
├── scripts/
│   └── prepare_variants.py # 오디오 variant 생성 스크립트
├── server/
│   ├── server.py           # FastAPI 서버 (SQLite, IP 바인딩)
│   ├── requirements.txt
│   ├── admin.html          # 독립 관리자 페이지
│   ├── cloudflare-worker.js
│   └── wrangler.toml
└── admin/                  # 관리자 대시보드
```

## 프론트엔드

GitHub Pages에서 정적 호스팅. Vanilla JS, HTML5 Audio API 사용.

- 워밍업 5문제 (연구 데이터) + 6 스테이지 × 5문제 (게임)
- 라이프 3개, 스테이지별 점수 배율, 스트릭 보너스
- IP 기반 닉네임 바인딩 (재방문 시 자동입력)
- Welcome/Game Over/All Clear 3곳에 리더보드 표시
- API 실패 시 시드 리더보드 + localStorage 폴백

## 백엔드

```bash
cd server
pip install -r requirements.txt
uvicorn server:app --port 8090
```

### API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/check-user` | IP로 기존 닉네임 조회 |
| POST | `/api/register` | IP에 닉네임 바인딩 |
| POST | `/api/submit` | 결과 제출 (스테이지 정보 포함) |
| GET | `/api/leaderboard` | 리더보드 (max_stage DESC, score DESC) |
| GET | `/api/stats` | 통계 조회 |
| GET | `/api/results` | 전체 결과 (관리자) |
| GET | `/api/export` | CSV 내보내기 |

## 오디오 Variant 생성

```bash
pip install pydub
python scripts/prepare_variants.py
```

pool.json의 200개 트랙에서 4종 variant 생성 (총 800파일):
- `_8s.mp3` — 앞 8초 트림
- `_4s.mp3` — 앞 4초 트림
- `_128k.mp3` — 128kbps 재인코딩
- `_64k.mp3` — 64kbps 재인코딩

## 기술 스택

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: FastAPI, SQLite, Pydantic
- **Audio**: pydub, ffmpeg
- **Hosting**: GitHub Pages (frontend), survey.intrect.io (API)
