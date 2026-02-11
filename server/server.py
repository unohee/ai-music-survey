"""
AI Music Survey API Server
Created: 2026-02-11
Purpose: Collect survey results from GitHub Pages
"""

from fastapi import FastAPI, HTTPException
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
        "http://127.0.0.1:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 데이터 저장 경로
DATA_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(DATA_DIR, "survey_results.db")

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
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

init_db()

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

class LeaderboardEntry(BaseModel):
    nickname: str
    score: int
    accuracy: float
    correctCount: int
    maxStreak: int

@app.get("/")
def root():
    return {"status": "ok", "message": "AI Music Survey API"}

@app.get("/admin")
def admin_page():
    """Admin dashboard"""
    return FileResponse(os.path.join(DATA_DIR, "admin.html"))

@app.post("/api/submit")
def submit_result(result: SurveyResult):
    """설문 결과 제출"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute('''
        INSERT INTO results (
            nickname, email, score, accuracy, correct_count, max_streak,
            ai_accuracy, real_accuracy, duration,
            music_experience, ai_experience, criteria,
            answers, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        result.timestamp
    ))
    
    conn.commit()
    result_id = c.lastrowid
    conn.close()
    
    return {"success": True, "id": result_id}

@app.get("/api/leaderboard")
def get_leaderboard(limit: int = 100):
    """리더보드 조회"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    c.execute('''
        SELECT nickname, score, accuracy, correct_count, max_streak, timestamp
        FROM results
        ORDER BY score DESC
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
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
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
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    c.execute('SELECT * FROM results ORDER BY created_at DESC')
    rows = c.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8090)
