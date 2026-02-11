/**
 * AI vs Real Music Survey
 * Created: 2026-02-11
 * Purpose: Interactive gamified survey for AI music detection research
 */

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
    totalQuestions: 30,
    practiceQuestions: 3,
    audioBasePath: 'audio/',
    // Points
    basePoints: 10,
    streakBonus: 5,
    maxStreakBonus: 50,
};

// Label mapping (obfuscated in pool.json)
const LABELS = { AI: 0, REAL: 1 };
const answerToLabel = (ans) => ans === 'ai' ? LABELS.AI : LABELS.REAL;
const labelToText = (lbl) => lbl === LABELS.AI ? 'AI 생성' : '사람 연주';
const labelToAnswer = (lbl) => lbl === LABELS.AI ? 'ai' : 'real';

// ============================================================================
// Sound Effects
// ============================================================================

const sfxCorrect = new Audio('audio/sfx/correct.mp3');
const sfxWrong = new Audio('audio/sfx/wrong.mp3');

// Preload
sfxCorrect.load();
sfxWrong.load();

function playCorrectSound() {
    sfxCorrect.currentTime = 0;
    sfxCorrect.volume = 0.5;
    sfxCorrect.play().catch(() => {});
}

function playWrongSound() {
    sfxWrong.currentTime = 0;
    sfxWrong.volume = 0.5;
    sfxWrong.play().catch(() => {});
}

// Debug mode (toggle with 'D' key)
let debugMode = false;

// ============================================================================
// State
// ============================================================================

let state = {
    mode: 'welcome', // welcome, practice, game, results
    currentQuestion: 0,
    practiceIndex: 0,
    nickname: '',
    email: '',
    score: 0,
    correctCount: 0,
    wrongCount: 0,
    streak: 0,
    maxStreak: 0,
    answers: [],
    selectedTracks: [],
    currentTrack: null,
    isPlaying: false,
    startTime: null,
    aiCorrect: 0,
    aiTotal: 0,
    realCorrect: 0,
    realTotal: 0,
};

// Audio pool - will be loaded from pool.json
let audioPool = [];
let practicePool = [];

// Audio element
let audio = null;

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    audio = document.getElementById('audio-player');

    // Setup audio events
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', onAudioEnded);
    audio.addEventListener('loadedmetadata', onAudioLoaded);

    // Debug mode disabled for production
    // document.addEventListener('keydown', (e) => {
    //     if (e.key === 'd' || e.key === 'D') {
    //         debugMode = !debugMode;
    //         updateDebugInfo(state.currentTrack);
    //     }
    // });

    // Load audio pool
    await loadAudioPool();

    console.log('Survey initialized');
});

async function loadAudioPool() {
    try {
        const response = await fetch('audio/pool.json');
        const data = await response.json();
        audioPool = data.tracks;
        practicePool = data.practice || audioPool.slice(0, 3);
        console.log(`Loaded ${audioPool.length} tracks`);
    } catch (error) {
        console.error('Failed to load audio pool:', error);
        // Use demo data if pool.json doesn't exist
        generateDemoPool();
    }
}

function generateDemoPool() {
    // Generate demo pool for testing
    audioPool = [];
    for (let i = 0; i < 50; i++) {
        audioPool.push({
            id: `ai_${i}`,
            file: `ai/track_${String(i).padStart(3, '0')}.mp3`,
            label: 'ai',
            duration: 12
        });
    }
    for (let i = 0; i < 50; i++) {
        audioPool.push({
            id: `real_${i}`,
            file: `real/track_${String(i).padStart(3, '0')}.mp3`,
            label: 'real',
            duration: 12
        });
    }
    practicePool = audioPool.slice(0, 3);
    console.log('Using demo pool');
}

// ============================================================================
// Screen Management
// ============================================================================

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(`screen-${screenId}`).classList.add('active');
    state.mode = screenId;
}

// ============================================================================
// Game Flow
// ============================================================================

function startGame() {
    // Validate nickname
    const nickname = document.getElementById('user-nickname').value.trim();
    const email = document.getElementById('user-email').value.trim();

    if (!nickname) {
        alert('닉네임을 입력해주세요!');
        document.getElementById('user-nickname').focus();
        return;
    }

    state.nickname = nickname;
    state.email = email;
    state.startTime = new Date();
    state.practiceIndex = 0;

    // Select random tracks for practice
    practicePool = shuffleArray([...audioPool]).slice(0, CONFIG.practiceQuestions);

    showScreen('practice');
    loadPracticeQuestion();
}

function loadPracticeQuestion() {
    const track = practicePool[state.practiceIndex];
    state.currentTrack = track;

    document.getElementById('practice-current').textContent = state.practiceIndex + 1;

    loadAudio(track);
    resetChoices();
    hideFeedback();
    document.getElementById('btn-next-practice').classList.add('hidden');
}

function startMainGame() {
    // Reset state for main game
    state.currentQuestion = 0;
    state.score = 0;
    state.correctCount = 0;
    state.wrongCount = 0;
    state.streak = 0;
    state.maxStreak = 0;
    state.answers = [];
    state.aiCorrect = 0;
    state.aiTotal = 0;
    state.realCorrect = 0;
    state.realTotal = 0;

    // Select random 30 tracks (15 AI + 15 Real for balance)
    const aiTracks = shuffleArray(audioPool.filter(t => t.label === LABELS.AI)).slice(0, 15);
    const realTracks = shuffleArray(audioPool.filter(t => t.label === LABELS.REAL)).slice(0, 15);
    state.selectedTracks = shuffleArray([...aiTracks, ...realTracks]);

    showScreen('game');
    updateUI();
    loadQuestion();
}

function loadQuestion() {
    const track = state.selectedTracks[state.currentQuestion];
    state.currentTrack = track;

    loadAudio(track);
    resetChoices();
    hideFeedback();
    document.getElementById('btn-next').classList.add('hidden');
}

function loadAudio(track) {
    stopAudio();
    audio.src = CONFIG.audioBasePath + track.file;
    audio.load();

    // Debug: 파일명 표시 (D키로 토글)
    updateDebugInfo(track);
}

function updateDebugInfo(track) {
    const source = track ? (track.source || track.file) : '';
    const label = track ? (track.label === LABELS.AI ? 'AI' : 'REAL') : '';
    const text = track ? `[${label}] ${source}` : '';

    // 연습모드용
    const debugEl = document.getElementById('debug-info');
    if (debugEl) {
        debugEl.textContent = text;
        debugEl.style.display = debugMode ? 'block' : 'none';
    }

    // 게임모드용
    const debugElGame = document.getElementById('debug-info-game');
    if (debugElGame) {
        debugElGame.textContent = text;
        debugElGame.style.display = debugMode ? 'block' : 'none';
    }
}

function onAudioLoaded() {
    const totalTime = formatTime(audio.duration);
    if (state.mode === 'practice') {
        document.getElementById('time-total-practice').textContent = totalTime;
        document.getElementById('time-current-practice').textContent = '0:00';
    } else {
        document.getElementById('time-total').textContent = totalTime;
        document.getElementById('time-current').textContent = '0:00';
    }
}

// ============================================================================
// Audio Controls
// ============================================================================

function togglePlay() {
    if (state.isPlaying) {
        pauseAudio();
    } else {
        playAudio();
    }
}

function playAudio() {
    audio.play();
    state.isPlaying = true;
    updatePlayButton(true);
}

function pauseAudio() {
    audio.pause();
    state.isPlaying = false;
    updatePlayButton(false);
}

function stopAudio() {
    audio.pause();
    audio.currentTime = 0;
    state.isPlaying = false;
    updatePlayButton(false);
}

function replayAudio() {
    audio.currentTime = 0;
    audio.play();
    state.isPlaying = true;
    updatePlayButton(true);
}

function updatePlayButton(playing) {
    const btnId = state.mode === 'practice' ? 'btn-play-practice' : 'btn-play-game';
    const btn = document.getElementById(btnId);
    const icon = btn.querySelector('.play-icon');

    if (playing) {
        btn.classList.add('playing');
        icon.textContent = '❚❚';
    } else {
        btn.classList.remove('playing');
        icon.textContent = '▶';
    }
}

function updateProgress() {
    const progress = (audio.currentTime / audio.duration) * 100;
    const currentTime = formatTime(audio.currentTime);

    if (state.mode === 'practice') {
        document.querySelector('#screen-practice .waveform-progress').style.width = `${progress}%`;
        document.getElementById('time-current-practice').textContent = currentTime;
    } else {
        document.getElementById('waveform-progress').style.width = `${progress}%`;
        document.getElementById('time-current').textContent = currentTime;
    }
}

function onAudioEnded() {
    state.isPlaying = false;
    updatePlayButton(false);
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================================================
// Answer Handling
// ============================================================================

function submitAnswer(answer) {
    stopAudio();

    const track = state.currentTrack;
    const isCorrect = answerToLabel(answer) === track.label;

    // Disable buttons
    disableChoices();

    // Mark selected button
    const btnId = answer === 'ai' ? 'btn-ai' : 'btn-real';
    document.getElementById(btnId).classList.add('selected');

    if (state.mode === 'practice') {
        showPracticeFeedback(isCorrect, track.label);
    } else {
        processGameAnswer(answer, isCorrect, track);
    }
}

function processGameAnswer(answer, isCorrect, track) {
    // Update stats
    if (isCorrect) {
        state.correctCount++;
        state.streak++;
        if (state.streak > state.maxStreak) {
            state.maxStreak = state.streak;
        }

        // Calculate points
        const streakBonus = Math.min(state.streak * CONFIG.streakBonus, CONFIG.maxStreakBonus);
        const points = CONFIG.basePoints + streakBonus;
        state.score += points;

        showScorePopup(`+${points}`);
    } else {
        state.wrongCount++;
        state.streak = 0;
    }

    // Track accuracy by type
    if (track.label === LABELS.AI) {
        state.aiTotal++;
        if (isCorrect) state.aiCorrect++;
    } else {
        state.realTotal++;
        if (isCorrect) state.realCorrect++;
    }

    // Save answer
    state.answers.push({
        trackId: track.id,
        label: track.label,
        answer: answer,
        correct: isCorrect,
        time: new Date().toISOString()
    });

    // Show feedback
    showFeedback(isCorrect, track.label);
    updateUI();

    // Show correct answer on buttons
    const correctBtnId = track.label === LABELS.AI ? 'btn-ai' : 'btn-real';
    document.getElementById(correctBtnId).classList.add('correct');
    if (!isCorrect) {
        const wrongBtnId = track.label === LABELS.AI ? 'btn-real' : 'btn-ai';
        document.getElementById(wrongBtnId).classList.add('wrong');
    }

    document.getElementById('btn-next').classList.remove('hidden');
}

function showPracticeFeedback(isCorrect, correctLabel) {
    const feedbackEl = document.getElementById('feedback-practice');
    const labelText = labelToText(correctLabel);

    // 효과음 재생
    if (isCorrect) {
        playCorrectSound();
        feedbackEl.className = 'feedback correct';
        feedbackEl.innerHTML = `✓ 정답! 이 음악은 <strong>${labelText}</strong>입니다.`;
    } else {
        playWrongSound();
        feedbackEl.className = 'feedback wrong';
        feedbackEl.innerHTML = `✗ 틀렸습니다. 정답은 <strong>${labelText}</strong>입니다.`;
    }
    feedbackEl.classList.remove('hidden');

    // Show correct answer
    const correctBtnClass = correctLabel === LABELS.AI ? '#screen-practice .btn-choice:first-child' : '#screen-practice .btn-choice:last-child';
    document.querySelector(correctBtnClass).classList.add('correct');

    document.getElementById('btn-next-practice').classList.remove('hidden');
}

function showFeedback(isCorrect, correctLabel) {
    const feedbackEl = document.getElementById('feedback');
    const labelText = labelToText(correctLabel);

    // 효과음 재생
    if (isCorrect) {
        playCorrectSound();
        feedbackEl.className = 'feedback correct';
        feedbackEl.innerHTML = `✓ 정답! +${CONFIG.basePoints + Math.min(state.streak * CONFIG.streakBonus, CONFIG.maxStreakBonus)}점 ${state.streak > 1 ? `(${state.streak}연속!)` : ''}`;
    } else {
        playWrongSound();
        feedbackEl.className = 'feedback wrong';
        feedbackEl.innerHTML = `✗ 정답은 <strong>${labelText}</strong>입니다.`;
    }
    feedbackEl.classList.remove('hidden');
}

function hideFeedback() {
    document.getElementById('feedback').classList.add('hidden');
    document.getElementById('feedback-practice').classList.add('hidden');
}

function showScorePopup(text) {
    const popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.textContent = text;
    document.body.appendChild(popup);

    setTimeout(() => popup.remove(), 500);
}

// ============================================================================
// UI Updates
// ============================================================================

function updateUI() {
    // Progress
    const progress = ((state.currentQuestion + 1) / CONFIG.totalQuestions) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;
    document.getElementById('question-current').textContent = state.currentQuestion + 1;

    // Score
    document.getElementById('score').textContent = state.score;

    // Stats
    document.getElementById('correct-count').textContent = state.correctCount;
    document.getElementById('wrong-count').textContent = state.wrongCount;
    document.getElementById('streak').textContent = state.streak;
}

function resetChoices() {
    const buttons = document.querySelectorAll('.btn-choice');
    buttons.forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('selected', 'correct', 'wrong');
    });
}

function disableChoices() {
    const buttons = document.querySelectorAll('.btn-choice');
    buttons.forEach(btn => btn.disabled = true);
}

// ============================================================================
// Navigation
// ============================================================================

function nextQuestion() {
    if (state.mode === 'practice') {
        state.practiceIndex++;
        if (state.practiceIndex >= CONFIG.practiceQuestions) {
            // Practice complete, start main game
            startMainGame();
        } else {
            loadPracticeQuestion();
        }
    } else {
        state.currentQuestion++;
        if (state.currentQuestion >= CONFIG.totalQuestions) {
            showResults();
        } else {
            loadQuestion();
        }
    }
}

// ============================================================================
// Results
// ============================================================================

function showResults() {
    showScreen('results');

    const accuracy = (state.correctCount / CONFIG.totalQuestions) * 100;
    const aiAccuracy = state.aiTotal > 0 ? (state.aiCorrect / state.aiTotal) * 100 : 0;
    const realAccuracy = state.realTotal > 0 ? (state.realCorrect / state.realTotal) * 100 : 0;

    document.getElementById('final-score').textContent = state.score;
    document.getElementById('result-accuracy').textContent = `${accuracy.toFixed(0)}%`;
    document.getElementById('result-correct').textContent = `${state.correctCount}/${CONFIG.totalQuestions}`;
    document.getElementById('result-streak').textContent = state.maxStreak;
    document.getElementById('ai-accuracy').textContent = `${aiAccuracy.toFixed(0)}%`;
    document.getElementById('real-accuracy').textContent = `${realAccuracy.toFixed(0)}%`;

    // Show rank
    showRank(accuracy);

    // Save to leaderboard and display
    await saveToLeaderboard();
    await displayLeaderboard();
}

function showRank(accuracy) {
    const rankEl = document.getElementById('rank-display');
    let rank, message;

    if (accuracy >= 90) {
        rank = '🏆 AI 탐지 전문가';
        message = '당신의 귀는 AI를 완벽하게 구분합니다!';
    } else if (accuracy >= 80) {
        rank = '🥇 골든 이어';
        message = '뛰어난 청각 능력을 가지고 있습니다!';
    } else if (accuracy >= 70) {
        rank = '🥈 실버 이어';
        message = '평균 이상의 탐지 능력입니다.';
    } else if (accuracy >= 60) {
        rank = '🥉 브론즈 이어';
        message = '조금만 더 연습하면 됩니다!';
    } else if (accuracy >= 50) {
        rank = '👂 일반인';
        message = 'AI와 사람을 구분하기 어려우시군요.';
    } else {
        rank = '🎲 운에 맡긴 자';
        message = '찍기보다 못한 결과... 반대로 찍으세요!';
    }

    rankEl.innerHTML = `<h2>${rank}</h2><p>${message}</p>`;
}

// ============================================================================
// Data Submission
// ============================================================================

const API_URL = 'https://survey.intrect.io';

async function submitResults() {
    const results = {
        nickname: state.nickname,
        email: state.email,
        timestamp: new Date().toISOString(),
        duration: Math.round((new Date() - state.startTime) / 1000),
        score: state.score,
        accuracy: (state.correctCount / CONFIG.totalQuestions) * 100,
        correctCount: state.correctCount,
        maxStreak: state.maxStreak,
        aiAccuracy: state.aiTotal > 0 ? (state.aiCorrect / state.aiTotal) * 100 : 0,
        realAccuracy: state.realTotal > 0 ? (state.realCorrect / state.realTotal) * 100 : 0,
        demographics: {
            musicExperience: document.getElementById('music-experience').value,
            aiExperience: document.getElementById('ai-experience').value,
            criteria: document.getElementById('criteria').value
        },
        answers: state.answers
    };

    // Submit to server
    try {
        const response = await fetch(`${API_URL}/api/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(results)
        });
        if (response.ok) {
            console.log('Results submitted successfully');
        }
    } catch (e) {
        console.error('Failed to submit results:', e);
    }

    // Save to localStorage as backup
    const savedResults = JSON.parse(localStorage.getItem('surveyResults') || '[]');
    savedResults.push(results);
    localStorage.setItem('surveyResults', JSON.stringify(savedResults));

    showScreen('thankyou');
}

function downloadResults(results) {
    const dataStr = JSON.stringify(results, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `survey_result_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function shareResults() {
    const accuracy = (state.correctCount / CONFIG.totalQuestions) * 100;
    const text = `나는 AI vs Real Music 테스트에서 ${accuracy.toFixed(0)}% 정확도로 ${state.score}점을 얻었다! 🎵\n당신도 도전해보세요!`;

    if (navigator.share) {
        navigator.share({
            title: 'AI vs Real Music',
            text: text,
            url: window.location.href
        });
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(text + '\n' + window.location.href)
            .then(() => alert('결과가 클립보드에 복사되었습니다!'));
    }
}

function copyLink() {
    navigator.clipboard.writeText(window.location.href)
        .then(() => alert('링크가 복사되었습니다!'));
}

function restartGame() {
    state = {
        mode: 'welcome',
        currentQuestion: 0,
        practiceIndex: 0,
        nickname: '',
        email: '',
        score: 0,
        correctCount: 0,
        wrongCount: 0,
        streak: 0,
        maxStreak: 0,
        answers: [],
        selectedTracks: [],
        currentTrack: null,
        isPlaying: false,
        startTime: null,
        aiCorrect: 0,
        aiTotal: 0,
        realCorrect: 0,
        realTotal: 0,
    };
    // Clear input fields
    document.getElementById('user-nickname').value = '';
    document.getElementById('user-email').value = '';
    showScreen('welcome');
}

// ============================================================================
// Utilities
// ============================================================================

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ============================================================================
// Leaderboard
// ============================================================================

// Initial placeholder users (seeded data)
const SEED_LEADERBOARD = [
    { nickname: "골든이어", score: 520, accuracy: 83, correctCount: 25, maxStreak: 8, timestamp: "2026-02-10T09:30:00Z" },
    { nickname: "음악덕후", score: 485, accuracy: 80, correctCount: 24, maxStreak: 7, timestamp: "2026-02-10T11:15:00Z" },
    { nickname: "프로듀서K", score: 460, accuracy: 77, correctCount: 23, maxStreak: 6, timestamp: "2026-02-09T14:20:00Z" },
    { nickname: "멜로디", score: 435, accuracy: 73, correctCount: 22, maxStreak: 5, timestamp: "2026-02-10T16:45:00Z" },
    { nickname: "비트메이커", score: 410, accuracy: 70, correctCount: 21, maxStreak: 5, timestamp: "2026-02-09T10:00:00Z" },
    { nickname: "사운드헌터", score: 380, accuracy: 67, correctCount: 20, maxStreak: 4, timestamp: "2026-02-10T13:30:00Z" },
    { nickname: "DJ_Seoul", score: 355, accuracy: 63, correctCount: 19, maxStreak: 4, timestamp: "2026-02-08T18:00:00Z" },
    { nickname: "뮤직러버", score: 320, accuracy: 60, correctCount: 18, maxStreak: 3, timestamp: "2026-02-10T20:15:00Z" },
    { nickname: "청음왕", score: 290, accuracy: 57, correctCount: 17, maxStreak: 3, timestamp: "2026-02-09T09:45:00Z" },
    { nickname: "음감테스터", score: 265, accuracy: 53, correctCount: 16, maxStreak: 3, timestamp: "2026-02-10T12:00:00Z" },
    { nickname: "랜덤리스너", score: 230, accuracy: 50, correctCount: 15, maxStreak: 2, timestamp: "2026-02-08T15:30:00Z" },
    { nickname: "초보청취자", score: 195, accuracy: 47, correctCount: 14, maxStreak: 2, timestamp: "2026-02-10T17:00:00Z" },
];

async function getLeaderboard() {
    // Try to fetch from API first
    try {
        const response = await fetch(`${API_URL}/api/leaderboard`);
        if (response.ok) {
            const apiData = await response.json();
            // API returns snake_case, convert to camelCase
            const converted = apiData.map(entry => ({
                nickname: entry.nickname,
                score: entry.score,
                accuracy: entry.accuracy,
                correctCount: entry.correct_count,
                maxStreak: entry.max_streak,
                timestamp: entry.timestamp
            }));
            // Merge with seed data and sort
            const merged = [...converted, ...SEED_LEADERBOARD];
            // Remove duplicates by nickname (keep higher score)
            const uniqueMap = new Map();
            merged.forEach(entry => {
                const existing = uniqueMap.get(entry.nickname);
                if (!existing || entry.score > existing.score) {
                    uniqueMap.set(entry.nickname, entry);
                }
            });
            const leaderboard = Array.from(uniqueMap.values());
            leaderboard.sort((a, b) => b.score - a.score);
            return leaderboard.slice(0, 100);
        }
    } catch (e) {
        console.error('Failed to fetch leaderboard from API:', e);
    }

    // Fallback to localStorage/seed
    let leaderboard = JSON.parse(localStorage.getItem('leaderboard') || 'null');
    if (leaderboard === null) {
        leaderboard = [...SEED_LEADERBOARD];
        localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
    }
    return leaderboard;
}

async function saveToLeaderboard() {
    const leaderboard = await getLeaderboard();
    const accuracy = (state.correctCount / CONFIG.totalQuestions) * 100;

    const entry = {
        nickname: state.nickname,
        score: state.score,
        accuracy: accuracy,
        correctCount: state.correctCount,
        maxStreak: state.maxStreak,
        timestamp: new Date().toISOString()
    };

    leaderboard.push(entry);

    // Sort by score (descending)
    leaderboard.sort((a, b) => b.score - a.score);

    // Keep top 100
    const trimmed = leaderboard.slice(0, 100);
    localStorage.setItem('leaderboard', JSON.stringify(trimmed));
}

async function displayLeaderboard() {
    const leaderboardEl = document.getElementById('leaderboard');
    const percentileEl = document.getElementById('percentile-display');

    // Show loading state
    leaderboardEl.innerHTML = '<p class="loading">리더보드 불러오는 중...</p>';

    const leaderboard = await getLeaderboard();

    if (leaderboard.length === 0) {
        leaderboardEl.innerHTML = '<p class="no-data">아직 기록이 없습니다.</p>';
        return;
    }

    // Find current user's rank
    const userRank = leaderboard.findIndex(e =>
        e.nickname === state.nickname &&
        e.score === state.score &&
        e.correctCount === state.correctCount
    ) + 1;

    // Calculate percentile
    const percentile = ((leaderboard.length - userRank) / leaderboard.length * 100).toFixed(0);

    // Show percentile
    if (userRank > 0) {
        percentileEl.innerHTML = `
            <div class="percentile-badge">
                <span class="percentile-rank">${userRank}위</span>
                <span class="percentile-text">상위 ${percentile > 0 ? percentile : 1}%</span>
            </div>
        `;
    }

    // Build leaderboard HTML (top 10)
    const top10 = leaderboard.slice(0, 10);
    let html = '<table class="leaderboard-table"><thead><tr><th>#</th><th>닉네임</th><th>점수</th><th>정확도</th></tr></thead><tbody>';

    top10.forEach((entry, index) => {
        const isCurrentUser = entry.nickname === state.nickname &&
                             entry.score === state.score &&
                             entry.correctCount === state.correctCount;
        const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : (index + 1);

        html += `
            <tr class="${isCurrentUser ? 'current-user' : ''}">
                <td>${rankIcon}</td>
                <td>${escapeHtml(entry.nickname)}</td>
                <td>${entry.score}</td>
                <td>${entry.accuracy.toFixed(0)}%</td>
            </tr>
        `;
    });

    // If user is not in top 10, show their position
    if (userRank > 10) {
        const userEntry = leaderboard[userRank - 1];
        html += `
            <tr class="separator"><td colspan="4">...</td></tr>
            <tr class="current-user">
                <td>${userRank}</td>
                <td>${escapeHtml(userEntry.nickname)}</td>
                <td>${userEntry.score}</td>
                <td>${userEntry.accuracy.toFixed(0)}%</td>
            </tr>
        `;
    }

    html += '</tbody></table>';
    leaderboardEl.innerHTML = html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
