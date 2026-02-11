# AI Music Survey - AGENTS.md

## 프로젝트 개요

AI 생성 음악 vs 실제 연주를 구별하는 게이미피케이션 설문 조사 시스템.
음악 AI 연구를 위한 인지 실험 플랫폼. 스테이지 기반 게임으로 연구 데이터 수집과 바이럴 확산을 동시 추구.

- **생성일**: 2026-02-11
- **원본**: ArtifactNet 레포의 gh-pages 브랜치에서 분리
- **저장소**: `unohee/ai-music-survey` (GitHub)

---

## 아키텍처

```
[사용자 브라우저]
    │
    ├── GitHub Pages (정적 호스팅)
    │   ├── index.html             (게임 UI, 7개 화면)
    │   ├── js/app.js              (스테이지 시스템 + 라이프 + API)
    │   ├── css/style.css          (다크 테마, 스테이지/Game Over UI)
    │   ├── audio/pool.json        (200개 트랙 + variants 경로)
    │   ├── audio/hashed/          (원본 MP3, 200개)
    │   ├── audio/hashed/variants/ (variant MP3, 800개)
    │   └── admin/index.html       (관리자 대시보드)
    │
    └── HTTPS → https://survey.intrect.io
        │
        └── FastAPI (server/server.py, port 8090)
            ├── GET  /api/check-user   (IP 기반 닉네임 조회)
            ├── POST /api/register     (IP-닉네임 바인딩)
            ├── POST /api/submit       (결과 제출, 스테이지 정보 포함)
            ├── GET  /api/leaderboard  (max_stage DESC, score DESC)
            ├── GET  /api/stats        (통계)
            ├── GET  /api/results      (관리자 전체조회)
            ├── GET  /api/export       (CSV 내보내기)
            └── SQLite (survey_results.db)
```

---

## 게임 흐름

```
Welcome (리더보드 Top 5 + 닉네임 입력)
  │ IP 체크 → 기존 사용자면 닉네임 자동입력/disabled
  ▼
Evaluation (워밍업 5문제) — 라이프 소모 없음, 연구 데이터 수집
  ▼
Stage Intro → Stage 1: Normal (12s, 원본) — 5문제, 10점
Stage Intro → Stage 2: Time Pressure (8s) — 5문제, 15점
Stage Intro → Stage 3: Codec 128k — 5문제, 20점
Stage Intro → Stage 4: Lo-Fi 64k — 5문제, 25점
Stage Intro → Stage 5: Speed Round (4s) — 5문제, 30점
Stage Intro → Stage 6: Adversarial (Boss) — 5문제, 40점
  ▼
All Clear → 결과 + 리더보드 + 인구통계 폼

* 라이프 3개, 오답 시 -1, 0이면 → Game Over (자동 제출)
* 스테이지 클리어 보너스: 50~200점 (스테이지별)
* 스트릭 보너스: +5점/연속, 최대 +50
* All Clear 시 남은 라이프 보너스: 100점/라이프
```

---

## 핵심 파일 맵

### 프론트엔드 (루트 = GitHub Pages 배포 경로)

| 파일 | 역할 | 비고 |
|------|------|------|
| `index.html` | 게임 UI (334줄) | welcome → evaluation(5) → stage-intro → game → game-over / results → thankyou |
| `js/app.js` | 게임 로직 (1242줄) | CONFIG 6스테이지, 라이프, IP 바인딩, variant 선택, 점수, 리더보드 |
| `css/style.css` | 스타일 (1050줄) | 다크 테마, 라이프 애니메이션, 스테이지 인트로, Game Over |
| `audio/pool.json` | 트랙 메타데이터 | 200개 (AI 100 + Real 100), variants 경로, adversarial_score |
| `admin/index.html` | 관리자 대시보드 (641줄) | 통계, 결과 테이블, CSV 내보내기, 30초 자동새로고침 |

### 백엔드 (`server/`)

| 파일 | 역할 | 비고 |
|------|------|------|
| `server.py` | FastAPI 서버 (333줄) | SQLite, CORS, users 테이블, IP 바인딩 |
| `requirements.txt` | 의존성 | fastapi, uvicorn, pydantic |
| `admin.html` | 독립 관리자 페이지 | server에서 `/admin`으로 서빙 |
| `cloudflare-worker.js` | CF Workers 대안 백엔드 | 미사용 |
| `wrangler.toml` | CF Workers 설정 | 미사용 |

### 스크립트 (`scripts/`)

| 파일 | 역할 | 비고 |
|------|------|------|
| `prepare_variants.py` | 오디오 variant 생성 | pool.json 기반 (잔차 파일 안전), pydub 필요 |

---

## 데이터 흐름

### 게임 진행
1. `pool.json`에서 200개 트랙 로드 → 셔플
2. 워밍업 5문항 (비채점, 라이프 소모 없음, 연구 데이터 수집)
3. 스테이지별 5개 트랙 선택 (AI/Real 균형, 중복 배제)
4. `loadAudio(track, variant)` → variant 경로 resolve
5. 답변 → stage-specific pointBase + 스트릭 보너스
6. 오답 시 라이프 -1, 라이프 0 → Game Over (자동 제출)
7. 스테이지 클리어 → 클리어 보너스 + 다음 스테이지 인트로
8. 6스테이지 완료 → All Clear + 라이프 보너스

### 결과 제출
```
app.js:submitResults() → POST /api/submit
{
  nickname, email, timestamp, duration,
  score, accuracy, correctCount, maxStreak,
  aiAccuracy, realAccuracy,
  maxStage, livesRemaining, isGameOver,
  stageResults: [{ stage, cleared, correct, total }],
  demographics: { musicExperience, aiExperience, criteria },
  answers: [{ trackId, label, answer, correct, time }]
}
```
- Game Over 시 자동 제출 (데이터 손실 방지)
- API 실패 시 localStorage 폴백
- 리더보드: API 데이터 + 시드 데이터 병합, max_stage DESC → score DESC 정렬

### DB 스키마 (SQLite)
```sql
-- IP-닉네임 바인딩
users (
  id, ip_address UNIQUE, nickname UNIQUE, created_at
)

-- 결과
results (
  id, nickname, email, score, accuracy,
  correct_count, max_streak, ai_accuracy, real_accuracy,
  duration, music_experience, ai_experience, criteria,
  answers(JSON), timestamp, ip_address, user_agent,
  max_stage, lives_remaining, is_game_over, stage_results(JSON),
  created_at
)
```

---

## 오디오 구조

### 원본 (`audio/hashed/`)
- 200개 MP3 (AI 100 + Real 100)
- 12초, 192kbps, 해시 파일명 (12자)

### Variant (`audio/hashed/variants/`)
- 800개 파일 (200 × 4종), .gitignore 대상
- `{hash}_8s.mp3` — 앞 8초 트림 (Stage 2: Time Pressure)
- `{hash}_4s.mp3` — 앞 4초 트림 (Stage 5: Speed Round)
- `{hash}_128k.mp3` — 128kbps (Stage 3: Codec Challenge)
- `{hash}_64k.mp3` — 64kbps (Stage 4: Lo-Fi Challenge)
- 생성: `python scripts/prepare_variants.py` (pydub + ffmpeg 필요)

### Adversarial 트랙
- `pool.json`의 `adversarial_score` 필드 (0.80~0.95, 15개)
- Stage 6에서 점수 높은 순으로 선택
- ArtifactNet 연구 기반 수동 설정

---

## 배포

| 구성요소 | 호스팅 | URL |
|----------|--------|-----|
| 프론트엔드 | GitHub Pages (main 브랜치, /) | https://unohee.github.io/ai-music-survey/ |
| API 서버 | 자체 호스팅 (리버스 프록시) | https://survey.intrect.io |

### API URL 설정 위치
- `js/app.js` → `const API_URL = 'https://survey.intrect.io'`

### CORS 허용 오리진
- `server/server.py` → `https://unohee.github.io`, `localhost:8000`, `localhost:8090`, `127.0.0.1:8000`

### 서버 실행
```bash
cd server && pip install -r requirements.txt && uvicorn server:app --host 0.0.0.0 --port 8090
```

### Variant 생성 (최초 1회)
```bash
pip install pydub
python scripts/prepare_variants.py
```

---

## 관리자 인증

- **admin/index.html** 및 **server/admin.html** 둘 다 하드코딩된 인증 사용
- username: `intrect`, password: `Earwire0319!`
- sessionStorage 기반 (서버 세션 아님)
- 보안 수준 낮음 — 프로덕션 전 개선 필요

---

## 오디오 프라이버시

- 파일명: 12자 해시 (원본 소스 정보 노출 없음)
- 12초 세그먼트 (저작권 회피)
- label 난독화: 0=AI, 1=Real (pool.json에서)

---

## 히스토리 (커밋 기준)

| 커밋 | 내용 |
|------|------|
| `6a27c47` | 초기 배포 — 설문 UI + 오디오 풀 |
| `4ad969d` | 시드 리더보드 (12명 플레이스홀더) |
| `a007e12` | API 제출 + 실시간 리더보드 연동 |
| `ad17c80` | 관리자 대시보드 추가 |
| `67d3680` | 오디오 자동재생 |
| `9e82a83` | showResults async 수정 |
| `3c95a70` | 백엔드 통합 (survey-api → server/) |
| (미커밋) | 게이미피케이션 리디자인 — 6스테이지, 라이프, IP바인딩, variant |

---

## 알려진 이슈 / TODO

- [ ] 관리자 인증을 서버 사이드로 이전 (현재 클라이언트 하드코딩)
- [ ] Cloudflare Workers 백엔드 정리 또는 활용 결정
- [ ] 오디오 자동재생 모바일 브라우저 호환성 확인
- [ ] survey_results.db 백업 전략
- [ ] adversarial_score 자동 산출 (현재 수동 15개)
- [ ] GitHub Pages 배포 시 variants/ 폴더 용량 (~113MB) 대안 검토

---

## 레포 이전 이력

- **원본**: `unohee/ArtifactNet` (gh-pages 브랜치)
- **이전**: ArtifactNet에서 `survey-origin` 리모트로 `unohee/ai-music-survey`에 push
- **분리**: `~/dev/ai-music-survey/`로 독립 클론 + `survey-api` 백엔드 통합
- **ArtifactNet 정리**: gh-pages 브랜치 삭제 및 survey-origin 리모트 제거 대기 중
