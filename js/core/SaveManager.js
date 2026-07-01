import { battleRecorder } from './BattleRecorder.js';
import { Entity } from '../entities/Entity.js';
import { GAME_CONFIG } from '../config.js';

class SaveManager {
    constructor() {
        this.STORAGE_KEY = 'tz_combat_autosave';
    }

    /**
     * Записывает слепок текущего раунда в LocalStorage
     */
    saveGame() {
        if (!battleRecorder.isRecording) return;
        const dump = JSON.stringify(battleRecorder.matchData);
        localStorage.setItem(this.STORAGE_KEY, dump);
        console.log("[SaveManager]: Автосохранение раунда успешно записано.");
    }

    /**
     * Проверяет наличие сохранения
     */
    hasSave() {
        return localStorage.getItem(this.STORAGE_KEY) !== null;
    }

    /**
     * Очищает LocalStorage (вызывается при конце боя)
     */
    clearSave() {
        localStorage.removeItem(this.STORAGE_KEY);
        console.log("[SaveManager]: Autosave успешно очищен.");
    }

    /**
     * =========================================================================
     * УНИВЕРСАЛЬНЫЙ МЕТОД РЕАНИМАЦИИ БОЯ
     * =========================================================================
     * Этот метод полностью автономен. Он сам восстанавливает карту, спавнит 
     * существ и перематывает хронологию перемещений до текущего раунда.
     * @param {CombatScene} scene - Ссылка на инициализируемую боевую сцену
     */
    restoreBattle(scene) {
        const rawData = localStorage.getItem(this.STORAGE_KEY);
        if (!rawData) return false;

        try {
            const save = JSON.parse(rawData);
            console.log("[SaveManager]: Реанимирую тактический матч из сейва...", save);

            // 1. Восстанавливаем технический стейт регистратора событий
            battleRecorder.isRecording = true;
            battleRecorder.matchData = save;
            
            // Сбрасываем чат и пишем системную строку восстановления
            battleRecorder.textConsoleLog = {};
            battleRecorder.addTextMessage("--- МАТЧ УСПЕШНО ВОССТАНОВЛЕН ИЗ АВТОСОХРАНЕНИЯ ---", 'execution', "#ffff00");

            // 2. Напрямую восстанавливаем ландшафт и объекты карты по сохраненному снимку
            if (save.mapSnapshot) {
                scene.grid.hexes = save.mapSnapshot.tiles;
                scene.objectmap.objects = save.mapSnapshot.objects;
                scene.nonspawn = save.mapSnapshot.objects.map(o => ({ q: o.q, r: o.r }));
            }

            // 3. Восстанавливаем персонажей на их исходные позиции ПЕРВОГО раунда
            window.entities = [];
            save.initialEntities.forEach(p => {
                const ent = new Entity(p.type, p.q, p.r, scene.grid, scene.nonspawn);
                ent.hp = p.hp;
                ent.maxHp = p.maxHp;
                window.entities.push(ent);
            });
            //scene.grid.entities = window.entities;

            // 4. УСКОРЕННАЯ СИМУЛЯЦИЯ (Промотка истории):
            // Пробегаемся по записанной ленте timeline и мгновенно сдвигаем физические ноги персонажей
            save.timeline.forEach(event => {
                if (event.type === 'UNIT_MOVE') {
                    const entity = window.entities.find(e => e.type === event.payload.unitType);
                    if (entity) {
                        entity.q = event.payload.q;
                        entity.r = event.payload.r;
                        entity.updateScreenCoordinates(); // Меняем пиксели ног
                        
                        // Дублируем информацию в текстовый логгер текущего хода
                        const rNum = event.payload.round || 1;
                        battleRecorder.addTextMessage(
                            `Персонаж [${entity.type}] переместился в сектор ${entity.q},${entity.r}`,
                            'execution',
                            '#00a6ff'
                        );
                    }
                }
            });

            // 5. Вычисляем текущий актуальный номер раунда на основе таймлайна перемещений
            let maxRound = 1;
            save.timeline.forEach(e => { 
                if (e.payload.round && e.payload.round > maxRound) maxRound = e.payload.round; 
            });
            scene.turnManager.roundCount = maxRound;

            // 6. Сбрасываем виртуальные прицелы планирования под новые физические координаты ног
            window.entities.forEach(e => {
                e.resetPlannedPosition();
                e.updatePlannedScreenCoordinates();
            });

            if (scene.ui && scene.ui.consoleUI) {
                scene.ui.consoleUI.viewingRound = Number(window.roundCount);
                scene.ui.consoleUI.scrollOffset = 0;
            }

            if (scene.input) {
                scene.input.hoveredHex = null;
                scene.input._updateGridHighlights();
            }

            console.log(`[SaveManager]: Хронология боя успешно восстановлена на Ход №${scene.turnManager.roundCount}.`);
            return true; // Сигнал для сцены: загрузка прошла успешно!

        } catch (error) {
            console.error("[SaveManager]: Критическая ошибка при разборе JSON автосохранения!", error);
            this.clearSave(); // Стираем битый сейв, чтобы игра не зациклилась в краше
            return false;
        }
    }
}

export const saveManager = new SaveManager();