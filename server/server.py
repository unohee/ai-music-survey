"""
AI Music Survey API Server
Created: 2026-02-11
Purpose: Collect survey results from GitHub Pages
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List, Any
import json
import os
from datetime import datetime
import sqlite3

app = FastAPI(title="AI Music Survey API")

# CORS 설정 - GitHub Pages에서 접근 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://unohee.github.io",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:8090",
        "http://127.0.0.1:8090"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 데이터 저장 경로
DATA_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(DATA_DIR, "survey_results.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nickname TEXT,
            email TEXT,
            score INTEGER,
            accuracy REAL,
            correct_count INTEGER,
            max_streak INTEGER,
            ai_accuracy REAL,
            real_accuracy REAL,
            duration INTEGER,
            music_experience TEXT,
            ai_experience TEXT,
            criteria TEXT,
            answers TEXT,
            timestamp TEXT,
            ip_address TEXT,
            user_agent TEXT,
            max_stage INTEGER DEFAULT 0,
            lives_remaining INTEGER DEFAULT 0,
            is_game_over INTEGER DEFAULT 0,
            stage_results TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # users 테이블: IP-닉네임 바인딩
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip_address TEXT UNIQUE NOT NULL,
            nickname TEXT UNIQUE NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()

    # 기존 results 테이블에 새 컬럼이 없으면 추가
    existing_cols = {row[1] for row in c.execute("PRAGMA table_info(results)").fetchall()}
    new_cols = {
        "max_stage": "INTEGER DEFAULT 0",
        "lives_remaining": "INTEGER DEFAULT 0",
        "is_game_over": "INTEGER DEFAULT 0",
        "stage_results": "TEXT",
    }
    for col, typedef in new_cols.items():
        if col not in existing_cols:
            c.execute(f"ALTER TABLE results ADD COLUMN {col} {typedef}")
    conn.commit()
    conn.close()

init_db()


def get_client_ip(request: Request) -> str:
    """클라이언트 IP 추출 (프록시 고려)"""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


# ============================================================================
# Pydantic Models
# ============================================================================

class SurveyResult(BaseModel):
    nickname: str
    email: Optional[str] = ""
    score: int
    accuracy: float
    correctCount: int
    maxStreak: int
    aiAccuracy: float
    realAccuracy: float
    duration: int
    demographics: dict
    answers: List[dict]
    timestamp: str
    maxStage: Optional[int] = 0
    livesRemaining: Optional[int] = 0
    isGameOver: Optional[bool] = False
    stageResults: Optional[List[dict]] = None

class RegisterRequest(BaseModel):
    nickname: str


# ============================================================================
# Endpoints
# ============================================================================

@app.get("/")
def root():
    return {"status": "ok", "message": "AI Music Survey API"}

@app.get("/admin")
def admin_page():
    """Admin dashboard"""
    return FileResponse(os.path.join(DATA_DIR, "admin.html"))


@app.get("/api/check-user")
def check_user(request: Request):
    """IP로 기존 닉네임 조회"""
    ip = get_client_ip(request)
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT nickname FROM users WHERE ip_address = ?", (ip,))
    row = c.fetchone()
    conn.close()

    if row:
        return {"exists": True, "nickname": row["nickname"]}
    return {"exists": False, "nickname": None}


@app.post("/api/register")
def register_user(req: RegisterRequest, request: Request):
    """IP에 닉네임 바인딩"""
    ip = get_client_ip(request)
    nickname = req.nickname.strip()

    if not nickname or len(nickname) > 20:
        raise HTTPException(status_code=400, detail="닉네임은 1-20자여야 합니다.")

    conn = get_db()
    c = conn.cursor()

    # 중복 IP 확인
    c.execute("SELECT nickname FROM users WHERE ip_address = ?", (ip,))
    existing_ip = c.fetchone()
    if existing_ip:
        conn.close()
        return {"success": True, "nickname": existing_ip["nickname"], "message": "이미 등록된 IP입니다."}

    # 중복 닉네임 확인
    c.execute("SELECT id FROM users WHERE nickname = ?", (nickname,))
    if c.fetchone():
        conn.close()
        raise HTTPException(status_code=409, detail="이미 사용 중인 닉네임입니다.")

    try:
        c.execute("INSERT INTO users (ip_address, nickname) VALUES (?, ?)", (ip, nickname))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=409, detail="등록에 실패했습니다. 다시 시도해주세요.")

    conn.close()
    return {"success": True, "nickname": nickname}


@app.post("/api/submit")
def submit_result(result: SurveyResult, request: Request):
    """설문 결과 제출"""
    ip = get_client_ip(request)
    ua = request.headers.get("user-agent", "")

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute('''
        INSERT INTO results (
            nickname, email, score, accuracy, correct_count, max_streak,
            ai_accuracy, real_accuracy, duration,
            music_experience, ai_experience, criteria,
            answers, timestamp, ip_address, user_agent,
            max_stage, lives_remaining, is_game_over, stage_results
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        result.nickname,
        result.email,
        result.score,
        result.accuracy,
        result.correctCount,
        result.maxStreak,
        result.aiAccuracy,
        result.realAccuracy,
        result.duration,
        result.demographics.get('musicExperience', ''),
        result.demographics.get('aiExperience', ''),
        result.demographics.get('criteria', ''),
        json.dumps(result.answers, ensure_ascii=False),
        result.timestamp,
        ip,
        ua,
        result.maxStage,
        result.livesRemaining,
        1 if result.isGameOver else 0,
        json.dumps(result.stageResults, ensure_ascii=False) if result.stageResults else None,
    ))

    conn.commit()
    result_id = c.lastrowid
    conn.close()

    return {"success": True, "id": result_id}


@app.get("/api/leaderboard")
def get_leaderboard(limit: int = 100):
    """리더보드 조회 (max_stage DESC, score DESC)"""
    conn = get_db()
    c = conn.cursor()

    c.execute('''
        SELECT nickname, score, accuracy, correct_count, max_streak,
               max_stage, lives_remaining, is_game_over, timestamp
        FROM results
        ORDER BY max_stage DESC, score DESC
        LIMIT ?
    ''', (limit,))

    rows = c.fetchall()
    conn.close()

    return [dict(row) for row in rows]


@app.get("/api/stats")
def get_stats():
    """통계 조회"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute('SELECT COUNT(*) FROM results')
    total = c.fetchone()[0]

    c.execute('SELECT AVG(accuracy), AVG(score), AVG(ai_accuracy), AVG(real_accuracy) FROM results')
    avgs = c.fetchone()

    c.execute('SELECT music_experience, COUNT(*) FROM results GROUP BY music_experience')
    music_exp = dict(c.fetchall())

    c.execute('SELECT ai_experience, COUNT(*) FROM results GROUP BY ai_experience')
    ai_exp = dict(c.fetchall())

    conn.close()

    return {
        "total_participants": total,
        "avg_accuracy": round(avgs[0] or 0, 1),
        "avg_score": round(avgs[1] or 0, 1),
        "avg_ai_accuracy": round(avgs[2] or 0, 1),
        "avg_real_accuracy": round(avgs[3] or 0, 1),
        "music_experience": music_exp,
        "ai_experience": ai_exp
    }


@app.get("/api/results")
def get_results(limit: int = 100, offset: int = 0):
    """전체 결과 조회 (admin용)"""
    conn = get_db()
    c = conn.cursor()

    c.execute('''
        SELECT * FROM results
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    ''', (limit, offset))

    rows = c.fetchall()
    conn.close()

    return [dict(row) for row in rows]


@app.get("/api/export")
def export_results():
    """결과 내보내기 (CSV용 JSON)"""
    conn = get_db()
    c = conn.cursor()

    c.execute('SELECT * FROM results ORDER BY created_at DESC')
    rows = c.fetchall()
    conn.close()

    return [dict(row) for row in rows]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8090)
