# AI vs Real Music Survey

AI 생성 음악과 실제 연주를 구별하는 인터랙티브 설문 조사 시스템.

## Live

https://unohee.github.io/ai-music-survey/

## 구조

```
├── index.html          # 메인 설문 페이지
├── admin/              # 관리자 대시보드
├── js/app.js           # 설문 로직, API 연동
├── css/style.css       # 스타일
├── audio/              # 오디오 파일 + pool.json
└── server/             # 백엔드 API
    ├── server.py       # FastAPI 서버 (SQLite)
    ├── requirements.txt
    ├── admin.html      # 독립 관리자 페이지
    ├── cloudflare-worker.js  # Cloudflare Workers 대안
    └── wrangler.toml
```

## 프론트엔드

GitHub Pages에서 정적 호스팅. Vanilla JS, HTML5 Audio API 사용.

- 30문항 게임형 설문 (15 AI + 15 Real)
- 스트릭 보너스, 리더보드, 인구통계 수집
- API 실패 시 localStorage 폴백

## 백엔드

```bash
cd server
pip install -r requirements.txt
uvicorn server:app --port 8090
```

### API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/submit` | 설문 결과 제출 |
| GET | `/api/leaderboard` | 리더보드 조회 |
| GET | `/api/stats` | 통계 조회 |
| GET | `/api/results` | 전체 결과 (관리자) |
| GET | `/api/export` | CSV 내보내기 |

## 기술 스택

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: FastAPI, SQLite, Pydantic
- **Hosting**: GitHub Pages (frontend), survey.intrect.io (API)
