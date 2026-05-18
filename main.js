import './style.css';

let allQuestions = [];
let currentTestSet = [];
let userAnswers = {}; // { questionIndex: selectedOptionText }
let currentRangeKey = '';
const SET_SIZE = 25;

const setupScreen = document.getElementById('setup-screen');
const testScreen = document.getElementById('test-screen');
const resultScreen = document.getElementById('result-screen');
const rangeContainer = document.getElementById('range-container');
const loaderContainer = document.getElementById('loader-container');
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
const modalFinishBtn = document.getElementById('modal-finish-btn');

let isTestActive = false;
let isReviewMode = false;

// Initialize
window.addEventListener('DOMContentLoaded', init);

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
    isTestActive = false;
    isReviewMode = false;
    testScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');
    setupScreen.classList.remove('hidden');
    exitModal.classList.add('hidden'); // Ensure modal is hidden
    renderRanges();
}

async function init() {
    try {
        const response = await fetch('/test.md');
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
        const options = parts.slice(1).map(opt => {
            const isCorrect = /^\s*#/.test(opt);
            const cleanText = opt.replace(/^\s*#/, '').trim();
            return { text: cleanText, isCorrect: isCorrect };
        });
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
        const rangeKey = `score_${start}_${end}`;
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
    const fullRangeKey = 'score_full_shuffle';
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
    currentRangeKey = 'score_full_shuffle';
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

    rangeDisplay.innerText = `Tasodifiy 25 ta savol`;
    finishBtns.forEach(btn => btn.classList.remove('hidden'));
    backHomeBtn.classList.remove('hidden'); // Show back button
    renderQuestions();
    renderNavigator();
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
                const optText = child.innerText;
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

    rangeDisplay.innerText = `${start + 1} dan ${end} gacha savollar`;
    finishBtns.forEach(btn => btn.classList.remove('hidden'));
    backHomeBtn.classList.remove('hidden'); // Show back button
    renderQuestions();
    renderNavigator();
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

        const h3 = document.createElement('h3');
        h3.innerText = `${qIdx + 1}. ${q.question}`;
        qDiv.appendChild(h3);

        const optsDiv = document.createElement('div');
        optsDiv.className = 'options-container';
        if (isReview) optsDiv.style.pointerEvents = 'none';

        q.shuffledOptions.forEach(opt => {
            const optCard = document.createElement('div');
            optCard.className = 'option-card';
            if (isReview && userAnswers[qIdx] === opt.text) {
                optCard.classList.add('selected');
            }
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
                        const childOriginalOpt = q.options.find(o => o.text === child.innerText);
                        if (childOriginalOpt && childOriginalOpt.isCorrect) {
                            child.classList.add('correct');
                        }
                    });
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
            const optText = child.innerText;
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

    setTimeout(() => {
        testScreen.classList.add('hidden');
        resultScreen.classList.remove('hidden');

        finalScore.innerText = score;
        totalQuestionsSpan.innerText = currentTestSet.length;

        let msg = "";
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

        document.getElementById('result-message').innerText = msg;
    }, 2000);
}
