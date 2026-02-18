/**
 * AI Music Survey — i18n Module
 * Created: 2026-02-18
 * Purpose: English-first UI with Korean toggle support
 */

// ============================================================================
// Translation Dictionary
// ============================================================================

const I18N = {
  en: {
    // Page
    page_title: 'AI vs Real Music — Test Your Ears!',

    // Welcome
    welcome_subtitle: 'Can you tell AI-generated music from real performances?',
    top_players: '🏆 Top Players',
    loading_leaderboard: 'Loading leaderboard...',
    welcome_info_1: '🎧 Listen to clips and guess: <strong>AI-generated</strong> or <strong>human performance</strong>?',
    welcome_info_2: '❤️ <strong>3 lives</strong> — wrong answers cost a life!',
    welcome_info_3: '🎮 Clear <strong>6 stages</strong> to win!',
    tip_headphone: '💡 <strong>Tip:</strong> Headphones recommended',
    ph_nickname: 'Nickname *',
    ph_email: 'Email (optional)',
    btn_start: 'Start',
    returning_user: 'Previously registered nickname.',

    // Evaluation
    warmup: 'Warm-up',
    warmup_count: 'Warm-up {current}/5',
    eval_info: 'No lives lost — feel free to practice!',
    btn_ai: '🤖 AI Generated',
    btn_real: '🎸 Human Performance',
    btn_next: 'Next →',
    replay_title: 'Replay from start',

    // Stage Intro
    btn_start_stage: 'Start',
    stage_questions: '📋 {n} questions',
    stage_points: '⭐ Base {n} pts',
    stage_clear_bonus: '🏆 Clear bonus {n} pts',

    // Stage descriptions
    stage_1_desc: 'Listen to 12-second clips at original quality and judge.',
    stage_2_desc: 'Make quick decisions with only 8-second clips!',
    stage_3_desc: '128kbps codec compression — catch the subtle differences.',
    stage_4_desc: '64kbps low quality — judge under extreme conditions!',
    stage_5_desc: '4 seconds! Trust your instincts.',
    stage_6_desc: 'Tracks that even AI models struggle with — Boss stage!',

    // Game
    score_label: 'Score',

    // Feedback
    feedback_correct: '✓ Correct! This is <strong>{label}</strong>.',
    feedback_wrong: '✗ Wrong. The answer is <strong>{label}</strong>.',
    feedback_correct_points: '✓ Correct! +{points} pts {streak}',
    feedback_wrong_life: '✗ The answer is <strong>{label}</strong>. ❤️ -1',
    streak_text: '({n} in a row!)',

    // Labels
    label_ai: 'AI Generated',
    label_real: 'Human Performance',

    // Game Over
    gameover_stage: 'Eliminated at Stage {id}: {name}!',
    final_score_label: 'Final Score',

    // Stage Summary
    stage_summary_title: 'Stage Results',

    // Demographics
    demo_title: 'Quick Info (optional)',
    demo_music_exp: 'Music Experience',
    demo_ai_exp: 'AI Music Experience',
    demo_criteria: 'Decision Criteria',
    demo_criteria_full: 'Decision Criteria (What helped you distinguish AI/Real?)',
    ph_criteria: 'e.g., Sound quality, rhythm, emotional expression...',
    opt_select: 'Select',
    opt_music_none: 'No music experience',
    opt_music_listener: 'Casual music listener',
    opt_music_amateur: 'Amateur musician',
    opt_music_professional: 'Professional musician/producer',
    opt_ai_never: 'Never heard AI music',
    opt_ai_few: 'Heard a few times',
    opt_ai_often: 'Listen frequently',
    opt_ai_creator: 'Created AI music myself',

    // Leaderboard
    leaderboard_title: '🏆 Leaderboard',
    col_nickname: 'Nickname',
    col_score: 'Score',
    no_records: 'No records yet.',
    percentile_rank_text: '#{rank}',
    percentile_top: 'Top {pct}%',

    // Results
    label_accuracy: 'Accuracy',
    label_correct: 'Correct',
    label_max_streak: 'Best Streak',
    label_lives_remaining: 'Lives Left',
    detail_results: 'Detailed Results',
    ai_detection: 'AI Music Detection',
    real_recognition: 'Real Music Recognition',

    // Ranks
    rank_expert: '🏆 AI Detection Expert',
    rank_expert_msg: 'Your ears can perfectly distinguish AI!',
    rank_gold: '🥇 Golden Ear',
    rank_gold_msg: 'You have outstanding listening ability!',
    rank_silver: '🥈 Silver Ear',
    rank_silver_msg: 'Above average detection skills.',
    rank_bronze: '🥉 Bronze Ear',
    rank_bronze_msg: 'A little more practice and you\'ll be great!',
    rank_normal: '👂 Average Listener',
    rank_normal_msg: 'You find it hard to tell AI and human apart.',
    rank_random: '🎲 Random Guesser',
    rank_random_msg: 'Worse than random... try guessing the opposite!',

    // Actions
    btn_submit: 'Submit Results',
    btn_share: 'Share Results',
    btn_retry: 'Try Again',

    // Thank You
    thankyou_title: 'Thank You!',
    thankyou_subtitle: 'Thank you for your participation.',
    thankyou_message: 'Your input greatly helps our research.',
    share_with_friends: 'Share with friends!',
    btn_copy_link: 'Copy Link',

    // Share Modal
    share_title: 'Share Results',
    btn_copy: 'Copy',
    btn_close: 'Close',

    // Share Text
    share_challenge: 'AI vs Real Music Challenge',
    share_stats: '{score} pts | {accuracy}% accuracy | {stage}',
    share_percentile: "I'm in the top {pct}%! Can you distinguish AI music?",

    // Alerts
    alert_nickname_required: 'Please enter a nickname!',
    alert_copied: 'Copied to clipboard!',
    alert_link_copied: 'Link copied!',
    alert_instagram_copy: 'Text copied!\nPaste it into your Instagram Story 📋',

    // Server errors
    ERR_NICKNAME_LENGTH: 'Nickname must be 1-20 characters.',
    ERR_NICKNAME_TAKEN: 'This nickname is already taken.',
    ERR_REGISTER_FAILED: 'Registration failed. Please try again.',
    err_register_fallback: 'Registration failed',
  },

  ko: {
    // Page
    page_title: 'AI vs Real Music - 당신의 귀를 테스트하세요!',

    // Welcome
    welcome_subtitle: '당신은 AI가 만든 음악을 구분할 수 있나요?',
    top_players: '🏆 Top Players',
    loading_leaderboard: '리더보드 불러오는 중...',
    welcome_info_1: '🎧 음악 클립을 듣고 <strong>AI 생성</strong>인지 <strong>사람 연주</strong>인지 맞춰보세요!',
    welcome_info_2: '❤️ 라이프 <strong>3개</strong> — 틀리면 라이프를 잃습니다!',
    welcome_info_3: '🎮 <strong>6개 스테이지</strong>를 클리어하세요!',
    tip_headphone: '💡 <strong>Tip:</strong> 헤드폰 착용을 권장합니다',
    ph_nickname: '닉네임 *',
    ph_email: '이메일 (선택사항)',
    btn_start: '시작하기',
    returning_user: '이전에 등록한 닉네임입니다.',

    // Evaluation
    warmup: '워밍업',
    warmup_count: '워밍업 {current}/5',
    eval_info: '라이프 소모 없음 — 편하게 풀어보세요!',
    btn_ai: '🤖 AI 생성',
    btn_real: '🎸 사람 연주',
    btn_next: '다음 →',
    replay_title: '처음부터 다시 듣기',

    // Stage Intro
    btn_start_stage: '시작하기',
    stage_questions: '📋 {n}문제',
    stage_points: '⭐ 기본 {n}점',
    stage_clear_bonus: '🏆 클리어 보너스 {n}점',

    // Stage descriptions
    stage_1_desc: '원본 음질의 12초 클립을 듣고 판별하세요.',
    stage_2_desc: '8초 클립만으로 빠르게 판단하세요!',
    stage_3_desc: '128kbps 코덱 압축 — 미세한 차이를 잡아내세요.',
    stage_4_desc: '64kbps 저음질 — 극한 조건에서 판별!',
    stage_5_desc: '4초! 직감으로 승부하세요.',
    stage_6_desc: 'AI 모델도 헷갈려한 트랙들 — 보스 스테이지!',

    // Game
    score_label: '점수',

    // Feedback
    feedback_correct: '✓ 정답! 이 음악은 <strong>{label}</strong>입니다.',
    feedback_wrong: '✗ 틀렸습니다. 정답은 <strong>{label}</strong>입니다.',
    feedback_correct_points: '✓ 정답! +{points}점 {streak}',
    feedback_wrong_life: '✗ 정답은 <strong>{label}</strong>입니다. ❤️ -1',
    streak_text: '({n}연속!)',

    // Labels
    label_ai: 'AI 생성',
    label_real: '사람 연주',

    // Game Over
    gameover_stage: 'Stage {id}: {name}에서 탈락!',
    final_score_label: '최종 점수',

    // Stage Summary
    stage_summary_title: '스테이지별 결과',

    // Demographics
    demo_title: '간단한 정보 (선택사항)',
    demo_music_exp: '음악 경험',
    demo_ai_exp: 'AI 음악 경험',
    demo_criteria: '판단 기준',
    demo_criteria_full: '판단 기준 (어떤 점에서 AI/Real을 구분했나요?)',
    ph_criteria: '예: 음질, 리듬감, 감정 표현 등...',
    opt_select: '선택하세요',
    opt_music_none: '음악 경험 없음',
    opt_music_listener: '음악 감상 취미',
    opt_music_amateur: '아마추어 연주자',
    opt_music_professional: '전문 음악인/프로듀서',
    opt_ai_never: '들어본 적 없음',
    opt_ai_few: '몇 번 들어봄',
    opt_ai_often: '자주 들음',
    opt_ai_creator: '직접 생성해봄',

    // Leaderboard
    leaderboard_title: '🏆 리더보드',
    col_nickname: '닉네임',
    col_score: '점수',
    no_records: '아직 기록이 없습니다.',
    percentile_rank_text: '{rank}위',
    percentile_top: '상위 {pct}%',

    // Results
    label_accuracy: '정확도',
    label_correct: '정답',
    label_max_streak: '최대 연속',
    label_lives_remaining: '남은 라이프',
    detail_results: '세부 결과',
    ai_detection: 'AI 음악 탐지',
    real_recognition: 'Real 음악 인식',

    // Ranks
    rank_expert: '🏆 AI 탐지 전문가',
    rank_expert_msg: '당신의 귀는 AI를 완벽하게 구분합니다!',
    rank_gold: '🥇 골든 이어',
    rank_gold_msg: '뛰어난 청각 능력을 가지고 있습니다!',
    rank_silver: '🥈 실버 이어',
    rank_silver_msg: '평균 이상의 탐지 능력입니다.',
    rank_bronze: '🥉 브론즈 이어',
    rank_bronze_msg: '조금만 더 연습하면 됩니다!',
    rank_normal: '👂 일반인',
    rank_normal_msg: 'AI와 사람을 구분하기 어려우시군요.',
    rank_random: '🎲 운에 맡긴 자',
    rank_random_msg: '찍기보다 못한 결과... 반대로 찍으세요!',

    // Actions
    btn_submit: '결과 제출하기',
    btn_share: '결과 공유하기',
    btn_retry: '다시 도전하기',

    // Thank You
    thankyou_title: '감사합니다!',
    thankyou_subtitle: '소중한 참여 감사드립니다.',
    thankyou_message: '연구에 큰 도움이 됩니다.',
    share_with_friends: '친구에게도 공유해보세요!',
    btn_copy_link: '링크 복사',

    // Share Modal
    share_title: '결과 공유하기',
    btn_copy: '복사',
    btn_close: '닫기',

    // Share Text
    share_challenge: 'AI vs Real Music 챌린지',
    share_stats: '{score}점 | {accuracy}% 정확도 | {stage}',
    share_percentile: '나는 상위 {pct}%! 당신은 AI 음악을 구별할 수 있나요?',

    // Alerts
    alert_nickname_required: '닉네임을 입력해주세요!',
    alert_copied: '클립보드에 복사되었습니다!',
    alert_link_copied: '링크가 복사되었습니다!',
    alert_instagram_copy: '텍스트가 복사되었습니다!\nInstagram 스토리에 붙여넣기 해주세요 📋',

    // Server errors
    ERR_NICKNAME_LENGTH: '닉네임은 1-20자여야 합니다.',
    ERR_NICKNAME_TAKEN: '이미 사용 중인 닉네임입니다.',
    ERR_REGISTER_FAILED: '등록에 실패했습니다. 다시 시도해주세요.',
    err_register_fallback: '등록 실패',
  }
};

// ============================================================================
// i18n Engine
// ============================================================================

let currentLang = 'en';

/**
 * Translate a key with optional variable substitution (textContent-safe)
 */
function t(key, vars) {
    let str = I18N[currentLang]?.[key] || I18N['en'][key] || key;
    if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
            str = str.replace(`{${k}}`, v);
        });
    }
    return str;
}

/**
 * Translate a key for innerHTML use (same logic, separate for clarity)
 */
function tHtml(key, vars) {
    return t(key, vars);
}

/**
 * Detect language from URL param > localStorage > navigator > default 'en'
 */
function detectLanguage() {
    const urlParam = new URLSearchParams(window.location.search).get('lang');
    if (urlParam && I18N[urlParam]) return urlParam;

    const saved = localStorage.getItem('survey-lang');
    if (saved && I18N[saved]) return saved;

    const nav = navigator.language?.slice(0, 2);
    if (nav === 'ko') return 'ko';

    return 'en';
}

/**
 * Set language and apply all translations
 */
function setLanguage(lang) {
    if (!I18N[lang]) lang = 'en';
    currentLang = lang;
    localStorage.setItem('survey-lang', lang);
    document.documentElement.lang = lang;
    applyTranslations();
}

/**
 * Toggle between EN and KO
 */
function toggleLanguage() {
    setLanguage(currentLang === 'ko' ? 'en' : 'ko');
}

/**
 * Apply translations to all data-i18n elements in the DOM
 */
function applyTranslations() {
    // data-i18n → textContent
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
    });

    // data-i18n-html → innerHTML
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        el.innerHTML = tHtml(el.dataset.i18nHtml);
    });

    // data-i18n-placeholder → placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.dataset.i18nPlaceholder);
    });

    // data-i18n-title → title attribute
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.title = t(el.dataset.i18nTitle);
    });

    // Page title
    document.title = t('page_title');

    // Language toggle button label
    const btn = document.getElementById('lang-toggle');
    if (btn) btn.textContent = currentLang === 'ko' ? 'EN' : '한국어';
}
