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

// Initialize
window.addEventListener('DOMContentLoaded', init);

restartBtn.addEventListener('click', () => {
    testScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');
    setupScreen.classList.remove('hidden');
    renderRanges();
});

finishBtns.forEach(btn => {
    btn.addEventListener('click', finishTest);
});

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
            scoreHtml = `<div class="range-score">Oxirgi natija: ${savedScore} / ${end - start}</div>`;
        }

        btn.innerHTML = `
            <div class="range-label">${start + 1} - ${end}</div>
            <div class="range-info">${end - start} ta savol</div>
            ${scoreHtml}
        `;
        
        btn.addEventListener('click', () => startTestRange(start, end, rangeKey));
        rangeContainer.appendChild(btn);
    }
}

function startTestRange(start, end, rangeKey) {
    currentRangeKey = rangeKey;
    currentTestSet = allQuestions.slice(start, end).map(q => ({
        ...q,
        shuffledOptions: shuffle([...q.options])
    }));
    
    userAnswers = {};
    setupScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');
    testScreen.classList.remove('hidden');

    rangeDisplay.innerText = `${start + 1} dan ${end} gacha savollar`;
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

function renderQuestions() {
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
        
        q.shuffledOptions.forEach(opt => {
            const optCard = document.createElement('div');
            optCard.className = 'option-card';
            optCard.innerText = opt.text;
            optCard.addEventListener('click', () => {
                Array.from(optsDiv.children).forEach(child => child.classList.remove('selected'));
                optCard.classList.add('selected');
                userAnswers[qIdx] = opt.text;
                updateNavigator(qIdx);
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

    localStorage.setItem(currentRangeKey, score);

    setTimeout(() => {
        testScreen.classList.add('hidden');
        resultScreen.classList.remove('hidden');

        finalScore.innerText = score;
        totalQuestionsSpan.innerText = currentTestSet.length;

        const pct = (score / currentTestSet.length) * 100;
        let msg = "";
        if (pct === 100) msg = "A'lo natija! Mukammal!";
        else if (pct >= 80) msg = "Juda yaxshi natija!";
        else if (pct >= 60) msg = "Yaxshi, yana ozgina harakat qiling.";
        else msg = "Ko'proq tayyorlanishingiz kerak.";

        document.getElementById('result-message').innerText = msg;
    }, 2000);
}
