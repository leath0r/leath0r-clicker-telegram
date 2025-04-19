// ===== ИНИЦИАЛИЗАЦИЯ TELEGRAM =====
const tgWebApp = window.Telegram.WebApp;
const isTelegram = !!tgWebApp.initDataUnsafe;

if (isTelegram) {
    tgWebApp.expand();
    tgWebApp.enableClosingConfirmation();
    tgWebApp.MainButton.setText('Сохранить').onClick(saveGame).show();
}

// ===== РЕЖИМ РАЗРАБОТЧИКА =====
const DEV_CLICK_POWER = 1999999999;
let devMode = false;

// Активация по 10 кликам на заголовок
let headerClickCount = 0;
let lastClickTime = 0;

function setupDevModeActivation() {
    const header = document.querySelector('.header');
    header.addEventListener('click', (e) => {
        const now = Date.now();
        if (now - lastClickTime > 1000) headerClickCount = 0;
        
        headerClickCount++;
        lastClickTime = now;
        
        if (headerClickCount >= 10) {
            toggleDevMode();
            headerClickCount = 0;
        }
    });
}

function toggleDevMode() {
    devMode = !devMode;
    
    if (devMode) {
        gameState.clickPower = DEV_CLICK_POWER;
        showNotification('DEV MODE: Активирован режим разработчика!');
        console.log('Режим разработчика активирован');
        
        // Добавляем индикатор
        const devIndicator = document.createElement('div');
        devIndicator.id = 'dev-indicator';
        devIndicator.style.position = 'fixed';
        devIndicator.style.bottom = '10px';
        devIndicator.style.right = '10px';
        devIndicator.style.backgroundColor = 'red';
        devIndicator.style.color = 'white';
        devIndicator.style.padding = '5px 10px';
        devIndicator.style.borderRadius = '5px';
        devIndicator.style.zIndex = '9999';
        devIndicator.textContent = 'DEV MODE';
        document.body.appendChild(devIndicator);
    } else {
        gameState.clickPower = 1 + gameState.prestigeLevel;
        showNotification('DEV MODE: Деактивирован');
        const indicator = document.getElementById('dev-indicator');
        if (indicator) indicator.remove();
    }
    
    updateUI();
}

// ===== СОСТОЯНИЕ ИГРЫ =====
const gameState = {
    balance: 0,
    clickPower: 1,
    autoPower: 0,
    multiPower: 1.0,
    prices: { click: 100, auto: 400, multi: 240 },
    prestigeLevel: 0,
    prestigePrices: [1000, 5000, 10000, 15000],
    totalClicks: 0,
    achievements: {
        firstClick: false,
        auto5: false,
        multi5: false,
        million: false,
        veteran: false
    },
    critChance: 0.05,
    critMultiplier: 3,
    comboCounter: 0,
    lastClickTime: 0
};

// ===== СИСТЕМА СОХРАНЕНИЙ =====
function saveGame() {
    showProgressBar();
    
    if (isTelegram) {
        tgWebApp.CloudStorage.setItem('game_save', JSON.stringify(gameState), (err) => {
            showNotification(err ? 'Ошибка сохранения!' : 'Сохранено в Telegram Cloud!');
        });
    } else {
        localStorage.setItem('leath0r_clicker_save', JSON.stringify(gameState));
        showNotification('Сохранено локально!');
    }
}

function loadGame() {
    if (isTelegram) {
        tgWebApp.CloudStorage.getItem('game_save', (err, data) => {
            if (data) {
                try {
                    const saved = JSON.parse(data);
                    Object.assign(gameState, saved);
                    showNotification('Загружено из Telegram Cloud!');
                } catch (e) {
                    console.error('Ошибка загрузки:', e);
                }
            }
            updateUI();
        });
    } else {
        const saved = localStorage.getItem('leath0r_clicker_save');
        if (saved) {
            try {
                Object.assign(gameState, JSON.parse(saved));
            } catch (e) {
                console.error('Ошибка загрузки:', e);
            }
        }
        updateUI();
    }
}

function exportSave() {
    const data = JSON.stringify(gameState);
    const blob = new Blob([data], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `leath0r_clicker_save_${new Date().toISOString()}.json`;
    a.click();
    
    showNotification('Сохранение экспортировано!');
}

function importSave(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            Object.assign(gameState, data);
            saveGame();
            updateUI();
            showNotification('Сохранение загружено!');
        } catch (e) {
            showNotification('Ошибка: неверный формат файла!');
        }
    };
    reader.readAsText(file);
}

// ===== ИГРОВАЯ ЛОГИКА =====
function updateUI() {
    document.getElementById('balance').textContent = formatNumber(gameState.balance);
    document.getElementById('clickLevel').textContent = gameState.clickPower;
    document.getElementById('clickPower').textContent = gameState.clickPower;
    document.getElementById('clickPrice').textContent = formatNumber(gameState.prices.click);
    document.getElementById('autoLevel').textContent = gameState.autoPower;
    document.getElementById('autoPower').textContent = gameState.autoPower;
    document.getElementById('autoPrice').textContent = formatNumber(gameState.prices.auto);
    document.getElementById('multiLevel').textContent = gameState.multiPower.toFixed(1);
    document.getElementById('multiPower').textContent = gameState.multiPower.toFixed(1);
    document.getElementById('multiPrice').textContent = formatNumber(gameState.prices.multi);
    document.getElementById('prestigeLevel').textContent = gameState.prestigeLevel;
    document.getElementById('prestigeBonus').textContent = gameState.prestigeLevel * 20;
    document.getElementById('prestigeCost').textContent = formatNumber(gameState.prestigePrices[gameState.prestigeLevel] || 15000);
    
    checkAchievements();
}

function formatNumber(num) {
    if (document.getElementById('numberFormat').value === 'short') {
        if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    }
    return Math.floor(num).toLocaleString();
}

function handleClick(e) {
    // Эффекты
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left + rect.width / 2;
    const y = e.clientY - rect.top + rect.height / 2;
    createParticles(x, y);
    
    // Вибрация (если доступно)
    if (navigator.vibrate) navigator.vibrate(50);
    
    // Комбо система
    const now = Date.now();
    if (now - gameState.lastClickTime < 1000) {
        gameState.comboCounter++;
        showCombo(x, y);
    } else {
        gameState.comboCounter = 1;
    }
    gameState.lastClickTime = now;
    
    // Критический удар
    let isCrit = Math.random() < gameState.critChance;
    let damage = gameState.clickPower * gameState.multiPower;
    
    if (isCrit) {
        damage *= gameState.critMultiplier;
        showCritEffect(x, y);
    }
    
    // Бонус комбо
    damage *= (1 + gameState.comboCounter * 0.1);
    
    gameState.balance += damage;
    gameState.totalClicks++;
    
    updateUI();
}

function buyUpgrade(type) {
    if (gameState.balance >= gameState.prices[type]) {
        gameState.balance -= gameState.prices[type];
        
        switch(type) {
            case 'click':
                gameState.clickPower++;
                gameState.prices.click = Math.floor(gameState.prices.click * 1.5);
                break;
            case 'auto':
                gameState.autoPower++;
                gameState.prices.auto = Math.floor(gameState.prices.auto * 2);
                break;
            case 'multi':
                gameState.multiPower += 0.2;
                gameState.prices.multi = Math.floor(gameState.prices.multi * 1.8);
                break;
        }
        
        updateUI();
        saveGame();
    }
}

function prestige() {
    const cost = gameState.prestigePrices[gameState.prestigeLevel] || 15000;
    if (gameState.balance >= cost) {
        gameState.balance = 0;
        gameState.prestigeLevel++;
        gameState.clickPower = 1 + gameState.prestigeLevel;
        gameState.autoPower = 0;
        gameState.multiPower = 1.0;
        gameState.prices.click = 100;
        gameState.prices.auto = 400;
        gameState.prices.multi = 240;
        gameState.totalClicks = 0;
        gameState.comboCounter = 0;
        
        updateUI();
        saveGame();
    }
}

// ===== ВИЗУАЛЬНЫЕ ЭФФЕКТЫ =====
function createParticles(x, y) {
    for (let i = 0; i < 8; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        const size = Math.random() * 10 + 5;
        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * 100 + 50;
        
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        particle.style.setProperty('--tx', `${Math.cos(angle) * velocity}px`);
        particle.style.setProperty('--ty', `${Math.sin(angle) * velocity}px`);

        document.body.appendChild(particle);
        setTimeout(() => particle.remove(), 1000);
    }
}

function showCombo(x, y) {
    const combo = document.createElement('div');
    combo.className = 'combo-pop';
    combo.textContent = `x${gameState.comboCounter} COMBO!`;
    combo.style.left = `${x}px`;
    combo.style.top = `${y}px`;
    document.body.appendChild(combo);
    setTimeout(() => combo.remove(), 500);
}

function showCritEffect(x, y) {
    const crit = document.createElement('div');
    crit.className = 'crit-effect';
    crit.textContent = `CRIT x${gameState.critMultiplier}!`;
    crit.style.left = `${x}px`;
    crit.style.top = `${y}px`;
    document.body.appendChild(crit);
    setTimeout(() => crit.remove(), 700);
}

function showNotification(text) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = text;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function showProgressBar() {
    const bar = document.getElementById('saveProgress');
    bar.style.width = '100%';
    setTimeout(() => {
        bar.style.width = '0%';
        bar.style.transition = 'none';
        setTimeout(() => {
            bar.style.transition = 'width 0.3s';
        }, 50);
    }, 1000);
}

// ===== ДОСТИЖЕНИЯ =====
function checkAchievements() {
    // Первый клик
    if (gameState.totalClicks >= 1 && !gameState.achievements.firstClick) {
        gameState.achievements.firstClick = true;
        unlockAchievement('achieve1', 100);
    }
    
    // 5 автокликеров
    if (gameState.autoPower >= 5 && !gameState.achievements.auto5) {
        gameState.achievements.auto5 = true;
        unlockAchievement('achieve2', 500);
    }
    
    // Множитель x5
    if (gameState.multiPower >= 5 && !gameState.achievements.multi5) {
        gameState.achievements.multi5 = true;
        unlockAchievement('achieve3', 1000);
    }
    
    // 1 миллион
    if (gameState.balance >= 1000000 && !gameState.achievements.million) {
        gameState.achievements.million = true;
        unlockAchievement('achieve4', 5000);
    }
    
    // 1000 кликов
    if (gameState.totalClicks >= 1000 && !gameState.achievements.veteran) {
        gameState.achievements.veteran = true;
        unlockAchievement('achieve5', 2000);
    }
}

function unlockAchievement(id, reward) {
    const element = document.getElementById(id);
    element.classList.add('unlocked');
    element.querySelector('.achievement-badge').textContent = '🔓 Разблокировано';
    
    gameState.balance += reward;
    showNotification(`Достижение получено! +$${reward}`);
}

// ===== ОБРАБОТЧИКИ СОБЫТИЙ =====
document.getElementById('clickBtn').addEventListener('click', handleClick);
document.getElementById('clickUpgrade').addEventListener('click', () => buyUpgrade('click'));
document.getElementById('autoUpgrade').addEventListener('click', () => buyUpgrade('auto'));
document.getElementById('multiUpgrade').addEventListener('click', () => buyUpgrade('multi'));
document.getElementById('prestigeButton').addEventListener('click', prestige);
document.getElementById('resetButton').addEventListener('click', () => {
    if (confirm('Сбросить весь прогресс?')) {
        localStorage.removeItem('leath0r_clicker_save');
        location.reload();
    }
});
document.getElementById('exportBtn').addEventListener('click', exportSave);
document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
});
document.getElementById('importFile').addEventListener('change', (e) => {
    if (e.target.files[0]) importSave(e.target.files[0]);
});

// Переключение вкладок
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn, .tab-content').forEach(el => {
            el.classList.remove('active');
        });
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

// Параллакс эффект
document.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 20;
    const y = (e.clientY / window.innerHeight - 0.5) * 10;
    document.querySelector('.parallax-bg').style.transform = 
        `translate(${x}px, ${y}px) translateZ(-1px) scale(2)`;
});

// ===== ИНИЦИАЛИЗАЦИЯ ИГРЫ =====
setupDevModeActivation(); // Активируем обработчик кликов для режима разработчика
loadGame();

// Автосохранение каждые 30 сек
setInterval(saveGame, 30000);

// Автозаработок каждую секунду
setInterval(() => {
    gameState.balance += gameState.autoPower * gameState.multiPower;
    updateUI();
}, 1000);
