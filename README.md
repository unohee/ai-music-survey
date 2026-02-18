# AI vs Real Music — Test Your Ears!

A gamified survey system that challenges players to distinguish AI-generated music from real human performances. Collects research data through a stage-based game with lives, leaderboard, and viral sharing mechanics.

## Live Demo

https://unohee.github.io/ai-music-survey/

## Game Flow

```
Welcome (Leaderboard + Nickname/IP binding)
  ▼
Warm-up: 5 questions (no life cost, collects research data)
  ▼
Stage 1: Normal        — 12s original clip, 5 questions, base 10 pts
Stage 2: Time Pressure — 8s clip, 5 questions, base 15 pts
Stage 3: Codec 128k    — 128kbps, 5 questions, base 20 pts
Stage 4: Lo-Fi 64k     — 64kbps, 5 questions, base 25 pts
Stage 5: Speed Round   — 4s clip, 5 questions, base 30 pts
Stage 6: Adversarial   — hardest-to-classify tracks, 5 questions, base 40 pts
  ▼
All Clear → Results + Leaderboard

* 3 lives, -1 per wrong answer, 0 = Game Over
```

## Project Structure

```
├── index.html              # Main game UI (7 screens)
├── js/
│   ├── app.js              # Game logic, stage system, API integration
│   └── i18n.js             # Internationalization (EN/KO)
├── css/style.css           # Styles (dark theme, stage UI)
├── audio/
│   ├── pool.json           # 200 track metadata + variants
│   ├── hashed/             # Original 192kbps 12s MP3s (200)
│   └── hashed/variants/    # Generated variants (800, .gitignored)
├── scripts/
│   └── prepare_variants.py # Audio variant generation script
├── server/
│   ├── server.py           # FastAPI server (SQLite, IP binding)
│   ├── requirements.txt
│   ├── admin.html          # Admin dashboard
│   ├── cloudflare-worker.js
│   └── wrangler.toml
└── admin/                  # Admin dashboard (standalone)
```

## Frontend

Statically hosted on GitHub Pages. Built with Vanilla JS and HTML5 Audio API.

- **Bilingual**: English default, Korean toggle (`?lang=ko` or UI button)
- Warm-up (5 questions for research) + 6 stages x 5 questions (game)
- 3 lives, stage-based score multipliers, streak bonuses
- IP-based nickname binding (auto-fill on revisit)
- Leaderboard shown at Welcome / Game Over / All Clear
- Seed leaderboard + localStorage fallback when API is unavailable

## Backend

```bash
cd server
pip install -r requirements.txt
uvicorn server:app --port 8090
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/check-user` | Look up existing nickname by IP |
| POST | `/api/register` | Bind nickname to IP |
| POST | `/api/submit` | Submit results (includes stage data) |
| GET | `/api/leaderboard` | Leaderboard (sorted by score DESC) |
| GET | `/api/stats` | Statistics |
| GET | `/api/results` | All results (admin) |
| GET | `/api/export` | Export for CSV |

## Audio Variants

```bash
pip install pydub
python scripts/prepare_variants.py
```

Generates 4 variants from 200 tracks in pool.json (800 files total):
- `_8s.mp3` — trimmed to first 8 seconds
- `_4s.mp3` — trimmed to first 4 seconds
- `_128k.mp3` — re-encoded at 128kbps
- `_64k.mp3` — re-encoded at 64kbps

## Audio Sources

| Type | Dataset | License |
|------|---------|---------|
| AI-generated | [Suno](https://suno.com), [Udio](https://udio.com), [Stable Audio](https://stability.ai) | Generated outputs |
| Real (human) | [FMA](https://github.com/mdeff/fma), [GTZAN](http://marsyas.info/downloads/datasets.html), [MUSDB18](https://sigsep.github.io/datasets/musdb.html) | CC / Research use |

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: FastAPI, SQLite, Pydantic
- **Audio**: pydub, ffmpeg
- **Hosting**: GitHub Pages (frontend), survey.intrect.io (API)
- **i18n**: Custom Vanilla JS (no dependencies)

## About & Privacy

This is an academic research project. No AI models run on this site — only pre-recorded audio clips (some AI-generated, some human-performed) are used. See the in-app "About This Study & Privacy" section for full details.

## License

Research use. Audio samples are used under their respective licenses.
