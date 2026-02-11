/**
 * AI vs Real Music Survey — Gamification Edition
 * Created: 2026-02-11
 * Purpose: 스테이지 기반 게이미피케이션 + AI 음악 탐지 연구 데이터 수집
 */

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
    evaluationQuestions: 5,  // 워밍업 (연구 데이터, 라이프 무소모)
    stages: [
        { id: 1, name: 'Normal',          questions: 5, variant: 'original', pointBase: 10, clearBonus: 50,
          desc: '원본 음질의 12초 클립을 듣고 판별하세요.' },
        { id: 2, name: 'Time Pressure',   questions: 5, variant: '8s',      pointBase: 15, clearBonus: 75,
          desc: '8초 클립만으로 빠르게 판단하세요!' },
        { id: 3, name: 'Codec Challenge',  questions: 5, variant: '128k',    pointBase: 20, clearBonus: 100,
          desc: '128kbps 코덱 압축 — 미세한 차이를 잡아내세요.' },
        { id: 4, name: 'Lo-Fi Challenge',  questions: 5, variant: '64k',     pointBase: 25, clearBonus: 125,
          desc: '64kbps 저음질 — 극한 조건에서 판별!' },
        { id: 5, name: 'Speed Round',      questions: 5, variant: '4s',      pointBase: 30, clearBonus: 150,
          desc: '4초! 직감으로 승부하세요.' },
        { id: 6, name: 'Adversarial',      questions: 5, variant: 'original', pointBase: 40, clearBonus: 200,
          desc: 'AI 모델도 헷갈려한 트랙들 — 보스 스테이지!', adversarial: true },
    ],
    maxLives: 3,
    streakBonus: 5,
    maxStreakBonus: 50,
    lifeBonus: 100,  // 클리어 시 남은 라이프당 보너스
    audioBasePath: 'audio/',
};

// 디버그 모드: ?debug=true 로 접속 시 라이프 무한
const DEBUG_MODE = new URLSearchParams(window.location.search).get('debug') === 'true';

const LABELS = { AI: 0, REAL: 1 };
const answerToLabel = (ans) => ans === 'ai' ? LABELS.AI : LABELS.REAL;
const labelToText = (lbl) => lbl === LABELS.AI ? 'AI 생성' : '사람 연주';

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

    // Evaluation (워밍업)
    evalIndex: 0,
    evalTracks: [],
    evalAnswers: [],

    // Game
    currentStageIndex: 0,  // 0~5 (CONFIG.stages 인덱스)
    stageQuestionIndex: 0, // 스테이지 내 문제 인덱스 (0~4)
    lives: CONFIG.maxLives,
    score: 0,
    correctCount: 0,
    wrongCount: 0,
    streak: 0,
    maxStreak: 0,
    answers: [],
    stageResults: [],      // [{stageId, name, cleared, correct, total, score}]
    stageTracks: [],       // 현재 스테이지 트랙 목록

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
    audio = document.getElementById('audio-player');
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', onAudioEnded);
    audio.addEventListener('loadedmetadata', onAudioLoaded);

    await loadAudioPool();
    await checkExistingUser();
    await displayWelcomeLeaderboard();

    if (DEBUG_MODE) {
        console.log('🔧 DEBUG MODE ON — 라이프 무한');
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
                document.getElementById('nickname-status').textContent = '이전에 등록한 닉네임입니다.';
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
        return { success: false, message: err.detail || '등록 실패' };
    } catch (e) {
        // 오프라인이면 그냥 진행
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
    // 스크롤 맨 위로
    window.scrollTo(0, 0);
}

// ============================================================================
// Game Flow
// ============================================================================

async function startGame() {
    const nickname = document.getElementById('user-nickname').value.trim();
    const email = document.getElementById('user-email').value.trim();

    if (!nickname) {
        alert('닉네임을 입력해주세요!');
        document.getElementById('user-nickname').focus();
        return;
    }

    // 신규 사용자면 등록
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

    // 워밍업 트랙 선택 (5개: AI 3 + Real 2 or AI 2 + Real 3)
    const aiTracks = shuffleArray(audioPool.filter(t => t.label === LABELS.AI));
    const realTracks = shuffleArray(audioPool.filter(t => t.label === LABELS.REAL));
    state.evalTracks = shuffleArray([...aiTracks.slice(0, 3), ...realTracks.slice(0, 2)]);
    state.evalIndex = 0;
    state.evalAnswers = [];

    showScreen('evaluation');
    loadEvalQuestion();
}

// ============================================================================
// Evaluation (워밍업 5문제)
// ============================================================================

function loadEvalQuestion() {
    const track = state.evalTracks[state.evalIndex];
    state.currentTrack = track;

    document.getElementById('eval-current').textContent = state.evalIndex + 1;
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

    // 피드백 표시
    const feedbackEl = document.getElementById('feedback-eval');
    const labelText = labelToText(track.label);

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

    // 정답 버튼 표시
    const correctBtnClass = track.label === LABELS.AI
        ? '#screen-evaluation .btn-choice:first-child'
        : '#screen-evaluation .btn-choice:last-child';
    document.querySelector(correctBtnClass).classList.add('correct');

    document.getElementById('btn-next-eval').classList.remove('hidden');
}

function nextEvalQuestion() {
    state.evalIndex++;
    if (state.evalIndex >= CONFIG.evaluationQuestions) {
        // 워밍업 완료 → Stage 1 인트로
        startStageSystem();
    } else {
        loadEvalQuestion();
    }
}

// ============================================================================
// Stage System
// ============================================================================

function startStageSystem() {
    // 게임 상태 초기화
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
    document.getElementById('stage-intro-desc').textContent = stage.desc;
    document.getElementById('stage-intro-condition').innerHTML =
        `<span>📋 ${stage.questions}문제</span><span>⭐ 기본 ${stage.pointBase}점</span>` +
        (stage.clearBonus ? `<span>🏆 클리어 보너스 ${stage.clearBonus}점</span>` : '');

    // 라이프 표시
    updateLivesDisplay('stage-intro-lives');

    showScreen('stage-intro');
}

function startStage() {
    const stage = CONFIG.stages[state.currentStageIndex];
    state.stageQuestionIndex = 0;

    // 스테이지용 트랙 선택
    state.stageTracks = selectTracksForStage(stage);

    showScreen('game');
    updateGameUI();
    loadGameQuestion();
}

function selectTracksForStage(stage) {
    // 이미 사용된 트랙 ID 수집
    const usedIds = new Set([
        ...state.evalAnswers.map(a => a.trackId),
        ...state.answers.map(a => a.trackId)
    ]);

    let candidates;

    if (stage.adversarial) {
        // Boss: adversarial_score 높은 순으로 사용 가능한 트랙
        candidates = audioPool
            .filter(t => t.adversarial_score != null && t.adversarial_score > 0 && !usedIds.has(t.id))
            .sort((a, b) => b.adversarial_score - a.adversarial_score);

        if (candidates.length < stage.questions) {
            // 부족하면 일반 트랙으로 채움
            const extra = audioPool.filter(t => !usedIds.has(t.id) && !candidates.find(c => c.id === t.id));
            candidates = [...candidates, ...shuffleArray(extra)];
        }
    } else {
        candidates = audioPool.filter(t => !usedIds.has(t.id));
    }

    // AI/Real 균형 (절반씩)
    const aiCount = Math.ceil(stage.questions / 2);
    const realCount = stage.questions - aiCount;

    const aiCandidates = shuffleArray(candidates.filter(t => t.label === LABELS.AI));
    const realCandidates = shuffleArray(candidates.filter(t => t.label === LABELS.REAL));

    const selected = [
        ...aiCandidates.slice(0, aiCount),
        ...realCandidates.slice(0, realCount)
    ];

    // 부족하면 가능한 만큼 채움
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

    // activeFile 저장 (디버그 용도)
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

        // 라이프 감소 애니메이션
        if (!DEBUG_MODE) animateLifeLost();
    }

    // AI/Real 정확도 추적
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

    // 피드백 표시
    showGameFeedback(isCorrect, track.label, stage);
    updateGameUI();

    // 정답/오답 버튼 표시
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
        feedbackEl.className = 'feedback correct';
        feedbackEl.innerHTML = `✓ 정답! +${points}점 ${state.streak > 1 ? `(${state.streak}연속!)` : ''}`;
    } else {
        feedbackEl.className = 'feedback wrong';
        feedbackEl.innerHTML = `✗ 정답은 <strong>${labelText}</strong>입니다. ❤️ -1`;
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

    // Progress (스테이지 내)
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

    // Game mode: 라이프 체크
    if (state.lives <= 0 && !DEBUG_MODE) {
        handleGameOver();
        return;
    }

    const stage = CONFIG.stages[state.currentStageIndex];
    state.stageQuestionIndex++;

    if (state.stageQuestionIndex >= stage.questions) {
        // 스테이지 클리어!
        completeStage(stage);
    } else {
        loadGameQuestion();
    }
}

function completeStage(stage) {
    // 스테이지 결과 기록
    const stageCorrect = state.answers
        .filter(a => a.stageId === stage.id && a.correct).length;

    // 클리어 보너스
    state.score += stage.clearBonus;

    // 스테이지 클리어 시 라이프 회복 (+1, 최대치 제한)
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

    // 다음 스테이지 확인
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

    // 현재 스테이지 결과 기록 (미완료)
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

    // 나머지 스테이지는 locked
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

    // Game Over 화면 표시
    document.getElementById('gameover-stage').textContent = `Stage ${stage.id}: ${stage.name}에서 탈락!`;
    document.getElementById('gameover-score').textContent = state.score;

    renderStageSummary('gameover-stage-summary');

    showScreen('game-over');

    // 자동 제출 + 리더보드
    autoSubmitAndShowLeaderboard('gameover');
}

async function handleAllClear() {
    // 남은 라이프 보너스
    const lifeBonus = state.lives * CONFIG.lifeBonus;
    state.score += lifeBonus;
    if (lifeBonus > 0) showScorePopup(`+${lifeBonus} LIFE BONUS!`);

    // 결과 화면
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

    let html = '<h3>스테이지별 결과</h3>';
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

    // localStorage 백업
    const saved = JSON.parse(localStorage.getItem('surveyResults') || '[]');
    saved.push(results);
    localStorage.setItem('surveyResults', JSON.stringify(saved));
}

async function autoSubmitAndShowLeaderboard(prefix) {
    // 제출 (인구통계 없이 먼저)
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

    // 리더보드 표시
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

    // 상위 퍼센트 — 마지막으로 표시된 리더보드 순위 사용
    const percentile = state.lastPercentile || 50;

    const stageText = isAllClear ? 'ALL CLEAR 🎉' : `Stage ${clearedStages}/${CONFIG.stages.length}`;
    const emoji = isAllClear ? '👑' : clearedStages >= 4 ? '🔥' : clearedStages >= 2 ? '🎯' : '🎵';

    const text = `${emoji} AI vs Real Music 챌린지\n` +
        `${state.score}점 | ${accuracy}% 정확도 | ${stageText}\n` +
        `나는 상위 ${percentile}%! 당신은 AI 음악을 구별할 수 있나요?`;

    return { text, url, score: state.score, accuracy, stageText, percentile, emoji };
}

function shareResults() {
    const data = getShareData();
    const preview = document.getElementById('share-preview');
    preview.innerHTML = `
        <div class="share-card">
            <div class="share-card-emoji">${data.emoji}</div>
            <div class="share-card-title">AI vs Real Music</div>
            <div class="share-card-score">${data.score}점</div>
            <div class="share-card-detail">${data.accuracy}% 정확도 | ${data.stageText}</div>
            <div class="share-card-percentile">상위 ${data.percentile}%</div>
        </div>
    `;
    document.getElementById('share-modal').classList.remove('hidden');
}

function closeShareModal() {
    document.getElementById('share-modal').classList.add('hidden');
}

function shareToX() {
    const data = getShareData();
    const text = encodeURIComponent(`${data.emoji} AI vs Real Music 챌린지\n${data.score}점 | ${data.accuracy}% | ${data.stageText}\n상위 ${data.percentile}%! 🎧\n\n${data.url}`);
    window.open(`https://x.com/intent/post?text=${text}`, '_blank');
}

function shareToThreads() {
    const data = getShareData();
    const text = encodeURIComponent(`${data.emoji} AI vs Real Music 챌린지\n${data.score}점 | ${data.accuracy}% | ${data.stageText}\n상위 ${data.percentile}%! 🎧\n\n${data.url}`);
    window.open(`https://www.threads.net/intent/post?text=${text}`, '_blank');
}

function shareToFacebook() {
    const data = getShareData();
    const url = encodeURIComponent(data.url);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
}

function shareToInstagram() {
    // Instagram은 직접 공유 API 없음 — 텍스트 복사 후 스토리로 안내
    const data = getShareData();
    const text = `${data.emoji} AI vs Real Music 챌린지\n${data.score}점 | ${data.accuracy}% | ${data.stageText}\n상위 ${data.percentile}%!\n\n${data.url}`;
    navigator.clipboard.writeText(text).then(() => {
        alert('텍스트가 복사되었습니다!\nInstagram 스토리에 붙여넣기 해주세요 📋');
    });
}

function copyShareText() {
    const data = getShareData();
    const text = `${data.emoji} AI vs Real Music 챌린지\n${data.score}점 | ${data.accuracy}% | ${data.stageText}\n상위 ${data.percentile}%! 🎧\n\n${data.url}`;
    navigator.clipboard.writeText(text).then(() => {
        alert('클립보드에 복사되었습니다!');
    });
}

function copyLink() {
    navigator.clipboard.writeText(window.location.href)
        .then(() => alert('링크가 복사되었습니다!'));
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

// 시드 리더보드: 실제 참여자 성적(최고 ASI 915점/Stage3) 기반 80% + placeholder 20%
const SEED_LEADERBOARD = [
    // placeholder (20%) — 도달 가능한 목표치
    { nickname: "골든이어", score: 1050, accuracy: 87, correctCount: 26, maxStreak: 10, maxStage: 5, livesRemaining: 0, is_game_over: 1, timestamp: "2026-02-10T09:30:00Z" },
    { nickname: "프로듀서K", score: 820, accuracy: 80, correctCount: 24, maxStreak: 8, maxStage: 4, livesRemaining: 0, is_game_over: 1, timestamp: "2026-02-09T14:20:00Z" },
    // 실제 참여자 성적 기반 (80%)
    { nickname: "비트메이커", score: 680, accuracy: 77, correctCount: 23, maxStreak: 7, maxStage: 4, livesRemaining: 0, is_game_over: 1, timestamp: "2026-02-09T10:00:00Z" },
    { nickname: "사운드헌터", score: 540, accuracy: 73, correctCount: 22, maxStreak: 6, maxStage: 3, livesRemaining: 0, is_game_over: 1, timestamp: "2026-02-10T13:30:00Z" },
    { nickname: "DJ_Seoul", score: 450, accuracy: 70, correctCount: 21, maxStreak: 5, maxStage: 3, livesRemaining: 0, is_game_over: 1, timestamp: "2026-02-08T18:00:00Z" },
    { nickname: "뮤직러버", score: 380, accuracy: 67, correctCount: 20, maxStreak: 4, maxStage: 2, livesRemaining: 0, is_game_over: 1, timestamp: "2026-02-10T20:15:00Z" },
    { nickname: "멜로디", score: 320, accuracy: 63, correctCount: 19, maxStreak: 4, maxStage: 2, livesRemaining: 0, is_game_over: 1, timestamp: "2026-02-10T16:45:00Z" },
    { nickname: "청음왕", score: 260, accuracy: 60, correctCount: 18, maxStreak: 3, maxStage: 2, livesRemaining: 0, is_game_over: 1, timestamp: "2026-02-09T09:45:00Z" },
    { nickname: "음감테스터", score: 180, accuracy: 57, correctCount: 17, maxStreak: 3, maxStage: 1, livesRemaining: 0, is_game_over: 1, timestamp: "2026-02-10T12:00:00Z" },
    { nickname: "랜덤리스너", score: 120, accuracy: 53, correctCount: 16, maxStreak: 2, maxStage: 1, livesRemaining: 0, is_game_over: 1, timestamp: "2026-02-08T15:30:00Z" },
    { nickname: "초보청취자", score: 60, accuracy: 47, correctCount: 14, maxStreak: 2, maxStage: 1, livesRemaining: 0, is_game_over: 1, timestamp: "2026-02-10T17:00:00Z" },
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
        container.innerHTML = '<p class="no-data">아직 기록이 없습니다.</p>';
        return;
    }

    const top5 = leaderboard.slice(0, 5);
    let html = '<table class="leaderboard-table leaderboard-mini"><thead><tr><th>#</th><th>닉네임</th><th>점수</th></tr></thead><tbody>';

    top5.forEach((entry, index) => {
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
    leaderboardEl.innerHTML = '<p class="loading">리더보드 불러오는 중...</p>';

    const leaderboard = await getLeaderboard();

    if (leaderboard.length === 0) {
        leaderboardEl.innerHTML = '<p class="no-data">아직 기록이 없습니다.</p>';
        return;
    }

    // 현재 사용자 순위
    const userRank = leaderboard.findIndex(e =>
        e.nickname === state.nickname && e.score === state.score
    ) + 1;

    if (percentileEl && userRank > 0) {
        const percentile = Math.max(1, ((leaderboard.length - userRank) / leaderboard.length * 100).toFixed(0));
        state.lastPercentile = parseInt(percentile);
        percentileEl.innerHTML = `
            <div class="percentile-badge">
                <span class="percentile-rank">${userRank}위</span>
                <span class="percentile-text">상위 ${percentile > 0 ? percentile : 1}%</span>
            </div>
        `;
    }

    const top10 = leaderboard.slice(0, 10);
    let html = '<table class="leaderboard-table"><thead><tr><th>#</th><th>닉네임</th><th>점수</th></tr></thead><tbody>';

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
