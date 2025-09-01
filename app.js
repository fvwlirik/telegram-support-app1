let tg = window.Telegram.WebApp;
let activeTimer = null;
let timerInterval = null;
let timerPaused = false;
let timeLeft = 0;
let notes = JSON.parse(localStorage.getItem('notes')) || [];
let chatHistory = [];

// Инициализация
tg.expand();
tg.enableClosingConfirmation();

// DeepSeek API конфигурация
const DEEPSEEK_API_KEY = "YOUR_DEEPSEEK_API_KEY"; // Замените на ваш ключ
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

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

// ================== МАТЕМАТИКА ==================
function switchMathTab(tabName) {
    document.querySelectorAll('.math-tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(tabName + '-tab').classList.remove('hidden');
    document.querySelector(`button[onclick="switchMathTab('${tabName}')"]`).classList.add('active');
}

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
    const expression = input.value.replace(/\^/g, '**');
    
    try {
        const result = math.evaluate(expression);
        document.getElementById('calc-result').innerHTML = 
            `<strong>Результат:</strong> ${result}`;
    } catch (error) {
        document.getElementById('calc-result').innerHTML = 
            `<strong class="error">Ошибка:</strong> ${error.message}`;
    }
}

// Решение уравнений
async function solveEquation() {
    const equation = document.getElementById('equation-input').value;
    if (!equation) return;

    const stepsDiv = document.getElementById('equation-steps');
    const resultDiv = document.getElementById('equation-result');
    
    stepsDiv.innerHTML = '<div class="loading">🔍 Анализируем уравнение...</div>';
    
    try {
        // Простое решение через math.js
        const cleanEquation = equation.replace(/=/g, '==').replace(/\^/g, '**');
        
        stepsDiv.innerHTML = `
            <div class="step">1. Уравнение: ${equation}</div>
            <div class="step">2. Приводим к стандартному виду</div>
        `;
        
        // Пытаемся решить символьно
        let solutions;
        try {
            const expr = math.parse(cleanEquation);
            solutions = math.solve(expr, 'x');
            
            stepsDiv.innerHTML += `
                <div class="step">3. Найдены решения: ${JSON.stringify(solutions)}</div>
            `;
            
        } catch (symbolError) {
            // Численное решение
            stepsDiv.innerHTML += `
                <div class="step">3. Символьное решение невозможно, используем численные методы</div>
            `;
            
            // Простая численная реализация
            solutions = [];
            for (let x = -10; x <= 10; x += 0.1) {
                try {
                    const left = equation.split('=')[0].trim();
                    const right = equation.split('=')[1].trim();
                    const leftVal = math.evaluate(left.replace(/x/g, x));
                    const rightVal = math.evaluate(right.replace(/x/g, x));
                    
                    if (Math.abs(leftVal - rightVal) < 0.001) {
                        solutions.push(math.round(x, 2));
                    }
                } catch (e) {}
            }
            
            solutions = [...new Set(solutions)]; // Убираем дубликаты
        }
        
        if (solutions && solutions.length > 0) {
            resultDiv.innerHTML = `
                <strong class="success">✅ Решено!</strong><br>
                <strong>Корни:</strong> ${solutions.join(', ')}
            `;
        } else {
            resultDiv.innerHTML = `
                <strong class="error">❌ Решений не найдено</strong>
            `;
        }
        
    } catch (error) {
        resultDiv.innerHTML = `
            <strong class="error">Ошибка:</strong> ${error.message}
        `;
    }
}

// Построение графиков
function plotFunction() {
    const funcInput = document.getElementById('function-input').value;
    if (!funcInput) return;

    try {
        const xValues = [];
        const yValues = [];
        
        for (let x = -10; x <= 10; x += 0.1) {
            try {
                const y = math.evaluate(funcInput.replace(/x/g, `(${x})`));
                xValues.push(x);
                yValues.push(y);
            } catch (e) {}
        }
        
        const trace = {
            x: xValues,
            y: yValues,
            type: 'scatter',
            mode: 'lines',
            line: {color: '#4fc3f7', width: 2}
        };
        
        const layout = {
            plot_bgcolor: '#1a1a1a',
            paper_bgcolor: '#1a1a1a',
            font: {color: '#ffffff'},
            xaxis: {gridcolor: '#3d3d3d'},
            yaxis: {gridcolor: '#3d3d3d'},
            margin: {l: 40, r: 40, t: 30, b: 40}
        };
        
        Plotly.newPlot('graph-container', [trace], layout);
        
    } catch (error) {
        document.getElementById('graph-container').innerHTML = `
            <div class="error">Ошибка построения графика: ${error.message}</div>
        `;
    }
}

// ================== КУРСЫ ВАЛЮТ ==================
async function getCBRrates() {
    const resultDiv = document.getElementById('currency-result');
    
    resultDiv.innerHTML = '<div class="loading">🔄 Загрузка курсов ЦБ РФ...</div>';
    
    try {
        const response = await fetch('https://www.cbr-xml-daily.ru/daily_json.js');
        const data = await response.json();
        
        if (!data || !data.Valute) {
            throw new Error('Не удалось получить данные ЦБ');
        }
        
        const currencies = {
            'USD': data.Valute.USD,
            'EUR': data.Valute.EUR,
            'GBP': data.Valute.GBP,
            'JPY': data.Valute.JPY,
            'CNY': data.Valute.CNY,
            'CHF': data.Valute.CHF,
            'TRY': data.Valute.TRY,
            'KZT': data.Valute.KZT
        };
        
        let html = '<div class="currency-list">';
        
        for (const [code, currency] of Object.entries(currencies)) {
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
        
        html += '</div>';
        resultDiv.innerHTML = html;
        
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="error">
                ❌ Ошибка загрузки курсов ЦБ<br>
                <small>${error.message}</small>
            </div>
        `;
    }
}

// ================== ЗАМЕТКИ ==================
function addNote() {
    const noteInput = document.getElementById('note-input');
    const noteText = noteInput.value.trim();
    
    if (noteText) {
        notes.push({
            id: Date.now(),
            text: noteText,
            date: new Date().toLocaleString('ru-RU')
        });
        
        localStorage.setItem('notes', JSON.stringify(notes));
        noteInput.value = '';
        displayNotes();
    }
}

function displayNotes() {
    const notesList = document.getElementById('notes-list');
    
    if (notes.length === 0) {
        notesList.innerHTML = '📝 Заметок пока нет';
        return;
    }
    
    let html = '';
    notes.forEach((note, index) => {
        html += `
            <div class="note-item">
                <span>${note.text}</span>
                <div>
                    <small>${note.date}</small>
                    <button onclick="deleteNote(${index})" style="margin-left:10px; padding:2px 5px;">✕</button>
                </div>
            </div>
        `;
    });
    
    notesList.innerHTML = html;
}

function deleteNote(index) {
    notes.splice(index, 1);
    localStorage.setItem('notes', JSON.stringify(notes));
    displayNotes();
}

// ================== ТАЙМЕР ==================
function startTimer() {
    const minutes = parseInt(document.getElementById('timer-minutes').value);
    
    if (isNaN(minutes) || minutes < 1) {
        alert('Введите корректное количество минут');
        return;
    }
    
    if (activeTimer) {
        clearInterval(activeTimer);
    }
    
    timerPaused = false;
    timeLeft = minutes * 60;
    updateTimerDisplay();
    
    activeTimer = setInterval(() => {
        if (!timerPaused) {
            timeLeft--;
            updateTimerDisplay();
            
            if (timeLeft <= 0) {
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
    if (activeTimer) {
        clearInterval(activeTimer);
    }
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

// ================== DEEPSEEK ЧАТ ==================
async function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    if (!message) return;

    addMessage(message, 'user');
    input.value = '';
    
    // Показываем индикатор загрузки
    const loadingMessage = addMessage('🤖 Думаю...', 'bot');
    
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
                    ...chatHistory,
                    {role: "user", content: message}
                ],
                temperature: 0.7,
                max_tokens: 2000
            })
        });
        
        const data = await response.json();
        
        // Убираем индикатор загрузки
        loadingMessage.remove();
        
        if (data.choices && data.choices[0]) {
            const botResponse = data.choices[0].message.content;
            addMessage(botResponse, 'bot');
            
            // Сохраняем в историю
            chatHistory.push(
                {role: "user", content: message},
                {role: "assistant", content: botResponse}
            );
            
            // Ограничиваем историю последними 10 сообщениями
            if (chatHistory.length > 20) {
                chatHistory = chatHistory.slice(-20);
            }
            
        } else {
            addMessage('❌ Ошибка получения ответа от AI', 'bot');
        }
        
    } catch (error) {
        loadingMessage.remove();
        addMessage('❌ Ошибка подключения к DeepSeek API', 'bot');
        console.error('DeepSeek API error:', error);
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
    // Инициализация математических вкладок
    switchMathTab('calculator');
    
    // Загрузка заметок
    displayNotes();
    
    // Загрузка курсов валют
    getCBRrates();
    
    // Автообновление курсов каждые 5 минут
    setInterval(getCBRrates, 300000);
});
