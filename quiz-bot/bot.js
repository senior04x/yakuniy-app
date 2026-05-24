require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { loadAllTests } = require('./parser');
const fs = require('fs');
const path = require('path');

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
    console.error("Error: TELEGRAM_BOT_TOKEN is not defined in .env");
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const allData = loadAllTests(); // Load on startup

// --- Express Server for Render ---
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is running!');
});
app.get('/ping', (req, res) => {
    res.send('pong');
});

app.listen(port, () => {
    console.log(`Web server is listening on port ${port}`);
});
// ---------------------------------

// session store: chatId -> sessionData
const sessions = {};
const SET_SIZE = 25;
let botInfo = null;
bot.getMe().then(info => { botInfo = info; });

const RESULTS_FILE = path.join(__dirname, 'results.json');
function loadResults() {
    if (fs.existsSync(RESULTS_FILE)) {
        return JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8'));
    }
    return {};
}

function saveResult(subjectFile, resultData) {
    const data = loadResults();
    if (!data[subjectFile]) data[subjectFile] = [];
    data[subjectFile].push(resultData);
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(data, null, 2));
    
    data[subjectFile].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.durationMs - b.durationMs;
    });
    
    const rank = data[subjectFile].findIndex(r => r.timestamp === resultData.timestamp) + 1;
    return { rank, totalParticipants: data[subjectFile].length };
}

bot.onText(/\/stop/, (msg) => {
    const chatId = msg.chat.id;
    const session = sessions[chatId];
    if (session) {
        if (session.timeoutHandle) clearTimeout(session.timeoutHandle);
        bot.sendMessage(chatId, "🛑 Test to'xtatildi.");
        finishTest(chatId, session);
    } else {
        bot.sendMessage(chatId, "❌ Sizda hozirda faol test mavjud emas.");
    }
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const markup = {
        inline_keyboard: [
            [{ text: "👨‍💻 Admin bilan bog'lanish", url: "https://t.me/omankuloff" }]
        ]
    };

    if (sessions[chatId]) {
        bot.sendMessage(chatId, "⚠️ Sizda aktiv test mavjud. Avval uni yakunlang yoki /stop buyrug'i orqali to'xtating.", { reply_markup: markup });
    } else {
        bot.sendMessage(chatId, "Savollaringiz yoki takliflaringiz bo'lsa admin bilan bog'lanishingiz mumkin:", { reply_markup: markup });
    }
});

bot.onText(/\/start(?:\s+(.+))?/, (msg, match) => {
    try {
        const chatId = msg.chat.id;
        
        // Clear any active session if user presses start
        if (sessions[chatId]) {
            if (sessions[chatId].timeoutHandle) clearTimeout(sessions[chatId].timeoutHandle);
            delete sessions[chatId];
        }
        
        // Reload test files from disk
        Object.assign(allData, loadAllTests());

        const payload = match[1];
    if (payload) {
        const parts = payload.split('_');
        if (parts.length >= 3) {
            const subjectFile = parts[0];
            const start = parts[1];
            const end = parts[2];
            
            let subjectName = "Test";
            if (subjectFile === 'test.md') subjectName = "Xalqaro Moliya";
            if (subjectFile === 'test2.md') subjectName = "Islomiy Bank ishi";
            if (subjectFile === 'test3.md') subjectName = "Bank ishiga kirish";
            
            let qCount = 25;
            let rangeText = "";
            if (start === 'full') {
                qCount = 25;
                rangeText = "(Tasodifiy 25 ta)";
            } else {
                qCount = parseInt(end) - parseInt(start);
                rangeText = `(${parseInt(start)+1} - ${end})`;
            }
            const text = `🎲 "${subjectName}" ${rangeText} testi\n✏️ ${qCount} ta savol • ⏱ 30 soniya`;
            
            bot.sendMessage(chatId, text, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Bu testni boshlash 🚀', callback_data: `startq_${subjectFile}_${start}_${end}` }],
                        [{ text: 'Testni ulashish 📤', switch_inline_query: `${subjectFile}_${start}_${end}` }]
                    ]
                }
            });
            return;
        }
        }
        
        sendSubjectMenu(chatId);
    } catch (err) {
        console.error("Start command error:", err);
        bot.sendMessage(msg.chat.id, "Xatolik: " + err.message);
    }
});

function sendSubjectMenu(chatId) {
    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '📚 Xalqaro moliyadan', callback_data: 'sub_test.md' }],
                [{ text: '📚 Islomiy Bank ishidan', callback_data: 'sub_test2.md' }],
                [{ text: '📚 Bank ishiga kirish', callback_data: 'sub_test3.md' }]
            ]
        }
    };
    bot.sendMessage(chatId, "Assalomu alaykum! Qaysi fandan test ishlashni xohlaysiz? 👇", options);
}

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data.startsWith('sub_')) {
        const subjectFile = data.replace('sub_', '');
        if (!allData[subjectFile]) {
            bot.answerCallbackQuery(query.id, { text: "Bu fan bo'yicha testlar topilmadi!" });
            return;
        }
        bot.answerCallbackQuery(query.id);
        sendRangeMenu(chatId, subjectFile);
    } else if (data.startsWith('range_')) {
        const parts = data.split('_');
        const subjectFile = parts[1];
        const start = parts[2];
        const end = parts[3];

        bot.answerCallbackQuery(query.id);
        
        let subjectName = "Test";
        if (subjectFile === 'test.md') subjectName = "Xalqaro Moliya";
        if (subjectFile === 'test2.md') subjectName = "Islomiy Bank ishi";
        if (subjectFile === 'test3.md') subjectName = "Bank ishiga kirish";
        
        let qCount = 25;
        let rangeText = "";
        if (start === 'full') {
            qCount = 25;
            rangeText = "(Tasodifiy 25 ta)";
        } else {
            qCount = parseInt(end) - parseInt(start);
            rangeText = `(${parseInt(start)+1} - ${end})`;
        }

        const text = `🎲 "${subjectName}" ${rangeText} testi\n✏️ ${qCount} ta savol • ⏱ 30 soniya`;
        const botUsername = botInfo ? botInfo.username : 'QuizAvtoBot';
        
        bot.sendMessage(chatId, text, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Bu testni boshlash 🚀', callback_data: `startq_${subjectFile}_${start}_${end}` }],
                    [{ text: 'Guruhda testni boshlash 👥', url: `https://t.me/${botUsername}?startgroup=${subjectFile}_${start}_${end}` }],
                    [{ text: 'Testni ulashish 📤', switch_inline_query: `${subjectFile}_${start}_${end}` }]
                ]
            }
        });
    } else if (data.startsWith('startq_')) {
        const parts = data.split('_');
        const subjectFile = parts[1];
        const start = parts[2];
        const end = parts[3];

        bot.answerCallbackQuery(query.id);
        
        bot.sendMessage(chatId, "Boshlashga tayyormisiz? 👇", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Men tayyorman! 🚀", callback_data: `ready_${subjectFile}_${start}_${end}` }]
                ]
            }
        });
    } else if (data.startsWith('ready_')) {
        const parts = data.split('_');
        const subjectFile = parts[1];
        const start = parts[2];
        const end = parts[3];
        
        bot.answerCallbackQuery(query.id);
        const msgId = query.message.message_id;
        
        startCountdownAndQuiz(chatId, msgId, subjectFile, start, end, query.from);

    } else if (data === 'home') {
        bot.answerCallbackQuery(query.id);
        sendSubjectMenu(chatId);
    } else if (data === 'resume_test') {
        bot.answerCallbackQuery(query.id);
        const session = sessions[chatId];
        if (session && session.isPaused) {
            session.isPaused = false;
            session.consecutiveTimeouts = 0;
            session.currentIndex++; 
            bot.sendMessage(chatId, "▶️ Test davom ettiriladi...");
            setTimeout(() => sendNextQuestion(chatId), 1000);
        } else {
            bot.sendMessage(chatId, "Pauza qilingan test topilmadi.");
        }
    } else if (data === 'stop_test') {
        bot.answerCallbackQuery(query.id);
        const session = sessions[chatId];
        if (session) {
            bot.sendMessage(chatId, "⏹ Test yakunlandi.");
            finishTest(chatId, session);
        }
    } else if (data.startsWith('retake_')) {
        bot.answerCallbackQuery(query.id);
        const parts = data.split('_');
        const subjectFile = parts[1];
        const start = parts[2];
        const end = parts[3];
        
        bot.sendMessage(chatId, "🔄 Qayta ishlash tayyor! Boshlashga tayyormisiz? 👇", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Men tayyorman! 🚀", callback_data: `ready_${subjectFile}_${start}_${end}` }]
                ]
            }
        });
    }
});

function sendRangeMenu(chatId, subjectFile) {
    const tests = allData[subjectFile];
    const totalQuestions = tests.length;
    const numRanges = Math.ceil(totalQuestions / SET_SIZE);

    const inline_keyboard = [];
    for (let i = 0; i < numRanges; i++) {
        const start = i * SET_SIZE;
        const end = Math.min(start + SET_SIZE, totalQuestions);
        inline_keyboard.push([{ text: `🔢 ${start + 1} - ${end} gacha savollar`, callback_data: `range_${subjectFile}_${start}_${end}` }]);
    }
    
    inline_keyboard.push([{ text: `🔀 Tasodifiy barcha (25 ta)`, callback_data: `range_${subjectFile}_full_shuffle` }]);
    inline_keyboard.push([{ text: `🔙 Orqaga`, callback_data: `home` }]);

    bot.sendMessage(chatId, "Test bo'limini tanlang:", {
        reply_markup: { inline_keyboard }
    });
}

function shuffle(array) {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

async function startCountdownAndQuiz(chatId, msgId, subjectFile, start, end, user) {
    const delays = [3, 2, 1];
    for (const d of delays) {
        try {
            await bot.editMessageText(`Boshlanishiga: ${d}... ⏳`, { chat_id: chatId, message_id: msgId });
        } catch (e) {}
        await new Promise(r => setTimeout(r, 1000));
    }
    try {
        await bot.editMessageText(`🏁 Go!`, { chat_id: chatId, message_id: msgId });
    } catch (e) {}
    
    startQuiz(chatId, subjectFile, start, end, user);
}

function startQuiz(chatId, subjectFile, start, end, user) {
    let testSet = [];
    const allQ = allData[subjectFile];

    if (start === 'full') {
        testSet = shuffle(allQ).slice(0, SET_SIZE);
    } else {
        const s = parseInt(start);
        const e = parseInt(end);
        testSet = shuffle(allQ.slice(s, e));
    }

    sessions[chatId] = {
        testSet: testSet,
        currentIndex: 0,
        score: 0,
        subjectFile: subjectFile,
        originalStart: start,
        originalEnd: end,
        activePollId: null,
        activePollMsgId: null,
        timeoutHandle: null,
        consecutiveTimeouts: 0,
        isPaused: false,
        startTime: Date.now(),
        user: {
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            username: user.username || ''
        }
    };

    sendNextQuestion(chatId);
}

async function handleTimeout(chatId) {
    const session = sessions[chatId];
    if (!session) return;
    
    if (session.activePollMsgId) {
        try {
            await bot.stopPoll(chatId, session.activePollMsgId);
        } catch (e) {} 
    }
    
    session.consecutiveTimeouts = (session.consecutiveTimeouts || 0) + 1;
    
    if (session.consecutiveTimeouts >= 2) {
        session.isPaused = true;
        bot.sendMessage(chatId, "⏸ **Test pauza qilindi!**\nSiz ketma-ket 2 marta javob bermadingiz. Shuning uchun test to'xtatib turildi.", {
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "▶️ Davom etish", callback_data: "resume_test" }],
                    [{ text: "⏹ Yakunlash", callback_data: "stop_test" }]
                ]
            }
        });
        return; // Halt sending the next question
    }
    
    bot.sendMessage(chatId, "⏳ Vaqt tugadi! Noto'g'ri deb qabul qilindi.");
    session.currentIndex++;
    
    setTimeout(() => {
        sendNextQuestion(chatId);
    }, 1500);
}

async function sendNextQuestion(chatId) {
    const session = sessions[chatId];
    if (!session || session.isPaused) return;
    
    if (session.timeoutHandle) clearTimeout(session.timeoutHandle);
    
    if (session.currentIndex >= session.testSet.length) {
        finishTest(chatId, session);
        return;
    }

    const q = session.testSet[session.currentIndex];
    
    const shuffledOptions = shuffle([...q.options]);
    let newCorrectIndex = shuffledOptions.findIndex(o => o.isCorrect);
    
    let optionsText = shuffledOptions.map(o => {
        let t = o.text;
        if (t.length > 100) t = t.substring(0, 97) + '...';
        return t;
    });
    
    if (optionsText.length < 2) {
        optionsText.push("Boshqa variant yo'q");
        if (newCorrectIndex >= optionsText.length) newCorrectIndex = 0;
    }
    if (optionsText.length > 10) {
        optionsText = optionsText.slice(0, 10);
        if (newCorrectIndex >= 10) newCorrectIndex = 0;
    }

    let questionText = `❓ ${session.currentIndex + 1}-savol.\n\n${q.question}`;
    if (questionText.length > 300) questionText = questionText.substring(0, 297) + '...';

    try {
        const sentPoll = await bot.sendPoll(chatId, questionText, optionsText, {
            type: 'quiz',
            correct_option_id: newCorrectIndex,
            is_anonymous: false,
            open_period: 30
        });
        session.activePollId = sentPoll.poll.id;
        session.activePollMsgId = sentPoll.message_id;
        session.currentCorrectIndex = newCorrectIndex;
        
        session.timeoutHandle = setTimeout(() => {
            handleTimeout(chatId);
        }, 31000); 
    } catch (err) {
        console.error("Send Poll error: ", err);
        bot.sendMessage(chatId, "❌ Savolni yuborishda xatolik yuz berdi. Keyingisiga o'tamiz...");
        session.currentIndex++;
        setTimeout(() => sendNextQuestion(chatId), 1000);
    }
}

bot.on('poll_answer', (answer) => {
    const userId = answer.user.id;
    const session = sessions[userId];
    if (!session || session.activePollId !== answer.poll_id || session.isPaused) return;

    if (session.timeoutHandle) clearTimeout(session.timeoutHandle);
    
    // Reset consecutive timeouts on any answer
    session.consecutiveTimeouts = 0;

    const selectedOption = answer.option_ids[0];
    
    if (selectedOption === session.currentCorrectIndex) {
        session.score++;
    }

    session.currentIndex++;
    
    setTimeout(() => {
        sendNextQuestion(userId);
    }, 1500);
});

function finishTest(chatId, session) {
    const score = session.score;
    const total = session.testSet.length;
    const incorrect = total - score;
    const endTime = Date.now();
    const durationMs = endTime - session.startTime;
    const durationMins = Math.floor(durationMs / 60000);
    const durationSecs = Math.floor((durationMs % 60000) / 1000);
    
    const resultData = {
        userId: chatId,
        user: session.user,
        score: score,
        durationMs: durationMs,
        timestamp: endTime
    };
    
    const rankInfo = saveResult(session.subjectFile, resultData);
    
    let msg = "";
    if (session.subjectFile === 'test.md') {
        if (score < 10) msg = `"${score}" tayam ishlidimi churka bor boshqatdan tayyorlanib kel 🤦‍♂️`;
        else if (score < 15) msg = `Bleee yarmiini zo'rg'a ishlading 😒`;
        else if (score < 20) msg = `Yaxshi Bratishka "${score}" ta ishlabsan 👍`;
        else if (score < 24) msg = `Eee gap yo'g'e "${score}" ta ishlabsan 🔥`;
        else if (score === 24) msg = `Ha Chumo 24 ta ishlagansan 1 tayam xato qiladimi 😂`;
        else msg = `25 ta ishlabman deb kibirlanma 😎`;
    } else {
        if (score < 10) msg = `"${score}" tayam ishlidimi birodar, bu nima qilganingiz insofdanmi? Boshqatdan urinib ko'ring.`;
        else if (score < 15) msg = `Yarmini zo'rg'a ishlabsiz, kayfiyatingizni tushirmang, yana o'qing.`;
        else if (score < 20) msg = `Yaxshi birodar, "${score}" ta ishlabsiz, harakatingiz yomon emas.`;
        else if (score < 24) msg = `Barakalla, "${score}" ta ishlabsiz, ajoyib natija. 🌟`;
        else if (score === 24) msg = `Juda ajoyib, 24 ta ishlabsiz, bittagina xato qilibsiz-a!`;
        else msg = `Mukammal natija, yuz foiz to'g'ri, lekin kibrlanmang, o'rganishda davom eting. 🥇`;
    }

    const finalMsg = `📊 **Test yakunlandi!**\n\n` +
        `👤 Ism: ${session.user.first_name} ${session.user.last_name ? session.user.last_name : ''}\n` +
        `⏱ Vaqt: ${durationMins} daqiqa, ${durationSecs} soniya\n\n` +
        `✅ To'g'ri javoblar: ${score} ta\n` +
        `❌ Noto'g'ri javoblar: ${incorrect} ta\n` +
        `🏆 Reyting: ${rankInfo.totalParticipants} kishi orasida ${rankInfo.rank}-o'rin!\n\n` +
        `📝 Xulosa: ${msg}`;
    
    bot.sendMessage(chatId, finalMsg, {
        parse_mode: "Markdown",
        reply_markup: {
            inline_keyboard: [
                [{ text: '🏠 Bosh menuga qaytish', callback_data: 'home' }],
                [{ text: '🔄 Qayta ishlash', callback_data: `retake_${session.subjectFile}_${session.originalStart}_${session.originalEnd}` }]
            ]
        }
    });

    delete sessions[chatId];
}

bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const doc = msg.document;
    
    if (!doc.file_name.endsWith('.md')) {
        return bot.sendMessage(chatId, "❌ Faqat .md formatidagi fayllarni qabul qilaman!");
    }

    try {
        const fileLink = await bot.getFileLink(doc.file_id);
        const request = require('https').request(fileLink, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                const filePath = path.join(__dirname, 'tests', doc.file_name);
                fs.writeFileSync(filePath, data);
                Object.assign(allData, loadAllTests());
                bot.sendMessage(chatId, `✅ Fayl muvaffaqiyatli saqlandi va tizimga qo'shildi: ${doc.file_name}`);
            });
        });
        request.end();
    } catch (e) {
        bot.sendMessage(chatId, "❌ Faylni yuklashda xatolik: " + e.message);
    }
});

console.log("Telegram Quiz Bot is running...");
