import { GAME_CONFIG } from '../config.js';

class BattleRecorder {
    constructor() {
        this.isRecording = false;
        
        this.matchData = {
            matchId: null,
            mapSnapshot: null,
            initialEntities: [],
            timeline: []
        };

        this.textConsoleLog = {};
        this.textConsoleLogPlan = {};
        this.updateLogsScroll = false;
    }

    /**
     * ГЛАВНЫЙ ЕДИНЫЙ МЕТОД: Забирает ВСЕ данные из боевой сцены за один вызов
     * @param {CombatScene} scene - Ссылка на текущую активную боевую сцену
     */
    initMatchRecord(scene) {
        this.isRecording = true;
        this.textConsoleLog = {}; // Очищаем объект логов
        
        // Инициализируем раунд 1 пустым массивом
        this.textConsoleLog[1] = [];
        
        // 1. Задаем базовые метаданные матча
        this.matchData = {
            matchId: "match_" + Date.now(),
            settings: {
                cols: GAME_CONFIG.grid.cols,
                rows: GAME_CONFIG.grid.rows
            },
            mapSnapshot: null,
            initialEntities: [],
            timeline: []
        };

        // 2. АВТОМАТИЧЕСКИЙ СНИМОК КАРТЫ: забираем землю и статические объекты (стены, деревья)
        if (scene.grid) {
            this.matchData.mapSnapshot = {
                tiles: scene.grid.hexes.map(h => ({ q: h.q, r: h.r, texture: h.texture })),
                objects: scene.objectmap.objects.map(obj => ({
                    type: obj.type, q: obj.q, r: obj.r, texture: obj.texture,
                    rotationAngle: obj.rotationAngle || 0,
                    hp: obj.hp, maxHp: obj.maxHp
                }))
            };
        }

        // 3. АВТОМАТИЧЕСКИЙ СНИМОК ЮНИТОВ: собираем всех заспавненных персонажей из глобального окна window
        if (window.entities) {
            window.entities.forEach(entity => {
                // Если у персонажа еще нет ID — генерируем его прямо тут
                if (!entity.id) {
                    entity.id = `${entity.type}_${Math.random().toString(36).substr(2, 5)}`;
                }

                this.matchData.initialEntities.push({
                    id: entity.id,
                    type: entity.type,
                    q: entity.q,
                    r: entity.r,
                    hp: entity.hp,
                    maxHp: entity.maxHp
                });
            });
        }

        // Выводим первое текстовое сообщение на Canvas-консоль
        this.addTextMessage("Начало боя", 'execution', "#ffff00");
        console.log(`[BattleRecorder]: Снимок боя ${this.matchData.matchId} успешно сохранен в лог.`);
    }

    //Текстовые сообщения по ходу раундов добавляются так же
    addTextMessage(text, type, color = '#ffffff'){
        const time = new Date();
        const timestamp = `[${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}]`;
        
        // Защита: если этот раунд еще не создавался в логе, инициализируем его
        if (!this.textConsoleLog[window.roundCount]) {
            this.textConsoleLog[window.roundCount] = [];
        }

        if(type === 'plan') color = '#348aff';

        this.textConsoleLog[window.roundCount].push({
            fullText: `${timestamp} ${text}`,
            text: text,
            color: color,
            type: type
        });

        this.updateLogsScroll = true;
    }

    /**
     * Фиксация технических действий (UNIT_MOVE, UNIT_DAMAGE) в процессе тиков симуляции
     */
    emitTechnicalEvent(type, payload = {}) {
        if (!this.isRecording) return;
        this.matchData.timeline.push({
            tick: this.matchData.timeline.length,
            type: type,
            payload: payload
        });
    }

    stopAndSave() {
        this.isRecording = false;
        this.addTextMessage("--- БОЙ СЕРВЕРОМ ЗАВЕРШЕН ---", 'execution', "#ffff00");
        return JSON.stringify(this.matchData);
    }

    removePlanConsole(){
        this.textConsoleLog[window.roundCount] = this.textConsoleLog[window.roundCount].filter(item => item.type !== 'plan');
    }
}

export const battleRecorder = new BattleRecorder();