const express = require('express');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.json());

// Конфигурация игры
const CONFIG = {
    LAWN_ROWS: 3,
    LAWN_COLS: 5,
    SUN_START: 50,
    SUN_PRODUCTION: 25,
    ZOMBIE_HP: 100,
    ZOMBIE_DAMAGE: 10,
    ZOMBIE_SPEED: 2000 // ms per move
};

// Типы растений
const PLANTS = {
    'подсолнух': { name: '🌻 Подсолнух', cost: 50, type: 'sun', production: 25, health: 100 },
    'горох': { name: '🌱 Стреляющий горох', cost: 100, type: 'shooter', damage: 25, health: 150, cooldown: 3000 },
    'орех': { name: '🥜 Орех', cost: 50, type: 'wall', health: 400 },
    'вишня': { name: '💣 Вишня-бомба', cost: 150, type: 'bomb', damage: 200, health: 100 }
};

class ZombieGame {
    constructor() {
        this.reset();
    }

    reset() {
        this.lawn = this.createEmptyLawn();
        this.suns = CONFIG.SUN_START;
        this.zombies = [];
        this.plants = [];
        this.wave = 1;
        this.zombiesKilled = 0;
        this.gameOver = false;
        this.lastSunTime = Date.now();
        this.lastZombieSpawn = Date.now();
        this.sunInterval = setInterval(() => this.produceSuns(), 10000);
        this.gameInterval = setInterval(() => this.updateGame(), 1000);
    }

    createEmptyLawn() {
        return Array(CONFIG.LAWN_ROWS).fill().map(() => 
            Array(CONFIG.LAWN_COLS).fill(null)
        );
    }

    produceSuns() {
        this.suns += CONFIG.SUN_PRODUCTION;
    }

    plant(plantType, row, col) {
        const plant = PLANTS[plantType];
        if (!plant) return { success: false, message: 'Не знаю такое растение' };
        
        if (this.suns < plant.cost) {
            return { success: false, message: `Не хватает солнышек! Нужно ${plant.cost}, а у тебя ${this.suns}` };
        }

        if (row < 0 || row >= CONFIG.LAWN_ROWS || col < 0 || col >= CONFIG.LAWN_COLS) {
            return { success: false, message: 'Неверная позиция! Ряды от 1 до 3, позиции от 1 до 5' };
        }

        if (this.lawn[row][col]) {
            return { success: false, message: 'Здесь уже есть растение!' };
        }

        this.suns -= plant.cost;
        this.lawn[row][col] = {
            ...plant,
            row,
            col,
            lastShot: Date.now()
        };
        this.plants.push(this.lawn[row][col]);

        return { 
            success: true, 
            message: `${plant.name} посажен на ${row+1} ряду, ${col+1} позиции!` 
        };
    }

    spawnZombie() {
        const row = Math.floor(Math.random() * CONFIG.LAWN_ROWS);
        const zombie = {
            type: 'basic',
            row: row,
            col: CONFIG.LAWN_COLS - 1,
            health: CONFIG.ZOMBIE_HP + (this.wave * 20),
            damage: CONFIG.ZOMBIE_DAMAGE,
            lastMove: Date.now()
        };
        this.zombies.push(zombie);
        return zombie;
    }

    updateGame() {
        if (this.gameOver) return;

        // Авто-спавн зомби
        if (Date.now() - this.lastZombieSpawn > 15000 - (this.wave * 1000)) {
            this.spawnZombie();
            this.lastZombieSpawn = Date.now();
        }

        // Движение зомби
        this.zombies.forEach(zombie => {
            if (Date.now() - zombie.lastMove > CONFIG.ZOMBIE_SPEED) {
                // Проверяем, есть ли растение перед зомби
                const plantInFront = this.lawn[zombie.row][zombie.col - 1];
                if (plantInFront && zombie.col > 0) {
                    // Атакуем растение
                    plantInFront.health -= zombie.damage;
                    if (plantInFront.health <= 0) {
                        this.removePlant(plantInFront.row, plantInFront.col);
                    }
                } else if (zombie.col > 0) {
                    // Двигаемся вперед
                    zombie.col--;
                } else {
                    // Зомби дошел до конца - игра окончена
                    this.gameOver = true;
                }
                zombie.lastMove = Date.now();
            }
        });

        // Стрельба растений
        this.plants.forEach(plant => {
            if (plant.type === 'shooter' && Date.now() - plant.lastShot > plant.cooldown) {
                const zombieInRow = this.zombies.find(z => z.row === plant.row && z.col > plant.col);
                if (zombieInRow) {
                    zombieInRow.health -= plant.damage;
                    if (zombieInRow.health <= 0) {
                        this.removeZombie(zombieInRow);
                        this.zombiesKilled++;
                    }
                    plant.lastShot = Date.now();
                }
            }
        });

        // Проверка на новую волну
        if (this.zombies.length === 0 && this.zombiesKilled >= this.wave * 3) {
            this.wave++;
            this.lastZombieSpawn = Date.now();
        }
    }

    removePlant(row, col) {
        this.lawn[row][col] = null;
        this.plants = this.plants.filter(p => !(p.row === row && p.col === col));
    }

    removeZombie(zombie) {
        this.zombies = this.zombies.filter(z => z !== zombie);
    }

    getGameState() {
        const lawnVisual = this.lawn.map(row => 
            row.map(cell => cell ? cell.name.split(' ')[0] : '🟩').join('')
        ).join('\n');

        const zombiesVisual = this.zombies.map(z => 
            `🧟‍♂️ на ряду ${z.row + 1}, позиция ${z.col + 1} (❤️${z.health})`
        ).join('\n');

        return {
            suns: this.suns,
            wave: this.wave,
            zombiesKilled: this.zombiesKilled,
            zombiesCount: this.zombies.length,
            lawn: lawnVisual,
            zombies: zombiesVisual,
            gameOver: this.gameOver
        };
    }

    collectSun() {
        this.suns += CONFIG.SUN_PRODUCTION;
        return CONFIG.SUN_PRODUCTION;
    }

    startWave() {
        for (let i = 0; i < this.wave; i++) {
            this.spawnZombie();
        }
        return `Волна ${this.wave} началась! Появилось ${this.wave} зомби!`;
    }
}

// Глобальная игра (для демо - в реальности нужно хранить по пользователям)
let game = new ZombieGame();

// Обработчик запросов от Алисы
app.post('/alice', (req, res) => {
    const { request, session, state } = req.body;
    const command = request.command.toLowerCase();
    
    let responseText = '';
    let buttons = [];

    // Обработка команд
    if (command.includes('начать') || command.includes('старт') || command.includes('новая игра')) {
        game = new ZombieGame();
        responseText = `🎮 Добро пожаловать в Растения против Зомби! 
        
У тебя ${game.suns} солнышек. Доступные растения:
🌻 Подсолнух - 50 солнышек (производит солнышки)
🌱 Горох - 100 солнышек (стреляет по зомби)
🥜 Орех - 50 солнышек (прочная защита)
💣 Вишня - 150 солнышек (мощный взрыв)

Скажи "посади [растение] на [ряд] ряд [позиция]" или "начать волну"`;
    }
    else if (command.includes('посади')) {
        const plantMatch = command.match(/(подсолнух|горох|орех|вишня)/);
        const rowMatch = command.match(/([123])\s*ряд/);
        const colMatch = command.match(/([12345])\s*позиц/);
        
        if (!plantMatch) {
            responseText = 'Какое растение посадить? Подсолнух, горох, орех или вишня?';
        } else if (!rowMatch || !colMatch) {
            responseText = 'Укажи ряд (1-3) и позицию (1-5). Например: "посади горох на 1 ряд 3 позиция"';
        } else {
            const plantType = plantMatch[1];
            const row = parseInt(rowMatch[1]) - 1;
            const col = parseInt(colMatch[1]) - 1;
            
            const result = game.plant(plantType, row, col);
            responseText = result.message;
        }
    }
    else if (command.includes('собери') || command.includes('солнышк')) {
        const collected = game.collectSun();
        responseText = `Собрано ${collected} солнышек! Теперь у тебя ${game.suns} солнышек.`;
    }
    else if (command.includes('волн')) {
        responseText = game.startWave();
    }
    else if (command.includes('статус') || command.includes('поле')) {
        const state = game.getGameState();
        responseText = `🌞 Солнышки: ${state.suns}
🎯 Волна: ${state.wave}
🧟 Убито зомби: ${state.zombiesKilled}
🧟‍♂️ На поле: ${state.zombiesCount}

Поле:
${state.lawn}

${state.zombies ? 'Зомби:\n' + state.zombies : 'Зомби пока нет'}`;
    }
    else {
        responseText = `Не поняла команду. Доступные команды:
- "посади [растение] на [ряд] ряд [позиция]"
- "собери солнышки" 
- "начать волну"
- "статус" - показать поле
- "новая игра" - начать заново

Сейчас у тебя ${game.suns} солнышек. Волна ${game.wave}.`;
    }

    // Добавляем кнопки для быстрого доступа
    buttons = [
        { title: "🌻 Посадить подсолнух", hide: true },
        { title: "🌱 Посадить горох", hide: true },
        { title: "🎯 Начать волну", hide: true },
        { title: "📊 Статус", hide: true }
    ];

    res.json({
        response: {
            text: responseText,
            tts: responseText.replace(/[🌻🌱🥜💣🧟‍♂️🎮🎯📊]/g, ''),
            buttons: buttons,
            end_session: false
        },
        session_state: {},
        version: "1.0"
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌱 Plants vs Zombies server running on port ${PORT}`);
});
