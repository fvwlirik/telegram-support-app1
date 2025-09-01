let tg = window.Telegram.WebApp;
let autoUpdateInterval = null;
let lastRates = {};
let notes = JSON.parse(localStorage.getItem('notes')) || [];
let activeTimer = null;

// Инициализация
tg.expand();
tg.enableClosingConfirmation();

function showSection(sectionName) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
    });
    document.getElementById(sectionName + '-section').classList.remove('hidden');
    
    if (sectionName === 'currency') {
        getCBRrates();
    } else if (sectionName === 'notes') {
        displayNotes();
    }
}

// ================== КУРСЫ ЦБ РФ ==================
async function getCBRrates() {
    const resultDiv = document.getElementById('currency-result');
    const infoDiv = document.getElementById('currency-info');
    
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
            'KZT': data.Valute.KZT,
            'UAH': data.Valute.UAH,
            'BYN': data.Valute.BYN
        };
        
        let html = '<div class="currency-list">';
        
        for (const [code, currency] of Object.entries(currencies)) {
            const change = calculateChange(currency.Value, currency.Previous);
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
        
        const updateDate = new Date(data.Date);
        infoDiv.innerHTML = `
            <div style="margin-top: 15px; font-size: 12px; color: #888;">
                📅 Курсы ЦБ РФ на ${updateDate.toLocaleDateString('ru-RU')}<br>
                ⏰ Обновлено: ${updateDate.toLocaleTimeString('ru-RU')}
            </div>
        `;
        
        document.getElementById('last-update').textContent = 
            `Последнее обновление: ${new Date().toLocaleTimeString('ru-RU')}`;
        
        lastRates = currencies;
        
    } catch (error) {
        resultDiv.innerHTML = `
            <div style="color: #f44336;">
                ❌ Ошибка загрузки курсов ЦБ<br>
                <small>${error.message}</small>
            </div>
        `;
    }
}

function calculateChange(current, previous) {
    return current - previous;
}

function startAutoUpdate() {
    if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
    }
    
    autoUpdateInterval = setInterval(() => {
        getCBRrates();
        tg.showPopup({
            title: 'Обновление',
            message: 'Курсы валют обновлены',
            buttons: [{type: 'ok'}]
        });
    }, 60000);
    
    tg.showPopup({
        title: 'Автообновление',
        message: 'Курсы будут обновляться каждые 60 секунд',
        buttons: [{type: 'ok'}]
    });
}

function stopAutoUpdate() {
    if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
        autoUpdateInterval = null;
        tg.showPopup({
            title: 'Автообновление',
            message: 'Автообновление остановлено',
            buttons: [{type: 'ok'}]
        });
    }
}

// ================== МАТЕМАТИКА ==================
async function solveEquation() {
    const equation = document.getElementById('equation-input').value;
    if (!equation) return;

    try {
        // Простое решение уравнений (можно подключить math.js)
        const cleanEquation = equation.replace(/x/g, '*').replace(/\^/g, '**');
        const result = eval(cleanEquation);
        document.getElementById('math-result').innerHTML = 
            `<strong>Результат:</strong><br>${result}`;
    } catch (error) {
        document.getElementById('math-result').innerHTML = 
            `<strong>Ошибка:</strong><br>${error.message}`;
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
            date: new Date().toLocaleString()
        });
        
        localStorage.setItem('notes', JSON.stringify(notes));
        noteInput.value = '';
        displayNotes();
    }
}

function displayNotes() {
    const notesList = document.getElementById('notes-list');
    
    if (notes.length === 0) {
        notesList.innerHTML = 'Заметок пока нет';
        return;
    }
    
    let html = '';
    notes.forEach(note => {
        html += `
            <div class="note-item">
                <span>${note.text}</span>
                <small>${note.date}</small>
            </div>
        `;
    });
    
    notesList.innerHTML = html;
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
    
    const endTime = Date.now() + minutes * 60000;
    const timerDisplay = document.getElementById('timer-display');
    
    activeTimer = setInterval(() => {
        const timeLeft = endTime - Date.now();
        
        if (timeLeft <= 0) {
            clearInterval(activeTimer);
            timerDisplay.innerHTML = '<span class="timer-active">⏰ Время вышло!</span>';
            tg.showPopup({
                title: 'Таймер',
                message: 'Время вышло!',
                buttons: [{type: 'ok'}]
            });
            return;
        }
        
        const minutesLeft = Math.floor(timeLeft / 60000);
        const secondsLeft = Math.floor((timeLeft % 60000) / 1000);
        
        timerDisplay.innerHTML = `
            <span class="timer-active">
                Осталось: ${minutesLeft}:${secondsLeft.toString().padStart(2, '0')}
            </span>
        `;
    }, 1000);
}

// ================== ЧАТ ==================
function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

async function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    if (!message) return;

    addMessage(message, 'user');
    input.value = '';

    // Имитация ответа ИИ
    setTimeout(() => {
        addMessage('Это демо-версия чата. В полной версии будет интегрирован DeepSeek AI', 'bot');
    }, 1000);
}

function addMessage(text, sender) {
    const messagesDiv = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    messageDiv.textContent = text;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    getCBRrates();
    displayNotes();
    
    // Автообновление курсов каждые 5 минут
    setInterval(getCBRrates, 300000);
});