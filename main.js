import './style.css';

let allQuestions = [];
let currentTestSet = [];
let userAnswers = {}; // { questionIndex: selectedOptionText }
let currentRangeKey = '';
let currentSubject = 'xalqaro';
const SET_SIZE = 25;

let selectedTimer = 0;
let isQuizMode = false;
let currentQuestionTimer = null;
let remainingTime = 0;
let currentQuestionIndex = 0;

const subjectScreen = document.getElementById('subject-screen');
const setupTitle = document.getElementById('setup-title');
const subjectXalqaroBtn = document.getElementById('subject-xalqaro-btn');
const subjectIslomiyBtn = document.getElementById('subject-islomiy-btn');
const subjectKirishBtn = document.getElementById('subject-kirish-btn');
const backToSubjectBtn = document.getElementById('back-to-subject-btn');

const setupScreen = document.getElementById('setup-screen');
const testScreen = document.getElementById('test-screen');
const resultScreen = document.getElementById('result-screen');
const rangeContainer = document.getElementById('range-container');
const loaderContainer = document.getElementById('loader-container');
const timerSelect = document.getElementById('timer-select');
const restartBtn = document.getElementById('restart-btn');
const rangeDisplay = document.getElementById('range-display');
const questionsList = document.getElementById('questions-list');
const questionNav = document.getElementById('question-nav');
const finishBtns = document.querySelectorAll('.finish-btn');
const finalScore = document.getElementById('final-score');
const totalQuestionsSpan = document.getElementById('total-questions');
const backHomeBtn = document.getElementById('back-home-btn');
const exitModal = document.getElementById('exit-modal');
const modalContinueBtn = document.getElementById('modal-continue-btn');
const modalExitBtn = document.getElementById('modal-exit-btn');
const timerModal = document.getElementById('timer-modal');
const modalTimerCancelBtn = document.getElementById('modal-timer-cancel-btn');
const modalTimerStartBtn = document.getElementById('modal-timer-start-btn');

let isTestActive = false;
let isReviewMode = false;
let pendingTestFunction = null;
let selectedTimerValue = "";

// Initialize
window.addEventListener('DOMContentLoaded', init);

// Custom select setup
function updateCustomSelects(value) {
    selectedTimerValue = value;
    let text = "Taymerni tanlang...";
    if (value === "0") text = "Vaqt tanlanmasin";
    if (value === "30") text = "30 sekund";
    if (value === "60") text = "1 daqiqa";
    if (value === "120") text = "2 daqiqa";

    const display1 = document.getElementById('timer-select-display');
    const display2 = document.getElementById('modal-timer-select-display');
    if (display1) display1.innerText = text;
    if (display2) display2.innerText = text;
}

function setupCustomSelect(wrapperId, displayId, optionsId) {
    const display = document.getElementById(displayId);
    const options = document.getElementById(optionsId);
    if (!display || !options) return;

    display.addEventListener('click', function(e) {
        e.stopPropagation();
        closeAllSelect(display);
        this.classList.toggle('select-arrow-active');
        options.classList.toggle('select-hide');
    });

    const optionDivs = options.querySelectorAll('div');
    optionDivs.forEach(div => {
        div.addEventListener('click', function(e) {
            e.stopPropagation();
            const val = this.getAttribute('data-value');
            updateCustomSelects(val);
            localStorage.setItem('timerPreference', val);
            display.classList.remove('select-arrow-active');
            options.classList.add('select-hide');
        });
    });
}

function closeAllSelect(elmnt) {
    const displays = document.querySelectorAll('.select-selected');
    const options = document.querySelectorAll('.select-items');
    for (let i = 0; i < displays.length; i++) {
        if (elmnt !== displays[i]) {
            displays[i].classList.remove('select-arrow-active');
            options[i].classList.add('select-hide');
        }
    }
}
document.addEventListener('click', closeAllSelect);

setupCustomSelect('timer-select-wrapper', 'timer-select-display', 'timer-select-options');
setupCustomSelect('modal-timer-select-wrapper', 'modal-timer-select-display', 'modal-timer-select-options');

// Timer selection persistence
const savedTimer = localStorage.getItem('timerPreference');
if (savedTimer !== null) {
    updateCustomSelects(savedTimer);
}

if (modalTimerCancelBtn) {
    modalTimerCancelBtn.addEventListener('click', () => {
        timerModal.classList.add('hidden');
        pendingTestFunction = null;
    });
}

if (modalTimerStartBtn) {
    modalTimerStartBtn.addEventListener('click', () => {
        if (selectedTimerValue === "") {
            alert("Iltimos, taymerni tanlang!");
            return;
        }
        timerModal.classList.add('hidden');
        if (pendingTestFunction) {
            pendingTestFunction();
            pendingTestFunction = null;
        }
    });
}

restartBtn.addEventListener('click', goToHome);

finishBtns.forEach(btn => {
    btn.addEventListener('click', finishTest);
});

backHomeBtn.addEventListener('click', () => {
    if (isReviewMode) {
        goToHome();
    } else if (isTestActive) {
        exitModal.classList.remove('hidden');
    }
});

modalContinueBtn.addEventListener('click', () => {
    exitModal.classList.add('hidden');
});

modalExitBtn.addEventListener('click', () => {
    exitModal.classList.add('hidden');
    goToHome();
});

modalFinishBtn.addEventListener('click', () => {
    exitModal.classList.add('hidden');
    finishTest();
});

window.addEventListener('beforeunload', (e) => {
    if (isTestActive) {
        e.preventDefault();
        e.returnValue = '';
    }
});

function goToHome() {
    clearInterval(currentQuestionTimer);
    isTestActive = false;
    isReviewMode = false;
    testScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');
    subjectScreen.classList.add('hidden');
    setupScreen.classList.remove('hidden');
    exitModal.classList.add('hidden'); // Ensure modal is hidden
    renderRanges();
}

function init() {
    subjectXalqaroBtn.addEventListener('click', () => loadSubject('xalqaro'));
    subjectIslomiyBtn.addEventListener('click', () => loadSubject('islomiy'));
    subjectKirishBtn.addEventListener('click', () => loadSubject('kirish'));
    backToSubjectBtn.addEventListener('click', goToSubjects);
}

function goToSubjects() {
    setupScreen.classList.add('hidden');
    testScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');
    subjectScreen.classList.remove('hidden');
    allQuestions = [];
}

async function loadSubject(subject) {
    currentSubject = subject;
    subjectScreen.classList.add('hidden');
    setupScreen.classList.remove('hidden');
    loaderContainer.classList.remove('hidden');
    rangeContainer.innerHTML = '';
    rangeContainer.appendChild(loaderContainer);
    
    if (subject === 'xalqaro') {
        setupTitle.innerText = "Xalqaro moliyadan";
    } else if (subject === 'islomiy') {
        setupTitle.innerText = "Islomiy Bank ishidan";
    } else if (subject === 'kirish') {
        setupTitle.innerText = "Bank ishiga kirish";
    }

    try {
        let fileName = '/test.md';
        if (subject === 'islomiy') fileName = '/test2.md';
        else if (subject === 'kirish') fileName = '/test3.md';
        
        const response = await fetch(fileName);
        if (!response.ok) throw new Error('Fayl topilmadi');
        const text = await response.text();
        allQuestions = parseContent(text);

        loaderContainer.classList.add('hidden');
        renderRanges();
    } catch (err) {
        console.error(err);
        if (loaderContainer) {
            loaderContainer.innerHTML = `<p style="color: var(--error)">Xatolik: Testlarni yuklab bo'lmadi.</p>`;
        }
    }
}

function parseContent(text) {
    const blocks = text.split(/\s*\+{3,}\s*/).filter(b => b.trim().length > 0);
    return blocks.map(block => {
        const parts = block.split(/\s*={3,}\s*/).map(p => p.trim()).filter(p => p.length > 0);
        const question = parts[0];
        
        let hasHash = false;
        const options = parts.slice(1).map(opt => {
            const isCorrect = /^\s*#/.test(opt);
            if (isCorrect) hasHash = true;
            const cleanText = opt.replace(/^\s*#/, '').trim();
            return { text: cleanText, isCorrect: isCorrect };
        });

        if (!hasHash && options.length > 0) {
            options[0].isCorrect = true;
        }

        return { question, options };
    });
}

function renderRanges() {
    rangeContainer.innerHTML = '';
    const totalQuestions = allQuestions.length;
    const numRanges = Math.ceil(totalQuestions / SET_SIZE);

    for (let i = 0; i < numRanges; i++) {
        const start = i * SET_SIZE;
        const end = Math.min(start + SET_SIZE, totalQuestions);
        const rangeKey = `score_${currentSubject}_${start}_${end}`;
        const savedScore = localStorage.getItem(rangeKey);

        const btn = document.createElement('div');
        btn.className = 'range-btn';

        let scoreHtml = '';
        if (savedScore !== null) {
            try {
                const data = JSON.parse(savedScore);
                scoreHtml = `<div class="range-score review-link" data-key="${rangeKey}">Oxirgi natija: ${data.score} / ${data.total} <br><span>(Ko'rish)</span></div>`;
            } catch (e) {
                scoreHtml = `<div class="range-score review-link" data-key="${rangeKey}">Oxirgi natija: ${savedScore} / ${end - start} <br><span>(Ko'rish)</span></div>`;
            }
        }

        btn.innerHTML = `
            <div class="range-label">${start + 1} - ${end}</div>
            <div class="range-info">${end - start} ta savol</div>
            ${scoreHtml}
        `;

        btn.addEventListener('click', (e) => {
            if (e.target.closest('.review-link')) {
                e.stopPropagation();
                startReviewMode(rangeKey);
                return;
            }
            startTestRange(start, end, rangeKey);
        });
        rangeContainer.appendChild(btn);
    }

    // Add Full Shuffle Range
    const fullBtn = document.createElement('div');
    fullBtn.className = 'range-btn full-shuffle-btn';
    const fullRangeKey = `score_${currentSubject}_full_shuffle`;
    const savedFull = localStorage.getItem(fullRangeKey);

    let fullScoreHtml = '';
    if (savedFull !== null) {
        try {
            const data = JSON.parse(savedFull);
            fullScoreHtml = `<div class="range-score review-link" data-key="${fullRangeKey}">Oxirgi natija: ${data.score} / ${data.total} <br><span>(Ko'rish)</span></div>`;
        } catch (e) {
            fullScoreHtml = `<div class="range-score review-link" data-key="${fullRangeKey}">Oxirgi natija: ${savedFull} <br><span>(Ko'rish)</span></div>`;
        }
    }

    fullBtn.innerHTML = `
        <div class="range-label">Barcha savollar</div>
        <div class="range-info">25 ta tasodifiy savol</div>
        ${fullScoreHtml}
    `;
    fullBtn.addEventListener('click', (e) => {
        if (e.target.closest('.review-link')) {
            e.stopPropagation();
            startReviewMode(fullRangeKey);
            return;
        }
        startFullShuffleTest();
    });
    rangeContainer.appendChild(fullBtn);
}

function startFullShuffleTest() {
    if (selectedTimerValue === "") {
        pendingTestFunction = startFullShuffleTest;
        timerModal.classList.remove('hidden');
        return;
    }

    currentRangeKey = `score_${currentSubject}_full_shuffle`;
    // Shuffle all questions and pick first 25
    currentTestSet = shuffle([...allQuestions]).slice(0, SET_SIZE).map(q => ({
        ...q,
        shuffledOptions: shuffle([...q.options])
    }));

    userAnswers = {};
    isTestActive = true;
    isReviewMode = false;
    setupScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');
    testScreen.classList.remove('hidden');

    selectedTimer = selectedTimerValue ? parseInt(selectedTimerValue) : 0;
    isQuizMode = selectedTimer > 0;
    currentQuestionIndex = 0;

    rangeDisplay.innerText = `Tasodifiy 25 ta savol`;
    finishBtns.forEach(btn => btn.classList.remove('hidden'));
    backHomeBtn.classList.remove('hidden'); // Show back button
    renderQuestions();
    renderNavigator();
    if (isQuizMode) startQuestionTimer();
    window.scrollTo(0, 0);
}

function startReviewMode(rangeKey) {
    const savedData = localStorage.getItem(rangeKey);
    if (!savedData) return;

    let data;
    try {
        data = JSON.parse(savedData);
    } catch (e) {
        alert("Bu natija uchun batafsil ma'lumot yo'q.");
        return;
    }

    currentRangeKey = rangeKey;
    currentTestSet = data.questions;
    userAnswers = data.userAnswers;
    isTestActive = false;
    isReviewMode = true;

    setupScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');
    testScreen.classList.remove('hidden');

    rangeDisplay.innerText = `Natijalarni ko'rish`;
    isTestActive = false;
    isReviewMode = true;
    isQuizMode = false;

    // Hide all finish buttons and bottom footer one
    document.querySelectorAll('.finish-btn').forEach(btn => btn.classList.add('hidden'));
    backHomeBtn.classList.remove('hidden');

    renderQuestions(true); // true means review mode
    renderNavigator();

    // In review mode, we should show the correct/wrong indicators immediately
    setTimeout(() => {
        currentTestSet.forEach((q, qIdx) => {
            const qDiv = document.getElementById(`q-${qIdx}`);
            if (!qDiv) return;
            const optsDiv = qDiv.querySelector('.options-container');
            const selectedText = userAnswers[qIdx];

            Array.from(optsDiv.children).forEach(child => {
                const optText = child.dataset.text;
                const isCorrect = q.options.find(o => o.text === optText)?.isCorrect;

                if (isCorrect) {
                    child.classList.add('correct');
                }
                if (selectedText === optText && !isCorrect) {
                    child.classList.add('wrong');
                }
            });
        });
    }, 100);

    window.scrollTo(0, 0);
}

function startTestRange(start, end, rangeKey) {
    if (selectedTimerValue === "") {
        pendingTestFunction = () => startTestRange(start, end, rangeKey);
        timerModal.classList.remove('hidden');
        return;
    }

    currentRangeKey = rangeKey;
    currentTestSet = shuffle(allQuestions.slice(start, end).map(q => ({
        ...q,
        shuffledOptions: shuffle([...q.options])
    })));

    userAnswers = {};
    isTestActive = true;
    isReviewMode = false;
    setupScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');
    testScreen.classList.remove('hidden');

    selectedTimer = selectedTimerValue ? parseInt(selectedTimerValue) : 0;
    isQuizMode = selectedTimer > 0;
    currentQuestionIndex = 0;

    rangeDisplay.innerText = `${start + 1} dan ${end} gacha savollar`;
    finishBtns.forEach(btn => btn.classList.remove('hidden'));
    backHomeBtn.classList.remove('hidden'); // Show back button
    renderQuestions();
    renderNavigator();
    if (isQuizMode) startQuestionTimer();
    window.scrollTo(0, 0);
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function renderQuestions(isReview = false) {
    questionsList.innerHTML = '';
    currentTestSet.forEach((q, qIdx) => {
        const qDiv = document.createElement('div');
        qDiv.className = 'question-item';
        qDiv.id = `q-${qIdx}`;
        qDiv.style.position = 'relative';
        
        if (isQuizMode && !isReview && qIdx > 0) {
            qDiv.style.display = 'none';
        }

        const h3 = document.createElement('h3');
        h3.innerText = `${qIdx + 1}. ${q.question}`;
        if (isQuizMode && !isReview) {
            h3.style.paddingRight = '100px';
        }
        qDiv.appendChild(h3);

        if (isQuizMode && !isReview) {
            const timerBadge = document.createElement('div');
            timerBadge.id = `timer-${qIdx}`;
            timerBadge.className = 'question-timer hidden';
            timerBadge.style.position = 'absolute';
            timerBadge.style.top = '10px';
            timerBadge.style.right = '15px';
            timerBadge.style.display = 'flex';
            timerBadge.style.alignItems = 'center';
            timerBadge.style.gap = '8px';
            timerBadge.style.fontWeight = 'bold';
            timerBadge.style.fontSize = '18px';
            
            timerBadge.innerHTML = `
                <span id="timer-text-${qIdx}" style="transition: color 0.3s ease; font-variant-numeric: tabular-nums;">00:00</span>
                <svg width="24" height="24" viewBox="0 0 24 24" style="transform: rotate(-90deg);">
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.15)" stroke-width="2" fill="none" />
                    <circle id="timer-circle-${qIdx}" cx="12" cy="12" r="10" stroke="var(--text)" stroke-width="2" fill="none" stroke-linecap="round"
                            stroke-dasharray="62.83" stroke-dashoffset="0" style="transition: stroke-dashoffset 1s linear, stroke 0.3s ease;" />
                </svg>
            `;
            qDiv.appendChild(timerBadge);
        }

        const optsDiv = document.createElement('div');
        optsDiv.className = 'options-container';
        if (isReview) optsDiv.style.pointerEvents = 'none';

        q.shuffledOptions.forEach(opt => {
            const optCard = document.createElement('div');
            optCard.className = 'option-card';
            if (isReview && userAnswers[qIdx] === opt.text) {
                optCard.classList.add('selected');
            }
            optCard.dataset.text = opt.text;
            optCard.innerText = opt.text;
            optCard.addEventListener('click', () => {
                if (isReview) return;
                
                // Javob belgilangan bo'lsa qayta tanlashni to'xtatish
                if (qIdx in userAnswers) return;

                optCard.classList.add('selected');
                userAnswers[qIdx] = opt.text;
                updateNavigator(qIdx);

                // Darhol to'g'ri yoki xatoni ko'rsatish
                const originalOpt = q.options.find(o => o.text === opt.text);
                if (originalOpt.isCorrect) {
                    optCard.classList.add('correct');
                } else {
                    optCard.classList.add('wrong');
                    // Xato javob belgilanganida to'g'risini ham yashil qilib ko'rsatish
                    Array.from(optsDiv.children).forEach(child => {
                        const childOriginalOpt = q.options.find(o => o.text === child.dataset.text);
                        if (childOriginalOpt && childOriginalOpt.isCorrect) {
                            child.classList.add('correct');
                        }
                    });
                }
                
                if (isQuizMode) {
                    clearInterval(currentQuestionTimer);
                    optsDiv.style.pointerEvents = 'none';
                    setTimeout(() => {
                        showNextQuestion();
                    }, 1000);
                }
            });
            optsDiv.appendChild(optCard);
        });

        qDiv.appendChild(optsDiv);
        questionsList.appendChild(qDiv);
    });
}

function renderNavigator() {
    questionNav.innerHTML = '';
    currentTestSet.forEach((_, idx) => {
        const bubble = document.createElement('div');
        bubble.className = 'nav-bubble';
        bubble.innerText = idx + 1;
        bubble.id = `nav-${idx}`;
        bubble.addEventListener('click', () => {
            const qElement = document.getElementById(`q-${idx}`);
            if (qElement) {
                qElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
        questionNav.appendChild(bubble);
    });
}

function updateNavigator(qIdx) {
    const bubble = document.getElementById(`nav-${qIdx}`);
    if (bubble) {
        bubble.classList.add('answered');
    }
}

function finishTest() {
    isTestActive = false;
    let score = 0;

    currentTestSet.forEach((q, qIdx) => {
        const qDiv = document.getElementById(`q-${qIdx}`);
        const optsDiv = qDiv.querySelector('.options-container');
        const selectedText = userAnswers[qIdx];

        Array.from(optsDiv.children).forEach(child => {
            const optText = child.dataset.text;
            const originalOpt = q.options.find(o => o.text === optText);

            if (originalOpt.isCorrect) {
                child.classList.add('correct');
            }

            if (selectedText === optText) {
                if (originalOpt.isCorrect) {
                    score++;
                } else {
                    child.classList.add('wrong');
                }
            }
        });
    });

    const resultData = {
        score: score,
        total: currentTestSet.length,
        questions: currentTestSet,
        userAnswers: userAnswers
    };
    localStorage.setItem(currentRangeKey, JSON.stringify(resultData));

    testScreen.classList.add('hidden');
    resultScreen.classList.remove('hidden');
    window.scrollTo(0, 0);

    finalScore.innerText = score;
    totalQuestionsSpan.innerText = currentTestSet.length;

    let msg = "";
    if (currentSubject === 'xalqaro') {
        if (score < 10) {
            msg = `"${score}" tayam ishlidimi churka bor boshqatdan tayyorlanib kel`;
        } else if (score < 15) {
            msg = `Bleee yarmiini zo'rg'a ishlading`;
        } else if (score < 20) {
            msg = `Yaxshi Bratishka "${score}" ta ishlabsan`;
        } else if (score < 24) {
            msg = `Eee gap yo'g'e "${score}" ta ishlabsan`;
        } else if (score === 24) {
            msg = `Ha Chumo 24 ta ishlagansan 1 tayam xato qiladimi`;
        } else {
            msg = `25 ta ishlabman deb kibirlanma`;
        }
    } else {
        if (score < 10) {
            msg = `"${score}" tayam ishlidimi birodar, bu nima qilganingiz insofdanmi? Boshqatdan urinib ko'ring.`;
        } else if (score < 15) {
            msg = `Yarmini zo'rg'a ishlabsiz, kayfiyatingizni tushirmang, yana o'qing.`;
        } else if (score < 20) {
            msg = `Yaxshi birodar, "${score}" ta ishlabsiz, harakatingiz yomon emas.`;
        } else if (score < 24) {
            msg = `Barakalla, "${score}" ta ishlabsiz, ajoyib natija.`;
        } else if (score === 24) {
            msg = `Juda ajoyib, 24 ta ishlabsiz, bittagina xato qilibsiz-a!`;
        } else {
            msg = `Mukammal natija, 25 ta to'g'ri, lekin kibrlanmang, o'rganishda davom eting.`;
        }
    }

    document.getElementById('result-message').innerText = msg;
}

// Timer Helper Functions
function formatTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function startQuestionTimer() {
    clearInterval(currentQuestionTimer);
    remainingTime = selectedTimer;
    
    const qTimer = document.getElementById(`timer-${currentQuestionIndex}`);
    const timerText = document.getElementById(`timer-text-${currentQuestionIndex}`);
    const timerCircle = document.getElementById(`timer-circle-${currentQuestionIndex}`);
    
    function updateTimerUI(time) {
        if (!timerText || !timerCircle) return;
        timerText.innerText = formatTime(time);
        
        let color = 'var(--text)';
        if (time <= 5) color = 'var(--error)';
        else if (time <= 10) color = '#f59e0b';
        
        timerText.style.color = color;
        timerCircle.style.stroke = color;
        
        const circumference = 62.83;
        const dashoffset = circumference - (time / selectedTimer) * circumference;
        timerCircle.style.strokeDashoffset = dashoffset;
    }

    if (qTimer) {
        qTimer.classList.remove('hidden');
        if (timerCircle) {
            timerCircle.style.transition = 'none';
            timerCircle.style.strokeDashoffset = '0';
            void timerCircle.offsetWidth; // force reflow
            timerCircle.style.transition = 'stroke-dashoffset 1s linear, stroke 0.3s ease';
        }
        updateTimerUI(remainingTime);
    }
    
    currentQuestionTimer = setInterval(() => {
        remainingTime--;
        updateTimerUI(remainingTime);
        if (remainingTime <= 0) {
            clearInterval(currentQuestionTimer);
            handleTimeOut();
        }
    }, 1000);
}

function handleTimeOut() {
    const qIdx = currentQuestionIndex;
    if (!(qIdx in userAnswers)) {
        userAnswers[qIdx] = null; // Mark as unanswered
        updateNavigator(qIdx);
        
        const qDiv = document.getElementById(`q-${qIdx}`);
        if (qDiv) {
            const optsDiv = qDiv.querySelector('.options-container');
            if (optsDiv) {
                optsDiv.style.pointerEvents = 'none';
                Array.from(optsDiv.children).forEach(child => {
                    const childOriginalOpt = currentTestSet[qIdx].options.find(o => o.text === child.dataset.text);
                    if (childOriginalOpt && childOriginalOpt.isCorrect) {
                        child.classList.add('correct');
                    }
                });
            }
        }
    }
    
    setTimeout(() => {
        showNextQuestion();
    }, 1000);
}

function showNextQuestion() {
    currentQuestionIndex++;
    if (currentQuestionIndex < currentTestSet.length) {
        const nextQDiv = document.getElementById(`q-${currentQuestionIndex}`);
        if (nextQDiv) {
            nextQDiv.style.display = 'block';
            nextQDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        startQuestionTimer();
    } else {
        finishTest();
    }
}
