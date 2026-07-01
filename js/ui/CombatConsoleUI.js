import { UiButton } from './UiButton.js';
import { battleRecorder } from '../core/BattleRecorder.js';

export class CombatConsoleUI {
    /**
     * @param {CombatScene} scene - Ссылка на текущую боевую сцену
     */
    constructor(scene) {
        this.scene = scene;

        // Настройки размеров окна
        this.width = 380;
        this.height = 160; // Немного уменьшили высоту для компактности
        this.x = 15;
        
        // ИСПРАВЛЕНИЕ 1: Прижимаем окно строго к самому низу экрана Canvas (с зазором 20px)
        this.y = scene.game.canvas.height - this.height - 80; 

        // Высота окна в свернутом состоянии
        this.collapsedHeight = 35;
        this.isCollapsed = false;

        // Какой раунд мы сейчас просматриваем в консоли (всегда число)
        this.viewingRound = 1;

        this.scrollOffset = 0; 
        this.maxLines = 6; // Сколько строк одновременно влезает в окно

        // Локальные кнопки управления логом
        this.buttons = [];
        this._initButtons();
    }

    /**
     * Создание кнопок навигации консоли боя
     */
    _initButtons() {
        // Рассчитываем Y-координату для кнопок в верхней шапке панели
        const btnY = this.y + 7; 

        this.buttons = [
            // Кнопка НАЗАД (Перемотка раундов)
            new UiButton({
                id: 'log-prev-btn',
                text: '<<',
                x: this.x + 110, y: btnY, width: 35, height: 20,
                onClick: () => {
                    // Принудительно приводим к числу и уменьшаем раунд
                    let currentView = Number(this.viewingRound);
                    if (currentView > 1) {
                        this.viewingRound = currentView - 1;
                        console.log(`[CombatConsoleUI]: Переключено назад на ход №${this.viewingRound}`);
                    }
                }
            }),
            // Кнопка ВПЕРЕД (Перемотка раундов)
            new UiButton({
                id: 'log-next-btn',
                text: '>>',
                x: this.x + 235, y: btnY, width: 35, height: 20,
                onClick: () => {
                    // Узнаем текущий актуальный раунд из TurnManager боевой сцены
                    // Делаем безопасную проверку через опциональную цепочку
                    const maxRound = this.scene.turnManager ? Number(window.roundCount) : 1;
                    let currentView = Number(this.viewingRound);

                    if (currentView < maxRound) {
                        this.viewingRound = currentView + 1;
                        console.log(`[CombatConsoleUI]: Переключено вперед на ход №${this.viewingRound}`);
                    }
                }
            }),
            // Кнопка СВЕРНУТЬ / РАЗВЕРНУТЬ
            new UiButton({
                id: 'log-toggle-btn',
                text: '<',
                x: this.x + 10, 
                y: this.y + this.height - 27, // Изначально внизу развернутого окна
                width: 20, height: 20,
                onClick: () => {
                    this.isCollapsed = !this.isCollapsed;
                    this._updateLayout();
                }
            }),
            new UiButton({
                id: 'log-scroll-up-btn',
                text: '▲', // Символ стрелочки вверх
                x: this.x + this.width - 40, y: this.y + 42, width: 20, height: 20,
                onClick: () => {
                    if (this.scrollOffset > 0) {
                        this.scrollOffset--;
                    }
                }
            }),
            new UiButton({
                id: 'log-scroll-down-btn',
                text: '▼', // Символ стрелочки вниз
                x: this.x + this.width - 40, y: this.y + this.height - 47, width: 20, height: 20,
                onClick: () => {
                    const roundKey = String(this.viewingRound);
                    const roundLogs = battleRecorder.textConsoleLog[roundKey] || [];
                    const maxScroll = Math.max(0, roundLogs.length - this.maxLines);
                    
                    if (this.scrollOffset < maxScroll) {
                        this.scrollOffset++;
                    }
                }
            })
        ];
    }

    /**
     * Пересчитывает координаты кнопок и позицию окна при сворачивании
     */
    _updateLayout() {
        const toggleBtn = this.buttons.find(b => b.id === 'log-toggle-btn');
        if (!toggleBtn) return;

        if (this.isCollapsed) {
            toggleBtn.x = this.x + 10;
            toggleBtn.y = this.scene.game.canvas.height - 47;
            toggleBtn.text = '>';
        } else {
            // Если развернули — возвращаем окно на исходную высоту
            this.y = this.scene.game.canvas.height - this.height - 20;
            
            // Возвращаем кнопку сворачивания в левый нижний угол панели
            toggleBtn.y = this.y + this.height - 27;
            toggleBtn.text = '<';

            // Возвращаем кнопки стрелочек вверх
            this.buttons.forEach(btn => {
                if (btn.id !== 'log-toggle-btn') btn.y = this.y + 7;
                if (btn.id === 'log-scroll-up-btn') { btn.x = this.x + this.width - 40; btn.y = this.y + 42; }
                if (btn.id === 'log-scroll-down-btn') { btn.x = this.x + this.width - 40; btn.y = this.y + this.height - 47; }
            });
        }
    }

    //Отрисовка интерфейса панели логов
    draw(ctx) {
        // 1. Если консоль полностью свернута, рисуем только одинокую кнопку LOG и выходим
        if (this.isCollapsed) {
            const toggleBtn = this.buttons.find(b => b.id === 'log-toggle-btn');
            if (toggleBtn) {
                toggleBtn.draw(ctx);
            }
            return; // Завершаем метод досрочно
        }

        const roundKey = String(this.viewingRound);
        const roundLogs = battleRecorder.textConsoleLog[roundKey] || [];

        if(battleRecorder.updateLogsScroll === true){
            const maxScroll = Math.max(0, roundLogs.length - this.maxLines);
            this.scrollOffset = maxScroll;
            battleRecorder.updateLogsScroll = false;
        }

        ctx.save();
        const radius = 20;

        // 2. Геометрия полупрозрачного скругленного окна развернутого размера (this.height)
        ctx.beginPath();
        ctx.moveTo(this.x + radius, this.y);
        ctx.lineTo(this.x + this.width - radius, this.y);
        ctx.quadraticCurveTo(this.x + this.width, this.y, this.x + this.width, this.y + radius);
        
        ctx.lineTo(this.x + this.width, this.y + this.height - radius);
        ctx.quadraticCurveTo(this.x + this.width, this.y + this.height, this.x + this.width - radius, this.y + this.height);
        
        ctx.lineTo(this.x + radius, this.y + this.height);
        ctx.quadraticCurveTo(this.x, this.y + this.height, this.x, this.y + this.height - radius);
        ctx.lineTo(this.x, this.y + radius);
        ctx.quadraticCurveTo(this.x, this.y, this.x + radius, this.y);
        ctx.closePath();

        // Заливаем темный фон
        ctx.fillStyle = 'rgba(20, 20, 20, 0.85)';
        ctx.fill();

        // Очерчиваем рамку в стиле TimeZero
        ctx.strokeStyle = '#4a4a45';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 3. Выводим номер текущего раунда
        ctx.font = 'bold 11px Tahoma, Arial';
        ctx.fillStyle = '#8a8a85';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(` Ход №${this.viewingRound} `, this.x + this.width / 2, this.y + 17);

        // 4. Выводим строки текста с учетом скролла
        ctx.font = '12px Courier New, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        const startTextX = this.x + 15;
        const startTextY = this.y + 42;
        const lineHeight = 16;

        

        if (roundLogs.length === 0) {
            ctx.fillStyle = '#6a6a65';
            ctx.fillText("[Нет записей для этого хода]", startTextX, startTextY);
        } else {
            // Нарезаем массив строк от текущего scrollOffset до лимита в 6 строк
            const slicedLogs = roundLogs.slice(this.scrollOffset, this.scrollOffset + this.maxLines);
            
            slicedLogs.forEach((logEntry, index) => {
                ctx.fillStyle = logEntry.color;
                ctx.fillText(logEntry.fullText, startTextX, startTextY + (index * lineHeight));
            });
        }

        ctx.restore();

        // 5. Отрисовываем все кнопки управления панели
        this.buttons.forEach(btn => btn.draw(ctx));
    }
}