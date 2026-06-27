import { textureManager } from '../render/TextureManager.js';
import { GAME_CONFIG } from '../config.js';
import { ActionQueue } from './ActionQueue.js'; // Создадим следующим шагом

export class Entity {
    /**
     * @param {string} type - 'player' или 'mutant' (должно совпадать с ключами в GAME_CONFIG)
     * @param {number} q, r - Стартовые осевые координаты гекса (odd-r)
     * @param {object} grid - Ссылка на объект карты HexGrid
     */
    constructor(type, q, r, grid, name) {
        this.type = type;
        this.id = `${this.type}_${Math.random().toString(36).substr(2, 5)}`;
        this.q = q;
        this.r = r;
        this.grid = grid;
        this.plannedQ = q; // Планируемая конечная координата Q после всех кликов
        this.plannedR = r; // Планируемая конечная координата R после всех кликов

        // 1. Загружаем балансные характеристики юнита из config.js
        const stats = GAME_CONFIG.entities[type];
        this.hp = stats.maxHp;
        this.maxHp = stats.maxHp;
        this.maxAp = stats.maxAp;
        this.currentAP = stats.maxAp; // Доступные Очки Действия в текущем ходу
        this.MoveAP = stats.CostAP;
        this.stamina = stats.stamina;
        this.maxStamina = stats.stamina;
        this.mana = stats.mana;
        this.maxMana = stats.mana;
        this.name = name;
        this.lvl = 15;
        this.weapons = stats.weapons;
        this.weapon = 'lasergun';

        // Изометрические константы
        this.isoYScale = GAME_CONFIG.grid.isoYScale;

        // 2. Рассчитываем точные экранные пиксели на основе гекса карты
        this.x = 0;
        this.y = 0;
        this.updateScreenCoordinates();
        this.findSafeSpawn();

        // 3. Настройки направления и состояний
        // 0: Право, 1: Юго-право, 2: Юго-лево, 3: Лево, 4: Северо-лево, 5: Северо-право
        this.directionIndex = 0; // По умолчанию смотрим на право (E)
        this.state = 'idle';     // 'idle' (покой) или 'walk' (бег/ходьба)
        this.skin = 'idle';

        // Карта суффиксов для автоматической склейки текстур и флага зеркалирования
        this.directionMap = {
            0: { suffix: 'E',  mirror: false },
            1: { suffix: 'SE', mirror: false },
            2: { suffix: 'SE', mirror: true  }, // Исполняет роль Юго-Лева через зеркало
            3: { suffix: 'E',  mirror: true  }, // Исполняет роль Лева через зеркало
            4: { suffix: 'NE', mirror: true  }, // Исполняет роль Северо-Лева через зеркало
            5: { suffix: 'NE', mirror: false }
        };

        // 4. Инициализируем персональную очередь приказов тактического хода
        this.actionQueue = new ActionQueue(this);

        // 5. Переменные покадровой анимации (spritesheets)
        this.currentFrame = 0;
        this.frameTimer = 0;
        this.frameSpeed = stats.frameSpeed; // Скорость анимации

        this.resetPlannedPosition();

        this.startTurnQ = q; // Физическая точка старта, откуда юнит начнет бег в фазе EXECUTION
        this.startTurnR = r;
        this.startstate = 'idle';
        this.startskin = 'idle';
        this.plannedStepsCount = 0; //Утомляемость
        this.startRoundAP = this.maxAp;
        this.animation = false;
    }

    /**
     * Синхронизирует пиксельные координаты (x,y) с текущим гексом сетки (q,r)
     */
    updateScreenCoordinates(){
        const currentHex = this.grid.hexes.find(h => h.q === this.q && h.r === this.r);
        if (currentHex){
            this.x = currentHex.x;
            this.y = currentHex.y;
        }
    }

    //Проверяем не занято ли место спавна и если что меняем координаты
    updateSpawn(){
        const spawn = this.grid.nonspawn.find(h => h.q === this.q && h.r === this.r);
        if(spawn){
            this.x = currentHex.x;
            this.y = currentHex.y;
        }
    }

    //Поворачивает персонажа лицом к целевому гексу
    lookAt(targetQ, targetR) {
        // 1. Находим целевой гекс, куда мы кликнули
        const targetHex = this.grid.hexes.find(h => 
            Number(h.q) === Number(targetQ) && 
            Number(h.r) === Number(targetR)
        );

        if (!targetHex) return;

        // ИСПРАВЛЕНИЕ ДЛЯ ФАЗЫ ПЛАНИРОВАНИЯ:
        // Вычисляем, от какой точки считать угол. 
        // Если идет планирование — берем пиксели предыдущего виртуального гекса (plannedQ/R).
        // Если идет симуляция (EXECUTION) — берем текущие физические пиксели ног (this.x/y).
        let fromX = this.x;
        let fromY = this.y;

        if (gameState === 'PLANNING') {
            const currentPlannedHex = this.grid.hexes.find(h => 
                Number(h.q) === Number(this.plannedQ) && 
                Number(h.r) === Number(this.plannedR)
            );
            if (currentPlannedHex) {
                fromX = currentPlannedHex.x;
                fromY = currentPlannedHex.y;
            }
        }

        // 2. Считаем дельту в пикселях от правильной точки старта вектора
        const dx = targetHex.x - fromX;
        const dy = (targetHex.y - fromY) / this.isoYScale; // Убираем изометрическое сжатие для честного угла

        // Если точки совпадают, разворот не нужен
        if (dx === 0 && dy === 0) return;

        // 3. Расчет угла в радианах (от 0 до 2*Math.PI)
        let angle = Math.atan2(dy, dx);
        if (angle < 0) {
            angle += Math.PI * 2;
        }

        // Сдвигаем секторы на 15 градусов вперед для центрирования оси Востока (E)
        let shiftedAngle = angle + (Math.PI / 12);
        if (shiftedAngle >= Math.PI * 2) {
            shiftedAngle -= Math.PI * 2;
        }

        // Находим индекс направления (0-5)
        let dirIndex = Math.floor(shiftedAngle / (Math.PI / 3));
        
        // Присваиваем финальный ракурс персонажу
        this.directionIndex = (dirIndex + 6) % 6;
    }


    /**
     * Метод обновления состояния анимации во времени (вызывается каждый кадр из Game.js)
     */
    update() {
        this.frameTimer += 16.6; // Наращиваем таймер анимации

        if (this.frameTimer >= this.frameSpeed && this.animation) {
            this.frameTimer = 0;
            
            if (window.gameState === 'PLANNING' && !this.animation) {
                this.currentFrame = 0; 
                return;
            }
            // =========================================================================

            // Если же идет симуляция И у юнита есть шаги — код идет дальше и крутит кадры ног:
            const textureKey = this._getCurrentTextureKey();
            const asset = textureManager.get(textureKey);

            if(asset.speed !== undefined) this.frameSpeed = asset.speed;
            
            if (asset && asset.totalFrames){
                this.currentFrame++;
                if (this.currentFrame >= asset.totalFrames) {
                    this.currentFrame = 0;
                }
            }
        }
    }

    /**
     * Внутренний хелпер: собирает строковый ключ текстуры на основе состояния и взгляда
     */
    _getCurrentTextureKey() {
        const config = this.directionMap[this.directionIndex] || { suffix: 'SE', mirror: false };
        // Пример сборки: 'player' + '_' + 'idle' + '_' + 'SE' = 'player_idle_SE'
        return `${this.type}_${this.skin}_${config.suffix}`;

    }

    //Проверяем свободно ли место спавна, если нет заменяем спавн поблизости
    findSafeSpawn() {
        const startKey = `${this.q},${this.r}`;
        
        // 1. Собираем статические преграды карты (стены, деревья, камни)
        const nonspawnArray = this.grid.nonspawn || [];
        const blockedSet = new Set(nonspawnArray.map(hex => `${hex.q},${hex.r}`));
        
        // 2. ДОБАВЛЯЕМ ЖИВЫЕ СУЩЕСТВА: Проверяем, кто уже заспавнен на карте до нас
        const entitiesArray = window.entities;
        if (entitiesArray) {
            entitiesArray.forEach(otherEntity => {
                // Если это не мы сами, и объект уже существует в массиве — блокируем его клетку
                if (otherEntity !== this) {
                    blockedSet.add(`${otherEntity.q},${otherEntity.r}`);
                }
            });
        }
        
        // 3. Создаем быстрый Set всех существующих гексов земли на карте для валидации
        const validHexesSet = new Set(this.grid.hexes.map(hex => `${hex.q},${hex.r}`));

        // Если стартовый гекс абсолютно свободен, выходим из метода — спавн безопасен
        if (!blockedSet.has(startKey)) {
            return;
        }

        console.warn(`[Entity]: Точка спавна q:${this.q}, r:${this.r} занята другим юнитом или стеной! Ищу ближайшую свободную...`);

        // 4. Запускаем волновой алгоритм BFS (поиск ближайшей пустой ячейки)
        const queue = [{ q: this.q, r: this.r }];
        const visited = new Set([startKey]);

        while (queue.length > 0) {
            const current = queue.shift();
            const currentKey = `${current.q},${current.r}`;

            // Если нашли клетку, которая есть на карте и никем не занята — это наша новая точка!
            if (validHexesSet.has(currentKey) && !blockedSet.has(currentKey)) {
                this.q = current.q;
                this.r = current.r;

                console.warn(`[Entity]: Новая точка спавна q:${this.q}, r:${this.r}!`);
                
                // Синхронизируем пиксели x, y на экране
                this.updateScreenCoordinates();
                return;
            }

            // Если текущая клетка занята, берем её 6 соседей с учетом системы odd-r
            const neighbors = this.grid.getHexNeighbors(current.q, current.r);

            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.q},${neighbor.r}`;

                if (!visited.has(neighborKey)) {
                    visited.add(neighborKey);
                    queue.push({ q: neighbor.q, r: neighbor.r });
                }
            }
        }

        console.error("[Entity]: На всей карте физически нет свободного места для спавна!");
    }


    //Формула вычисления шагов
    getStepCostAP(stepNumber){
        let cost = 2;
        if(this.state == 'idle' || this.state == 'walk') cost = this.MoveAP.idle;
        if(this.state == 'run') cost = this.MoveAP.run;
        return stepNumber * cost;
    }

    //Сбрасываем все планы
    resetPlannedPosition() {
        this.plannedQ = this.q;
        this.plannedR = this.r;
        this.plannedStepsCount = 0;
        this.startRoundAP = this.currentAP;
        this.updatePlannedScreenCoordinates(); 
    }

    //Сбрасываем все анимации и прочее для хода планирования
    resetPlannedState(){

        const entitiesArray = window.entities;

        if (entitiesArray) {
            entitiesArray.forEach(entity => {
                entity.animation = false;
                entity.startskin = entity.skin;
                entity.startstate = entity.state;
                entity.currentFrame = 0;   
                const config = GAME_CONFIG.entities[entity.type];
                entity.currentAP = config.maxAp || 100;
                entity.startRoundAP = entity.currentAP;
                entity.resetPlannedPosition();
            });
        }
    }

    /**
     * Главный метод визуализации персонажа на Canvas
     */
    draw(ctx, customX, customY) {
        const textureKey = this._getCurrentTextureKey();
        const asset = textureManager.get(textureKey);
        if (!asset) return;

        const directionInfo = this.directionMap[this.directionIndex];
        const isMirrored = directionInfo ? directionInfo.mirror : false;

        const renderX = customX !== undefined ? customX : this.x;
        const renderY = customY !== undefined ? customY : this.y;

        // Считываем размеры кадра
        const frameWidth = asset.frameWidth || asset.width || 64;
        const frameHeight = asset.frameHeight || asset.height || 64;

        // Безопасные коэффициенты Pivot-выравнивания (если в конфиге пусто, ставим центр ног)
        const anchorX = asset.anchorX !== undefined ? asset.anchorX : 0.5;
        const anchorY = asset.anchorY !== undefined ? asset.anchorY : 1.0;

        // ==========================================
        // СЛОЙ 1: Эффект неоновой ауры под ногами
        // ==========================================
        ctx.save();
        ctx.translate(renderX, renderY); 
        ctx.scale(1, this.isoYScale || 0.5); // Сплющиваем ауру под изометрию карты

        const auraRadius = (GAME_CONFIG.grid.radius || 30) * 0.7;
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, auraRadius);
        // Синяя подсветка для игрока, красная — для врага/моба
        const auraColor = this.type === 'player' ? '0, 84, 255' : '255, 30, 30';
        gradient.addColorStop(0, `rgba(${auraColor}, 0.6)`);
        gradient.addColorStop(0.5, `rgba(${auraColor}, 0.25)`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // ==========================================
        // СЛОЙ 2: Покадровая отрисовка спрайта (с Pivot-выравниванием)
        // ==========================================
        ctx.save();
        ctx.translate(renderX, renderY); // Сдвигаем центр холста в ноги персонажа

        if (isMirrored) {
            ctx.scale(-1, 1); // Переворачиваем холст по горизонтали на месте
        }

        if (asset.type === "static") this.currentFrame = 0;

        const totalAssetFrames = asset.totalFrames || 1;
        if(this.currentFrame >= totalAssetFrames){
            this.currentFrame = 0;
        }

        // Рассчитываем многорядную сетку спрайт-листа
        const cols = asset.cols || Infinity;
        const colIndex = this.currentFrame % cols;
        const rowIndex = Math.floor(this.currentFrame / cols);

        const srcX = colIndex * frameWidth;
        const srcY = rowIndex * frameHeight;

        // Магия Pivot-анкоров: выравниваем основание спрайта по коэффициентам
        const drawX = -(frameWidth * anchorX);
        const drawY = -(frameHeight * anchorY);

        // Подставляем правильный HTML-элемент картинки (asset.element или asset.image)
        const imgElement = asset.element || asset.image;

        if (imgElement) {
            ctx.drawImage(
                imgElement,
                srcX, srcY,               // Координаты вырезки кадра на спрайтшите
                frameWidth, frameHeight,
                drawX, drawY,             // Координаты вывода относительно локального нуля ног
                frameWidth, frameHeight
            );
        }
        ctx.restore();

        // ==========================================
        // СЛОЙ 3: Шкала здоровья и Текст (НЕ ЗЕРКАЛИТСЯ)
        // ==========================================
        ctx.save();

        const textX = renderX;
        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Используем frameHeight вместо asset.height, исключая NaN!
        const textY = renderY - (frameHeight * anchorY) - 12;

        ctx.font = '300 11px Tahoma, Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const uiColor = this.type === 'player' ? GAME_CONFIG.colors.textPlayer : GAME_CONFIG.colors.textEnemy;
        const infoText = `${this.name} [${this.lvl}]`;

        // Узнаем длину имени и отрисовываем блок с ником и hp
        const metrics = ctx.measureText(infoText).width + 20;
        
        // Безопасный расчет ширины здоровья (защита от деления на ноль)
        const currentHp = this.hp !== undefined ? this.hp : 100;
        const maximumHp = this.maxHp || 100;
        const healthWidth = (currentHp / maximumHp) * metrics;

        // Рисуем бокс с ником
        ctx.fillStyle = 'rgba(20, 20, 20, 0.7)';
        ctx.fillRect(textX - (metrics / 2), textY - 8, metrics, 20);

        // Рисуем полоску с hp
        ctx.fillStyle = '#cc0000';
        ctx.fillRect(textX - (metrics / 2), textY + 9, healthWidth, 3); 
        
        // Сама надпись
        ctx.fillStyle = uiColor;
        ctx.fillText(infoText, textX, textY + 1);
        ctx.restore();
    }


    updatePlannedScreenCoordinates() {
        const plannedHex = this.grid.hexes.find(h => 
            Number(h.q) === Number(this.plannedQ) && 
            Number(h.r) === Number(this.plannedR)
        );
        if (plannedHex) {
            this.plannedX = plannedHex.x;
            this.plannedY = plannedHex.y;
        } else {
            this.plannedX = this.x;
            this.plannedY = this.y;
        }
    }

    //Проверка на хитбокс
    isMouseOverBody(worldX, worldY) {
        if (this.hp <= 0) return false;

        // ВЫЧИСЛЯЕМ РАЗМЕРЫ ХИТБОКСА (в пикселях мира)
        // Ширина хитбокса — примерно 40 пикселей (по 20 влево и вправо от центра)
        // Высота хитбокса — уходит вверх от ног (this.y) на 60-70 пикселей
        const hitboxWidth = 65;
        const hitboxHeight = 90;

        // В фазе PLANNING мы проверяем хитбокс вокруг его БУДУЩЕЙ точки, 
        // где игрок или ИИ видят призрачный силуэт (plannedX/Y),
        // а в EXECUTION — вокруг реальных бегущих пикселей ног (this.x/y)
        const baseValX = this.x;
        const baseValY = this.y;

        const left = baseValX - (hitboxWidth / 2);
        const right = baseValX + (hitboxWidth / 2);
        const bottom = baseValY;          // Ноги — это нижняя грань хитбокса
        const top = baseValY - hitboxHeight; // Голова — верхняя грань хитбокса

        // Проверяем, входят ли координаты мыши в этот прямоугольник
        return (worldX >= left && worldX <= right && worldY >= top && worldY <= bottom);
    }
}