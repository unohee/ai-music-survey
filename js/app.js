/**
 * AI vs Real Music Survey — Gamification Edition
 * Created: 2026-02-11
 * Purpose: Stage-based gamification + AI music detection research data collection
 */

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
    evaluationQuestions: 5,  // Warm-up (research data, no life cost)
    stages: [
        { id: 1, name: 'Normal',          questions: 5, variant: 'original', pointBase: 10, clearBonus: 50,
          descKey: 'stage_1_desc' },
        { id: 2, name: 'Time Pressure',   questions: 5, variant: '8s',      pointBase: 15, clearBonus: 75,
          descKey: 'stage_2_desc' },
        { id: 3, name: 'Codec Challenge',  questions: 5, variant: '128k',    pointBase: 20, clearBonus: 100,
          descKey: 'stage_3_desc' },
        { id: 4, name: 'Lo-Fi Challenge',  questions: 5, variant: '64k',     pointBase: 25, clearBonus: 125,
          descKey: 'stage_4_desc' },
        { id: 5, name: 'Speed Round',      questions: 5, variant: '4s',      pointBase: 30, clearBonus: 150,
          descKey: 'stage_5_desc' },
        { id: 6, name: 'Adversarial',      questions: 5, variant: 'original', pointBase: 40, clearBonus: 200,
          descKey: 'stage_6_desc', adversarial: true },
    ],
    maxLives: 3,
    streakBonus: 5,
    maxStreakBonus: 50,
    lifeBonus: 100,
    audioBasePath: 'audio/',
};

// Debug mode: ?debug=true
const DEBUG_MODE = new URLSearchParams(window.location.search).get('debug') === 'true';

const LABELS = { AI: 0, REAL: 1 };
const answerToLabel = (ans) => ans === 'ai' ? LABELS.AI : LABELS.REAL;
const labelToText = (lbl) => lbl === LABELS.AI ? t('label_ai') : t('label_real');

// ============================================================================
// Sound Effects
// ============================================================================

const sfxCorrect = new Audio('audio/sfx/correct.mp3');
const sfxWrong = new Audio('audio/sfx/wrong.mp3');
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

// Debug mode
let debugMode = false;

// ============================================================================
// State
// ============================================================================

let state = {
    mode: 'welcome',       // welcome, evaluation, stage-intro, game, game-over, results
    nickname: '',
    email: '',
    isReturningUser: false,

    // Evaluation (warm-up)
    evalIndex: 0,
    evalTracks: [],
    evalAnswers: [],

    // Game
    currentStageIndex: 0,  // 0~5 (CONFIG.stages index)
    stageQuestionIndex: 0, // question index within stage (0~4)
    lives: CONFIG.maxLives,
    score: 0,
    correctCount: 0,
    wrongCount: 0,
    streak: 0,
    maxStreak: 0,
    answers: [],
    stageResults: [],      // [{stageId, name, cleared, correct, total, score}]
    stageTracks: [],       // current stage tracks

    currentTrack: null,
    isPlaying: false,
    startTime: null,
    aiCorrect: 0,
    aiTotal: 0,
    realCorrect: 0,
    realTotal: 0,
};

// Audio pool
let audioPool = [];
let audio = null;

// ============================================================================
// API
// ============================================================================

const API_URL = 'https://survey.intrect.io';

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // i18n initialization
    setLanguage(detectLanguage());

    audio = document.getElementById('audio-player');
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', onAudioEnded);
    audio.addEventListener('loadedmetadata', onAudioLoaded);

    await loadAudioPool();
    await checkExistingUser();
    await displayWelcomeLeaderboard();

    if (DEBUG_MODE) {
        console.log('🔧 DEBUG MODE ON — infinite lives');
        document.title = '[DEBUG] ' + document.title;
    }
    console.log('Survey initialized');
});

async function loadAudioPool() {
    try {
        const response = await fetch('audio/pool.json');
        const data = await response.json();
        audioPool = data.tracks;
        console.log(`Loaded ${audioPool.length} tracks`);
    } catch (error) {
        console.error('Failed to load audio pool:', error);
        generateDemoPool();
    }
}

function generateDemoPool() {
    audioPool = [];
    for (let i = 0; i < 100; i++) {
        audioPool.push({
            id: `ai_${String(i).padStart(3, '0')}`,
            file: `hashed/demo_ai_${i}.mp3`,
            label: 0, duration: 12,
            variants: {}, adversarial_score: null
        });
    }
    for (let i = 0; i < 100; i++) {
        audioPool.push({
            id: `real_${String(i).padStart(3, '0')}`,
            file: `hashed/demo_real_${i}.mp3`,
            label: 1, duration: 12,
            variants: {}, adversarial_score: null
        });
    }
}

// ============================================================================
// IP Check / User Registration
// ============================================================================

async function checkExistingUser() {
    try {
        const res = await fetch(`${API_URL}/api/check-user`);
        if (res.ok) {
            const data = await res.json();
            if (data.exists && data.nickname) {
                state.isReturningUser = true;
                state.nickname = data.nickname;
                const input = document.getElementById('user-nickname');
                input.value = data.nickname;
                input.disabled = true;
                document.getElementById('nickname-status').textContent = t('returning_user');
                document.getElementById('nickname-status').classList.add('returning');
            }
        }
    } catch (e) {
        console.log('IP check unavailable (offline mode)');
    }
}

async function registerUser(nickname) {
    try {
        const res = await fetch(`${API_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nickname })
        });
        if (res.ok) {
            return { success: true };
        }
        const err = await res.json();
        // Server returns error codes — translate on client
        const errMsg = t(err.detail) || err.detail || t('err_register_fallback');
        return { success: false, message: errMsg };
    } catch (e) {
        // Offline — proceed anyway
        return { success: true };
    }
}

// ============================================================================
// Screen Management
// ============================================================================

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${screenId}`).classList.add('active');
    state.mode = screenId;
    window.scrollTo(0, 0);
}

// ============================================================================
// Game Flow
// ============================================================================

async function startGame() {
    const nickname = document.getElementById('user-nickname').value.trim();
    const email = document.getElementById('user-email').value.trim();

    if (!nickname) {
        alert(t('alert_nickname_required'));
        document.getElementById('user-nickname').focus();
        return;
    }

    // Register new user
    if (!state.isReturningUser) {
        const reg = await registerUser(nickname);
        if (!reg.success) {
            alert(reg.message);
            return;
        }
    }

    state.nickname = nickname;
    state.email = email;
    state.startTime = new Date();

    // Warm-up track selection (5: AI 3 + Real 2 or AI 2 + Real 3)
    const aiTracks = shuffleArray(audioPool.filter(t => t.label === LABELS.AI));
    const realTracks = shuffleArray(audioPool.filter(t => t.label === LABELS.REAL));
    state.evalTracks = shuffleArray([...aiTracks.slice(0, 3), ...realTracks.slice(0, 2)]);
    state.evalIndex = 0;
    state.evalAnswers = [];

    showScreen('evaluation');
    loadEvalQuestion();
}

// ============================================================================
// Evaluation (Warm-up 5 questions)
// ============================================================================

function loadEvalQuestion() {
    const track = state.evalTracks[state.evalIndex];
    state.currentTrack = track;

    document.getElementById('eval-current').textContent = state.evalIndex + 1;
    // Update warm-up count text
    const countEl = document.getElementById('eval-count-text');
    if (countEl) {
        countEl.innerHTML = t('warmup_count', { current: state.evalIndex + 1 }).replace(
            String(state.evalIndex + 1),
            `<span id="eval-current">${state.evalIndex + 1}</span>`
        );
    }
    loadAudio(track, 'original');
    resetChoices();
    hideFeedback();
    document.getElementById('btn-next-eval').classList.add('hidden');
}

function processEvalAnswer(answer, isCorrect, track) {
    state.evalAnswers.push({
        trackId: track.id,
        label: track.label,
        answer: answer,
        correct: isCorrect,
        phase: 'evaluation',
        time: new Date().toISOString()
    });

    // Feedback
    const feedbackEl = document.getElementById('feedback-eval');
    const labelText = labelToText(track.label);

    if (isCorrect) {
        playCorrectSound();
        feedbackEl.className = 'feedback correct';
        feedbackEl.innerHTML = tHtml('feedback_correct', { label: `<strong>${labelText}</strong>` });
    } else {
        playWrongSound();
        feedbackEl.className = 'feedback wrong';
        feedbackEl.innerHTML = tHtml('feedback_wrong', { label: `<strong>${labelText}</strong>` });
    }
    feedbackEl.classList.remove('hidden');

    // Highlight correct button
    const correctBtnClass = track.label === LABELS.AI
        ? '#screen-evaluation .btn-choice:first-child'
        : '#screen-evaluation .btn-choice:last-child';
    document.querySelector(correctBtnClass).classList.add('correct');

    document.getElementById('btn-next-eval').classList.remove('hidden');
}

function nextEvalQuestion() {
    state.evalIndex++;
    if (state.evalIndex >= CONFIG.evaluationQuestions) {
        // Warm-up complete → Stage 1 intro
        startStageSystem();
    } else {
        loadEvalQuestion();
    }
}

// ============================================================================
// Stage System
// ============================================================================

function startStageSystem() {
    state.currentStageIndex = 0;
    state.lives = CONFIG.maxLives;
    state.score = 0;
    state.correctCount = 0;
    state.wrongCount = 0;
    state.streak = 0;
    state.maxStreak = 0;
    state.answers = [];
    state.stageResults = [];
    state.aiCorrect = 0;
    state.aiTotal = 0;
    state.realCorrect = 0;
    state.realTotal = 0;

    showStageIntro();
}

function showStageIntro() {
    const stage = CONFIG.stages[state.currentStageIndex];

    document.getElementById('stage-intro-number').textContent = `STAGE ${stage.id}`;
    document.getElementById('stage-intro-name').textContent = stage.name;
    document.getElementById('stage-intro-desc').textContent = t(stage.descKey);
    document.getElementById('stage-intro-condition').innerHTML =
        `<span>${t('stage_questions', { n: stage.questions })}</span>` +
        `<span>${t('stage_points', { n: stage.pointBase })}</span>` +
        (stage.clearBonus ? `<span>${t('stage_clear_bonus', { n: stage.clearBonus })}</span>` : '');

    // Lives display
    updateLivesDisplay('stage-intro-lives');

    showScreen('stage-intro');
}

function startStage() {
    const stage = CONFIG.stages[state.currentStageIndex];
    state.stageQuestionIndex = 0;

    // Select tracks for stage
    state.stageTracks = selectTracksForStage(stage);

    showScreen('game');
    updateGameUI();
    loadGameQuestion();
}

function selectTracksForStage(stage) {
    // Collect used track IDs
    const usedIds = new Set([
        ...state.evalAnswers.map(a => a.trackId),
        ...state.answers.map(a => a.trackId)
    ]);

    let candidates;

    if (stage.adversarial) {
        // Boss: use tracks with high adversarial_score
        candidates = audioPool
            .filter(t => t.adversarial_score != null && t.adversarial_score > 0 && !usedIds.has(t.id))
            .sort((a, b) => b.adversarial_score - a.adversarial_score);

        if (candidates.length < stage.questions) {
            const extra = audioPool.filter(t => !usedIds.has(t.id) && !candidates.find(c => c.id === t.id));
            candidates = [...candidates, ...shuffleArray(extra)];
        }
    } else {
        candidates = audioPool.filter(t => !usedIds.has(t.id));
    }

    // AI/Real balance (half each)
    const aiCount = Math.ceil(stage.questions / 2);
    const realCount = stage.questions - aiCount;

    const aiCandidates = shuffleArray(candidates.filter(t => t.label === LABELS.AI));
    const realCandidates = shuffleArray(candidates.filter(t => t.label === LABELS.REAL));

    const selected = [
        ...aiCandidates.slice(0, aiCount),
        ...realCandidates.slice(0, realCount)
    ];

    // Fill remaining if not enough
    if (selected.length < stage.questions) {
        const remaining = shuffleArray(candidates.filter(t => !selected.find(s => s.id === t.id)));
        selected.push(...remaining.slice(0, stage.questions - selected.length));
    }

    return shuffleArray(selected);
}

// ============================================================================
// Audio Loading
// ============================================================================

function loadAudio(track, variant) {
    stopAudio();

    let filePath;
    if (variant === 'original' || !variant || !track.variants || !track.variants[variant]) {
        filePath = track.file;
    } else {
        filePath = track.variants[variant];
    }

    // Store activeFile for debug
    track._activeFile = filePath;
    audio.src = CONFIG.audioBasePath + filePath;
    audio.load();

    updateDebugInfo(track);
}

function loadGameQuestion() {
    const stage = CONFIG.stages[state.currentStageIndex];
    const track = state.stageTracks[state.stageQuestionIndex];
    state.currentTrack = track;

    loadAudio(track, stage.variant);
    resetChoices();
    hideFeedback();
    document.getElementById('btn-next').classList.add('hidden');
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
    let btnId;
    if (state.mode === 'evaluation') btnId = 'btn-play-eval';
    else btnId = 'btn-play-game';

    const btn = document.getElementById(btnId);
    if (!btn) return;
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

    if (state.mode === 'evaluation') {
        const el = document.querySelector('#screen-evaluation .waveform-progress');
        if (el) el.style.width = `${progress}%`;
        const timeEl = document.getElementById('time-current-eval');
        if (timeEl) timeEl.textContent = currentTime;
    } else {
        const el = document.getElementById('waveform-progress');
        if (el) el.style.width = `${progress}%`;
        const timeEl = document.getElementById('time-current');
        if (timeEl) timeEl.textContent = currentTime;
    }
}

function onAudioLoaded() {
    const totalTime = formatTime(audio.duration);
    if (state.mode === 'evaluation') {
        document.getElementById('time-total-eval').textContent = totalTime;
        document.getElementById('time-current-eval').textContent = '0:00';
    } else {
        document.getElementById('time-total').textContent = totalTime;
        document.getElementById('time-current').textContent = '0:00';
    }
    playAudio();
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

function updateDebugInfo(track) {
    const source = track ? (track._activeFile || track.file) : '';
    const label = track ? (track.label === LABELS.AI ? 'AI' : 'REAL') : '';
    const text = track ? `[${label}] ${source}` : '';

    const debugEl = document.getElementById('debug-info');
    if (debugEl) {
        debugEl.textContent = text;
        debugEl.style.display = debugMode ? 'block' : 'none';
    }
    const debugElGame = document.getElementById('debug-info-game');
    if (debugElGame) {
        debugElGame.textContent = text;
        debugElGame.style.display = debugMode ? 'block' : 'none';
    }
}

// ============================================================================
// Answer Handling
// ============================================================================

function submitAnswer(answer) {
    stopAudio();

    const track = state.currentTrack;
    const isCorrect = answerToLabel(answer) === track.label;

    disableChoices();

    if (state.mode === 'evaluation') {
        processEvalAnswer(answer, isCorrect, track);
    } else {
        processGameAnswer(answer, isCorrect, track);
    }
}

function processGameAnswer(answer, isCorrect, track) {
    const stage = CONFIG.stages[state.currentStageIndex];

    if (isCorrect) {
        state.correctCount++;
        state.streak++;
        if (state.streak > state.maxStreak) state.maxStreak = state.streak;

        const streakBonus = Math.min(state.streak * CONFIG.streakBonus, CONFIG.maxStreakBonus);
        const points = stage.pointBase + streakBonus;
        state.score += points;

        playCorrectSound();
        showScorePopup(`+${points}`);
    } else {
        state.wrongCount++;
        state.streak = 0;
        if (!DEBUG_MODE) state.lives--;

        playWrongSound();

        // Life lost animation
        if (!DEBUG_MODE) animateLifeLost();
    }

    // AI/Real accuracy tracking
    if (track.label === LABELS.AI) {
        state.aiTotal++;
        if (isCorrect) state.aiCorrect++;
    } else {
        state.realTotal++;
        if (isCorrect) state.realCorrect++;
    }

    state.answers.push({
        trackId: track.id,
        label: track.label,
        answer: answer,
        correct: isCorrect,
        stageId: stage.id,
        stageName: stage.name,
        variant: stage.variant,
        time: new Date().toISOString()
    });

    // Show feedback
    showGameFeedback(isCorrect, track.label, stage);
    updateGameUI();

    // Highlight correct/wrong buttons
    const correctBtnId = track.label === LABELS.AI ? 'btn-ai' : 'btn-real';
    document.getElementById(correctBtnId).classList.add('correct');
    if (!isCorrect) {
        const wrongBtnId = track.label === LABELS.AI ? 'btn-real' : 'btn-ai';
        document.getElementById(wrongBtnId).classList.add('wrong');
    }

    document.getElementById('btn-next').classList.remove('hidden');
}

function showGameFeedback(isCorrect, correctLabel, stage) {
    const feedbackEl = document.getElementById('feedback');
    const labelText = labelToText(correctLabel);

    if (isCorrect) {
        const streakBonus = Math.min(state.streak * CONFIG.streakBonus, CONFIG.maxStreakBonus);
        const points = stage.pointBase + streakBonus;
        const streakStr = state.streak > 1 ? t('streak_text', { n: state.streak }) : '';
        feedbackEl.className = 'feedback correct';
        feedbackEl.innerHTML = tHtml('feedback_correct_points', { points: points, streak: streakStr });
    } else {
        feedbackEl.className = 'feedback wrong';
        feedbackEl.innerHTML = tHtml('feedback_wrong_life', { label: `<strong>${labelText}</strong>` });
    }
    feedbackEl.classList.remove('hidden');
}

function hideFeedback() {
    const ids = ['feedback', 'feedback-eval'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
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

function updateGameUI() {
    const stage = CONFIG.stages[state.currentStageIndex];

    // Stage badge
    document.getElementById('stage-badge').textContent = `Stage ${stage.id}: ${stage.name}`;

    // Progress (within stage)
    const progress = ((state.stageQuestionIndex + 1) / stage.questions) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;
    document.getElementById('question-current').textContent = `${state.stageQuestionIndex + 1}`;

    // Lives
    updateLivesDisplay('lives-display');

    // Score
    document.getElementById('score').textContent = state.score;

    // Stats
    document.getElementById('correct-count').textContent = state.correctCount;
    document.getElementById('wrong-count').textContent = state.wrongCount;
    document.getElementById('streak').textContent = state.streak;
}

function updateLivesDisplay(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    let html = '';
    for (let i = 0; i < CONFIG.maxLives; i++) {
        if (i < state.lives) {
            html += '<span class="life">❤️</span>';
        } else {
            html += '<span class="life lost">🖤</span>';
        }
    }
    el.innerHTML = html;
}

function animateLifeLost() {
    const livesEl = document.getElementById('lives-display');
    if (!livesEl) return;
    livesEl.classList.add('shake');
    setTimeout(() => livesEl.classList.remove('shake'), 500);
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
    if (state.mode === 'evaluation') {
        nextEvalQuestion();
        return;
    }

    // Game mode: life check
    if (state.lives <= 0 && !DEBUG_MODE) {
        handleGameOver();
        return;
    }

    const stage = CONFIG.stages[state.currentStageIndex];
    state.stageQuestionIndex++;

    if (state.stageQuestionIndex >= stage.questions) {
        // Stage clear!
        completeStage(stage);
    } else {
        loadGameQuestion();
    }
}

function completeStage(stage) {
    // Record stage result
    const stageCorrect = state.answers
        .filter(a => a.stageId === stage.id && a.correct).length;

    // Clear bonus
    state.score += stage.clearBonus;

    // Life recovery on stage clear (+1, capped at max)
    if (state.lives < CONFIG.maxLives) {
        state.lives++;
        showScorePopup(`+${stage.clearBonus} CLEAR! ❤️+1`);
    } else {
        showScorePopup(`+${stage.clearBonus} CLEAR!`);
    }

    state.stageResults.push({
        stageId: stage.id,
        name: stage.name,
        cleared: true,
        correct: stageCorrect,
        total: stage.questions,
        score: stage.clearBonus
    });

    // Next stage check
    state.currentStageIndex++;
    if (state.currentStageIndex >= CONFIG.stages.length) {
        // All Clear!
        handleAllClear();
    } else {
        showStageIntro();
    }
}

function handleGameOver() {
    const stage = CONFIG.stages[state.currentStageIndex];

    // Record current stage result (incomplete)
    const stageCorrect = state.answers
        .filter(a => a.stageId === stage.id && a.correct).length;
    const stageTotal = state.answers
        .filter(a => a.stageId === stage.id).length;

    state.stageResults.push({
        stageId: stage.id,
        name: stage.name,
        cleared: false,
        correct: stageCorrect,
        total: stageTotal,
        score: 0
    });

    // Remaining stages are locked
    for (let i = state.currentStageIndex + 1; i < CONFIG.stages.length; i++) {
        state.stageResults.push({
            stageId: CONFIG.stages[i].id,
            name: CONFIG.stages[i].name,
            cleared: false,
            correct: 0,
            total: 0,
            score: 0,
            locked: true
        });
    }

    // Game Over screen
    document.getElementById('gameover-stage').textContent = t('gameover_stage', { id: stage.id, name: stage.name });
    document.getElementById('gameover-score').textContent = state.score;

    renderStageSummary('gameover-stage-summary');

    showScreen('game-over');

    // Auto submit + leaderboard
    autoSubmitAndShowLeaderboard('gameover');
}

async function handleAllClear() {
    // Remaining life bonus
    const lifeBonus = state.lives * CONFIG.lifeBonus;
    state.score += lifeBonus;
    if (lifeBonus > 0) showScorePopup(`+${lifeBonus} LIFE BONUS!`);

    // Results screen
    const totalQuestions = CONFIG.stages.reduce((sum, s) => sum + s.questions, 0);
    const accuracy = totalQuestions > 0 ? (state.correctCount / totalQuestions) * 100 : 0;
    const aiAccuracy = state.aiTotal > 0 ? (state.aiCorrect / state.aiTotal) * 100 : 0;
    const realAccuracy = state.realTotal > 0 ? (state.realCorrect / state.realTotal) * 100 : 0;

    document.getElementById('final-score').textContent = state.score;
    document.getElementById('result-accuracy').textContent = `${accuracy.toFixed(0)}%`;
    document.getElementById('result-correct').textContent = `${state.correctCount}/${totalQuestions}`;
    document.getElementById('result-streak').textContent = state.maxStreak;
    document.getElementById('result-lives').textContent = `❤️×${state.lives}`;
    document.getElementById('ai-accuracy').textContent = `${aiAccuracy.toFixed(0)}%`;
    document.getElementById('real-accuracy').textContent = `${realAccuracy.toFixed(0)}%`;

    showRank(accuracy);
    renderStageSummary('results-stage-summary');

    showScreen('results');

    await autoSubmitAndShowLeaderboard('results');
}

// ============================================================================
// Stage Summary Rendering
// ============================================================================

function renderStageSummary(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    let html = `<h3>${t('stage_summary_title')}</h3>`;
    CONFIG.stages.forEach((stage, idx) => {
        const result = state.stageResults.find(r => r.stageId === stage.id);
        let cls = 'locked';
        let status = '🔒';
        let detail = '';

        if (result) {
            if (result.locked) {
                cls = 'locked';
                status = '🔒';
            } else if (result.cleared) {
                cls = 'cleared';
                status = '✅';
                detail = `${result.correct}/${result.total} (+${result.score})`;
            } else {
                cls = 'failed';
                status = '💀';
                detail = `${result.correct}/${result.total}`;
            }
        }

        html += `
            <div class="stage-summary-row ${cls}">
                <span class="stage-summary-status">${status}</span>
                <span class="stage-summary-name">Stage ${stage.id}: ${stage.name}</span>
                <span class="stage-summary-detail">${detail}</span>
            </div>
        `;
    });

    el.innerHTML = html;
}

// ============================================================================
// Results & Rank
// ============================================================================

function showRank(accuracy) {
    const rankEl = document.getElementById('rank-display');
    let rank, message;

    if (accuracy >= 90) {
        rank = t('rank_expert');
        message = t('rank_expert_msg');
    } else if (accuracy >= 80) {
        rank = t('rank_gold');
        message = t('rank_gold_msg');
    } else if (accuracy >= 70) {
        rank = t('rank_silver');
        message = t('rank_silver_msg');
    } else if (accuracy >= 60) {
        rank = t('rank_bronze');
        message = t('rank_bronze_msg');
    } else if (accuracy >= 50) {
        rank = t('rank_normal');
        message = t('rank_normal_msg');
    } else {
        rank = t('rank_random');
        message = t('rank_random_msg');
    }

    rankEl.innerHTML = `<h2>${rank}</h2><p>${message}</p>`;
}

// ============================================================================
// Data Submission
// ============================================================================

function buildSubmitPayload(demographicsPrefix) {
    const totalQuestions = CONFIG.stages.reduce((sum, s) => sum + s.questions, 0);
    const questionsAnswered = state.answers.length;
    const accuracy = questionsAnswered > 0 ? (state.correctCount / questionsAnswered) * 100 : 0;
    const maxStage = Math.min(state.currentStageIndex + 1, CONFIG.stages.length);

    const prefix = demographicsPrefix || '';
    const musicExpId = prefix ? `${prefix}-music-experience` : 'music-experience';
    const aiExpId = prefix ? `${prefix}-ai-experience` : 'ai-experience';
    const criteriaId = prefix ? `${prefix}-criteria` : 'criteria';

    return {
        nickname: state.nickname,
        email: state.email,
        timestamp: new Date().toISOString(),
        duration: Math.round((new Date() - state.startTime) / 1000),
        score: state.score,
        accuracy: accuracy,
        correctCount: state.correctCount,
        maxStreak: state.maxStreak,
        aiAccuracy: state.aiTotal > 0 ? (state.aiCorrect / state.aiTotal) * 100 : 0,
        realAccuracy: state.realTotal > 0 ? (state.realCorrect / state.realTotal) * 100 : 0,
        maxStage: maxStage,
        livesRemaining: state.lives,
        isGameOver: state.lives <= 0,
        stageResults: state.stageResults,
        demographics: {
            musicExperience: document.getElementById(musicExpId)?.value || '',
            aiExperience: document.getElementById(aiExpId)?.value || '',
            criteria: document.getElementById(criteriaId)?.value || ''
        },
        answers: [...state.evalAnswers, ...state.answers]
    };
}

async function submitResults() {
    const results = buildSubmitPayload('');
    await doSubmit(results);
    showScreen('thankyou');
}

async function submitResultsFromGameOver() {
    const results = buildSubmitPayload('gameover');
    await doSubmit(results);
    showScreen('thankyou');
}

async function doSubmit(results) {
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

    // localStorage backup
    const saved = JSON.parse(localStorage.getItem('surveyResults') || '[]');
    saved.push(results);
    localStorage.setItem('surveyResults', JSON.stringify(saved));
}

async function autoSubmitAndShowLeaderboard(prefix) {
    // Submit (without demographics first)
    const results = buildSubmitPayload(prefix);
    try {
        await fetch(`${API_URL}/api/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(results)
        });
    } catch (e) {
        console.log('Auto-submit failed (offline)');
    }

    // Display leaderboard
    const leaderboardId = prefix === 'gameover' ? 'gameover-leaderboard' : 'leaderboard';
    const percentileId = prefix === 'gameover' ? 'gameover-percentile-display' : 'percentile-display';
    await displayLeaderboardIn(leaderboardId, percentileId);
}

// ============================================================================
// Sharing
// ============================================================================

function getShareData() {
    const accuracy = state.answers.length > 0
        ? ((state.correctCount / state.answers.length) * 100).toFixed(0) : 0;
    const clearedStages = state.stageResults.filter(r => r.cleared).length;
    const isAllClear = clearedStages >= CONFIG.stages.length;
    const url = 'https://unohee.github.io/ai-music-survey/';

    // Top percentile — use last displayed leaderboard rank
    const percentile = state.lastPercentile || 50;

    const stageText = isAllClear ? 'ALL CLEAR 🎉' : `Stage ${clearedStages}/${CONFIG.stages.length}`;
    const emoji = isAllClear ? '👑' : clearedStages >= 4 ? '🔥' : clearedStages >= 2 ? '🎯' : '🎵';

    const text = `${emoji} ${t('share_challenge')}\n` +
        t('share_stats', { score: state.score, accuracy: accuracy, stage: stageText }) + '\n' +
        t('share_percentile', { pct: percentile });

    return { text, url, score: state.score, accuracy, stageText, percentile, emoji };
}

function shareResults() {
    const data = getShareData();
    const preview = document.getElementById('share-preview');
    preview.innerHTML = `
        <div class="share-card">
            <div class="share-card-emoji">${data.emoji}</div>
            <div class="share-card-title">AI vs Real Music</div>
            <div class="share-card-score">${t('share_stats', { score: data.score, accuracy: data.accuracy, stage: '' }).split('|')[0].trim()}</div>
            <div class="share-card-detail">${data.accuracy}% ${t('label_accuracy')} | ${data.stageText}</div>
            <div class="share-card-percentile">${t('percentile_top', { pct: data.percentile })}</div>
        </div>
    `;
    document.getElementById('share-modal').classList.remove('hidden');
}

function closeShareModal() {
    document.getElementById('share-modal').classList.add('hidden');
}

function shareToX() {
    const data = getShareData();
    const text = encodeURIComponent(`${data.text}\n\n${data.url}`);
    window.open(`https://x.com/intent/post?text=${text}`, '_blank');
}

function shareToThreads() {
    const data = getShareData();
    const text = encodeURIComponent(`${data.text}\n\n${data.url}`);
    window.open(`https://www.threads.net/intent/post?text=${text}`, '_blank');
}

function shareToFacebook() {
    const data = getShareData();
    const url = encodeURIComponent(data.url);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
}

function shareToInstagram() {
    // Instagram has no direct share API — copy text and guide to Story
    const data = getShareData();
    const text = `${data.text}\n\n${data.url}`;
    navigator.clipboard.writeText(text).then(() => {
        alert(t('alert_instagram_copy'));
    });
}

function copyShareText() {
    const data = getShareData();
    const text = `${data.text}\n\n${data.url}`;
    navigator.clipboard.writeText(text).then(() => {
        alert(t('alert_copied'));
    });
}

function copyLink() {
    navigator.clipboard.writeText(window.location.href)
        .then(() => alert(t('alert_link_copied')));
}

function restartGame() {
    state = {
        mode: 'welcome',
        nickname: state.nickname,
        email: state.email,
        isReturningUser: state.isReturningUser,
        evalIndex: 0, evalTracks: [], evalAnswers: [],
        currentStageIndex: 0, stageQuestionIndex: 0,
        lives: CONFIG.maxLives,
        score: 0, correctCount: 0, wrongCount: 0,
        streak: 0, maxStreak: 0,
        answers: [], stageResults: [], stageTracks: [],
        currentTrack: null, isPlaying: false, startTime: null,
        aiCorrect: 0, aiTotal: 0, realCorrect: 0, realTotal: 0, lastPercentile: 50,
    };

    if (!state.isReturningUser) {
        document.getElementById('user-nickname').value = '';
    }
    document.getElementById('user-email').value = '';
    showScreen('welcome');
    displayWelcomeLeaderboard();
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// Leaderboard
// ============================================================================

// Seed leaderboard: based on actual participant scores (80%) + placeholder (20%)
const SEED_LEADERBOARD = [
    // placeholder (20%)
    { nickname: "GoldenEar", score: 1050, accuracy: 87, correctCount: 26, maxStreak: 10, maxStage: 5, livesRemaining: 0, is_game_over: 1, timestamp: "2026-02-10T09:30:00Z" },
    { nickname: "ProducerK", score: 820, accuracy: 80, correctCount: 24, maxStreak: 8, maxStage: 4, livesRemaining: 0, is_game_over: 1, timestamp: "2026-02-09T14:20:00Z" },
    // actual participant scores (80%)
    { nickname: "BeatMaker", score: 680, accuracy: 77, correctCount: 23, maxStreak: 7, maxStage: 4, livesRemaining: 0, is_game_over: 1, timestamp: "2026-02-09T10:00:00Z" },
    { nickname: "SoundHunter", score: 540, accuracy: 73, correctCount: 22, maxStreak: 6, maxStage: 3, livesRemaining: 0, is_game_over: 1, timestamp: "2026-02-10T13:30:00Z" },
    { nickname: "DJ_Seoul", score: 450, accuracy: 70, correctCount: 21, maxStreak: 5, maxStage: 3, livesRemaining: 0, is_game_over: 1, timestamp: "2026-02-08T18:00:00Z" },
    { nickname: "MusicLover", score: 380, accuracy: 67, correctCount: 20, maxStreak: 4, maxStage: 2, livesRemaining: 0, is_game_over: 1, timestamp: "2026-02-10T20:15:00Z" },
    { nickname: "Melody", score: 320, accuracy: 63, correctCount: 19, maxStreak: 4, maxStage: 2, livesRemaining: 0, is_game_over: 1, timestamp: "2026-02-10T16:45:00Z" },
    { nickname: "EarTrainer", score: 260, accuracy: 60, correctCount: 18, maxStreak: 3, maxStage: 2, livesRemaining: 0, is_game_over: 1, timestamp: "2026-02-09T09:45:00Z" },
    { nickname: "ToneTester", score: 180, accuracy: 57, correctCount: 17, maxStreak: 3, maxStage: 1, livesRemaining: 0, is_game_over: 1, timestamp: "2026-02-10T12:00:00Z" },
    { nickname: "RandomListener", score: 120, accuracy: 53, correctCount: 16, maxStreak: 2, maxStage: 1, livesRemaining: 0, is_game_over: 1, timestamp: "2026-02-08T15:30:00Z" },
    { nickname: "Newbie", score: 60, accuracy: 47, correctCount: 14, maxStreak: 2, maxStage: 1, livesRemaining: 0, is_game_over: 1, timestamp: "2026-02-10T17:00:00Z" },
];

async function getLeaderboard() {
    try {
        const response = await fetch(`${API_URL}/api/leaderboard`);
        if (response.ok) {
            const apiData = await response.json();
            const converted = apiData.map(entry => ({
                nickname: entry.nickname,
                score: entry.score,
                accuracy: entry.accuracy,
                correctCount: entry.correct_count,
                maxStreak: entry.max_streak,
                maxStage: entry.max_stage || 0,
                livesRemaining: entry.lives_remaining || 0,
                is_game_over: entry.is_game_over || 0,
                timestamp: entry.timestamp
            }));

            const merged = [...converted, ...SEED_LEADERBOARD];
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
        console.error('Leaderboard fetch failed:', e);
    }

    let leaderboard = JSON.parse(localStorage.getItem('leaderboard') || 'null');
    if (!leaderboard) {
        leaderboard = [...SEED_LEADERBOARD];
        localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
    }
    return leaderboard;
}

async function displayWelcomeLeaderboard() {
    const container = document.getElementById('welcome-leaderboard-body');
    if (!container) return;

    const leaderboard = await getLeaderboard();
    if (leaderboard.length === 0) {
        container.innerHTML = `<p class="no-data">${t('no_records')}</p>`;
        return;
    }

    const top10 = leaderboard.slice(0, 10);
    let html = `<table class="leaderboard-table leaderboard-mini"><thead><tr><th>#</th><th>${t('col_nickname')}</th><th>${t('col_score')}</th></tr></thead><tbody>`;

    top10.forEach((entry, index) => {
        const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : (index + 1);
        html += `
            <tr>
                <td>${rankIcon}</td>
                <td>${escapeHtml(entry.nickname)}</td>
                <td>${entry.score}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

async function displayLeaderboardIn(leaderboardElId, percentileElId) {
    const leaderboardEl = document.getElementById(leaderboardElId);
    const percentileEl = document.getElementById(percentileElId);

    if (!leaderboardEl) return;
    leaderboardEl.innerHTML = `<p class="loading">${t('loading_leaderboard')}</p>`;

    const leaderboard = await getLeaderboard();

    if (leaderboard.length === 0) {
        leaderboardEl.innerHTML = `<p class="no-data">${t('no_records')}</p>`;
        return;
    }

    // Current user rank
    const userRank = leaderboard.findIndex(e =>
        e.nickname === state.nickname && e.score === state.score
    ) + 1;

    if (percentileEl && userRank > 0) {
        const percentile = Math.max(1, ((leaderboard.length - userRank) / leaderboard.length * 100).toFixed(0));
        state.lastPercentile = parseInt(percentile);
        percentileEl.innerHTML = `
            <div class="percentile-badge">
                <span class="percentile-rank">${t('percentile_rank_text', { rank: userRank })}</span>
                <span class="percentile-text">${t('percentile_top', { pct: percentile > 0 ? percentile : 1 })}</span>
            </div>
        `;
    }

    const top10 = leaderboard.slice(0, 10);
    let html = `<table class="leaderboard-table"><thead><tr><th>#</th><th>${t('col_nickname')}</th><th>${t('col_score')}</th></tr></thead><tbody>`;

    top10.forEach((entry, index) => {
        const isCurrentUser = entry.nickname === state.nickname && entry.score === state.score;
        const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : (index + 1);

        html += `
            <tr class="${isCurrentUser ? 'current-user' : ''}">
                <td>${rankIcon}</td>
                <td>${escapeHtml(entry.nickname)}</td>
                <td>${entry.score}</td>
            </tr>
        `;
    });

    if (userRank > 10) {
        const userEntry = leaderboard[userRank - 1];
        html += `
            <tr class="separator"><td colspan="3">...</td></tr>
            <tr class="current-user">
                <td>${userRank}</td>
                <td>${escapeHtml(userEntry.nickname)}</td>
                <td>${userEntry.score}</td>
            </tr>
        `;
    }

    html += '</tbody></table>';
    leaderboardEl.innerHTML = html;
}
