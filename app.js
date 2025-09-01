let tg = window.Telegram.WebApp;
let activeTimer = null;
let timerInterval = null;
let timerPaused = false;
let timeLeft = 0;
let notes = JSON.parse(localStorage.getItem('notes')) || [];
let chatHistory = [];
let currencyRates = {};

// DeepSeek API конфигурация
const DEEPSEEK_API_KEY = "sk-a5f420377deb4974ae5f30ab0194fc7f";
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

// Инициализация
tg.expand();
tg.enableClosingConfirmation();
tg.disableVerticalSwipes(); // Запрет приближения

// Блокировка масштабирования
document.addEventListener('touchstart', function(event) {
    if (event.touches.length > 1) {
        event.preventDefault();
    }
}, { passive: false });

document.addEventListener('gesturestart', function(event) {
    event.preventDefault();
});

// ================== ОБЩИЕ ФУНКЦИИ ==================
function showSection(sectionName) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
    });
    document.getElementById(sectionName + '-section').classList.remove('hidden');
    document.getElementById('main-menu').classList.add('hidden');
}

function showMainMenu() {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
    });
    document.getElementById('main-menu').classList.remove('hidden');
}

function switchMathTab(tabName) {
    document.querySelectorAll('.math-tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    document.querySelectorAll('.math-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(tabName + '-tab').classList.remove('hidden');
    document.querySelector(`.math-tabs button[onclick="switchMathTab('${tabName}')"]`).classList.add('active');
}

function switchCurrencyTab(tabName) {
    document.querySelectorAll('.currency-tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    document.querySelectorAll('.currency-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(tabName + '-tab').classList.remove('hidden');
    document.querySelector(`.currency-tabs button[onclick="switchCurrencyTab('${tabName}')"]`).classList.add('active');
}

// ================== МАТЕМАТИКА ==================
// Калькулятор
function addToCalc(value) {
    const input = document.getElementById('calc-input');
    input.value += value;
}

function clearCalc() {
    document.getElementById('calc-input').value = '';
    document.getElementById('calc-result').innerHTML = '';
}

function calculate() {
    const input = document.getElementById('calc-input');
    const expression = input.value
        .replace(/\^/g, '**')
        .replace(/√/g, 'sqrt')
        .replace(/π/g, 'pi');
    
    if (!expression) return;
    
    try {
        const result = math.evaluate(expression);
        document.getElementById('calc-result').innerHTML = 
            `<strong>Результат:</strong> ${math.round(result, 6)}`;
    } catch (error) {
        document.getElementById('calc-result').innerHTML = 
            `<strong class="error">Ошибка:</strong> ${error.message}`;
    }
}

// Уравнения
function addMathSymbol(symbol) {
    const input = document.getElementById('equation-input');
    input.value += symbol;
}

function addMathFunction(func) {
    const input = document.getElementById('equation-input');
    input.value += func;
}

function addFraction() {
    const input = document.getElementById('equation-input');
    input.value += '()/()';
}

async function solveEquation() {
    const equation = document.getElementById('equation-input').value.trim();
    if (!equation) {
        alert('Введите уравнение для решения');
        return;
    }

    const stepsDiv = document.getElementById('equation-steps');
    const resultDiv = document.getElementById('equation-result');
    
    stepsDiv.innerHTML = '<div class="loading">🔍 Анализируем уравнение...</div>';
    resultDiv.innerHTML = '';
    
    try {
        let preparedEquation = equation
            .replace(/²/g, '^2')
            .replace(/³/g, '^3')
            .replace(/√/g, 'sqrt')
            .replace(/π/gi, 'pi');

        let solutions = [];
        let steps = [];
        
        // Пытаемся решить символьно
        try {
            const node = math.parse(preparedEquation);
            steps.push(`1. Парсинг уравнения: ${node.toString()}`);
            
            const simplified = math.simplify(node);
            steps.push(`2. Упрощенное уравнение: ${simplified.toString()}`);
            
            solutions = math.solve(simplified, 'x');
            steps.push(`3. Найдены решения: ${solutions.join(', ')}`);
            
        } catch (symbolError) {
            steps.push('1. Символьное решение невозможно, используем численные методы');
            
            // Численное решение
            solutions = [];
            const tolerance = 0.001;
            
            for (let x = -100; x <= 100; x += 0.01) {
                try {
                    const expr = preparedEquation.replace(/=/g, '-');
                    const value = math.evaluate(expr.replace(/x/gi, `(${x})`));
                    
                    if (Math.abs(value) < tolerance) {
                        const roundedX = math.round(x, 4);
                        if (!solutions.some(sol => Math.abs(sol - roundedX) < 0.01)) {
                            solutions.push(roundedX);
                        }
                    }
                } catch (e) {}
            }
            
            steps.push(`2. Найдено ${solutions.length} численных решений`);
        }

        stepsDiv.innerHTML = steps.map(step => `<div class="step">${step}</div>`).join('');
        
        if (solutions.length > 0) {
            resultDiv.innerHTML = `
                <strong class="success">✅ Уравнение решено!</strong><br>
                <strong>Корни:</strong> ${solutions.join(', ')}<br>
                <small>Всего найдено: ${solutions.length} корней</small>
            `;
        } else {
            resultDiv.innerHTML = `
                <strong class="error">❌ Решений не найдено</strong><br>
                <small>Попробуйте изменить уравнение</small>
            `;
        }
        
    } catch (error) {
        resultDiv.innerHTML = `
            <strong class="error">Ошибка решения уравнения</strong><br>
            <small>${error.message}</small>
        `;
    }
}

// Графики
function plotFunction() {
    const funcInput = document.getElementById('function-input').value.trim();
    if (!funcInput) {
        alert('Введите функцию для построения графика');
        return;
    }

    const graphContainer = document.getElementById('graph-container');
    graphContainer.innerHTML = '<div class="loading">📈 Строим график...</div>';

    try {
        let expression = funcInput
            .replace(/√/g, 'sqrt')
            .replace(/²/g, '^2')
            .replace(/³/g, '^3')
            .replace(/π/gi, 'pi');

        const xValues = [];
        const yValues = [];
        
        for (let x = -10; x <= 10; x += 0.1) {
            try {
                const expr = expression.replace(/x/gi, `(${x})`);
                const y = math.evaluate(expr);
                
                if (typeof y === 'number' && isFinite(y)) {
                    xValues.push(x);
                    yValues.push(y);
                }
            } catch (e) {}
        }

        const trace = {
            x: xValues,
            y: yValues,
            type: 'scatter',
            mode: 'lines',
            line: {color: '#4fc3f7', width: 3},
            name: `f(x) = ${funcInput}`
        };

        const layout = {
            title: `График функции: f(x) = ${funcInput}`,
            plot_bgcolor: '#1a1a1a',
            paper_bgcolor: '#1a1a1a',
            font: {color: '#ffffff'},
            xaxis: {gridcolor: '#3d3d3d', title: 'x'},
            yaxis: {gridcolor: '#3d3d3d', title: 'f(x)'},
            margin: {l: 60, r: 40, t: 60, b: 60}
        };

        Plotly.newPlot(graphContainer, [trace], layout);

    } catch (error) {
        graphContainer.innerHTML = `
            <div class="error">
                ❌ Ошибка построения графика<br>
                <small>${error.message}</small>
            </div>
        `;
    }
}

// AI Решение математических задач
async function solveWithAI() {
    const problem = document.getElementById('math-problem-input').value.trim();
    if (!problem) {
        alert('Опишите математическую задачу');
        return;
    }

    const resultDiv = document.getElementById('ai-solution-result');
    resultDiv.innerHTML = '<div class="loading">🤖 AI решает задачу...</div>';

    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [{
                    role: "system",
                    content: "Ты эксперт по математике. Решай задачи подробно, с пошаговыми объяснениями. Отвечай на русском языке."
                }, {
                    role: "user",
                    content: `Реши эту математическую задачу: ${problem}`
                }],
                temperature: 0.3,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.choices && data.choices[0]) {
            resultDiv.innerHTML = `
                <strong class="success">✅ Решение от AI:</strong><br>
                <div style="white-space: pre-wrap; line-height: 1.5;">
                    ${data.choices[0].message.content}
                </div>
            `;
        } else {
            throw new Error('Неверный формат ответа от AI');
        }

    } catch (error) {
        resultDiv.innerHTML = `
            <strong class="error">❌ Ошибка AI:</strong><br>
            <small>${error.message}</small>
        `;
    }
}

// ================== КУРСЫ ВАЛЮТ ==================
async function getCBRrates() {
    const resultDiv = document.getElementById('currency-result');
    resultDiv.innerHTML = '<div class="loading">🔄 Загрузка курсов ЦБ РФ...</div>';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch('https://www.cbr-xml-daily.ru/daily_json.js', {
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

        const data = await response.json();
        if (!data.Valute) throw new Error('Неверный формат данных');

        currencyRates = data.Valute;

        let html = '<div class="currency-list">';
        const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CHF', 'TRY', 'KZT'];

        currencies.forEach(code => {
            if (currencyRates[code]) {
                const currency = currencyRates[code];
                const change = currency.Value - currency.Previous;
                const changeClass = change >= 0 ? 'positive' : 'negative';
                const changeSymbol = change >= 0 ? '↗' : '↘';

                html += `
                    <div class="currency-item">
                        <span class="currency-code">${code}</span>
                        <span class="currency-value">${currency.Value.toFixed(2)} ₽</span>
                        <span class="currency-change ${changeClass}">
                            ${changeSymbol} ${Math.abs(change).toFixed(2)}
                        </span>
                    </div>
                `;
            }
        });

        html += '</div>';
        resultDiv.innerHTML = html;

    } catch (error) {
        resultDiv.innerHTML = `
            <div class="error">
                ❌ Ошибка загрузки курсов<br>
                <small>${error.message}</small>
            </div>
        `;
    }
}

// Конвертер валют
async function convertCurrency() {
    const amount = parseFloat(document.getElementById('amount-input').value);
    const fromCurrency = document.getElementById('from-currency').value;
    const toCurrency = document.getElementById('to-currency').value;

    if (isNaN(amount) || amount <= 0) {
        alert('Введите корректную сумму');
        return;
    }

    const resultDiv = document.getElementById('conversion-result');
    resultDiv.innerHTML = '<div class="loading">🔄 Конвертируем...</div>';

    try {
        // Если курсы не загружены, загружаем
        if (Object.keys(currencyRates).length === 0) {
            await getCBRrates();
        }

        let fromRate = 1;
        let toRate = 1;

        if (fromCurrency !== 'RUB') {
            fromRate = currencyRates[fromCurrency]?.Value || 1;
        }
        if (toCurrency !== 'RUB') {
            toRate = currencyRates[toCurrency]?.Value || 1;
        }

        const result = (amount * fromRate) / toRate;

        resultDiv.innerHTML = `
            <strong class="success">✅ Результат конвертации:</strong><br>
            <div style="font-size: 24px; font-weight: bold; text-align: center; margin: 15px 0;">
                ${amount.toFixed(2)} ${fromCurrency} = ${result.toFixed(2)} ${toCurrency}
            </div>
            <small>Курс: 1 ${fromCurrency} = ${(fromRate/toRate).toFixed(4)} ${toCurrency}</small>
        `;

    } catch (error) {
        resultDiv.innerHTML = `
            <div class="error">
                ❌ Ошибка конвертации<br>
                <small>${error.message}</small>
            </div>
        `;
    }
}

// ================== ЗАМЕТКИ ==================
function addNote() {
    const title = document.getElementById('note-title').value.trim();
    const content = document.getElementById('note-content').value.trim();

    if (!title || !content) {
        alert('Заполните заголовок и текст заметки');
        return;
    }

    notes.push({
        id: Date.now(),
        title: title,
        content: content,
        date: new Date().toLocaleString('ru-RU'),
        expanded: false
    });

    localStorage.setItem('notes', JSON.stringify(notes));
    
    document.getElementById('note-title').value = '';
    document.getElementById('note-content').value = '';
    
    displayNotes();
}

function displayNotes() {
    const notesList = document.getElementById('notes-list');
    
    if (notes.length === 0) {
        notesList.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">📝 Заметок пока нет</div>';
        return;
    }

    let html = '';
    notes.forEach((note, index) => {
        html += `
            <div class="note-item" onclick="toggleNote(${index})">
                <div class="note-header">
                    <div class="note-title">${note.title}</div>
                    <div class="note-date">${note.date}</div>
                </div>
                ${note.expanded ? 
                    `<div class="note-content-full">${note.content}</div>` :
                    `<div class="note-content-preview">${note.content.substring(0, 50)}${note.content.length > 50 ? '...' : ''}</div>`
                }
                <button onclick="deleteNote(event, ${index})" style="margin-top: 10px; padding: 5px 10px; font-size: 12px;">🗑️ Удалить</button>
            </div>
        `;
    });

    notesList.innerHTML = html;
}

function toggleNote(index) {
    notes[index].expanded = !notes[index].expanded;
    localStorage.setItem('notes', JSON.stringify(notes));
    displayNotes();
}

function deleteNote(event, index) {
    event.stopPropagation();
    if (confirm('Удалить эту заметку?')) {
        notes.splice(index, 1);
        localStorage.setItem('notes', JSON.stringify(notes));
        displayNotes();
    }
}

// ================== ТАЙМЕР ==================
function startTimer() {
    const minutes = parseInt(document.getElementById('timer-minutes').value);
    
    if (isNaN(minutes) || minutes < 1) {
        alert('Введите корректное количество минут');
        return;
    }
    
    if (activeTimer) clearInterval(activeTimer);
    
    timerPaused = false;
    timeLeft = minutes * 60;
    updateTimerDisplay();
    
    activeTimer = setInterval(() => {
        if (!timerPaused && timeLeft > 0) {
            timeLeft--;
            updateTimerDisplay();
            
            if (timeLeft === 0) {
                clearInterval(activeTimer);
                tg.showPopup({
                    title: '⏰ Таймер',
                    message: 'Время вышло!',
                    buttons: [{type: 'ok'}]
                });
            }
        }
    }, 1000);
}

function pauseTimer() {
    timerPaused = !timerPaused;
    updateTimerDisplay();
}

function resetTimer() {
    if (activeTimer) clearInterval(activeTimer);
    timerPaused = false;
    timeLeft = 0;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const timerDisplay = document.getElementById('timer-display');
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    
    if (timeLeft > 0) {
        timerDisplay.innerHTML = `
            <div class="${timerPaused ? 'timer-paused' : 'timer-active'}">
                ⏰ ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}
                ${timerPaused ? ' (Пауза)' : ''}
            </div>
        `;
    } else {
        timerDisplay.innerHTML = '⏰ Таймер не активен';
    }
}

// ================== ЧАТ С ИИ ==================
async function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    if (!message) return;

    addMessage(message, 'user');
    input.value = '';
    
    const messagesDiv = document.getElementById('chat-messages');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message bot-message';
    loadingDiv.innerHTML = '<div class="loading">🤖 Думаю...</div>';
    messagesDiv.appendChild(loadingDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    {
                        role: "system",
                        content: "Ты полезный AI ассистент. Отвечай кратко и по делу на русском языке."
                    },
                    ...chatHistory.slice(-6),
                    {role: "user", content: message}
                ],
                temperature: 0.7,
                max_tokens: 1000
            })
        });

        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

        const data = await response.json();
        loadingDiv.remove();

        if (data.choices && data.choices[0]) {
            const botResponse = data.choices[0].message.content;
            addMessage(botResponse, 'bot');
            
            chatHistory.push(
                {role: "user", content: message},
                {role: "assistant", content: botResponse}
            );
            
            if (chatHistory.length > 10) chatHistory = chatHistory.slice(-10);
        } else {
            addMessage('❌ Не удалось получить ответ от AI', 'bot');
        }

    } catch (error) {
        loadingDiv.remove();
        addMessage('❌ Ошибка подключения к AI', 'bot');
        console.error('Chat error:', error);
    }
}

function addMessage(text, sender) {
    const messagesDiv = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    messageDiv.textContent = text;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    return messageDiv;
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

// ================== ИНИЦИАЛИЗАЦИЯ ==================
document.addEventListener('DOMContentLoaded', function() {
    switchMathTab('calculator');
    switchCurrencyTab('rates');
    displayNotes();
    getCBRrates();
    
    // Автообновление курсов каждые 5 минут
    setInterval(getCBRrates, 300000);
});
