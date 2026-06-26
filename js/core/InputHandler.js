import { GAME_CONFIG } from '../config.js';
import { battleRecorder } from '../core/BattleRecorder.js';

export class InputHandler {
    /**
     * @param {Game} game - Ссылка на главный оркестратор игры
     */
    constructor(game) {
        this.game = game;
        this.canvas = game.game.canvas; 
        this.hoveredHex = null;
        this.isDraggingCamera = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Теперь привязка событий сработает без ошибок
        this._initEvents(); 
    }

    /**
     * Привязка событий мыши к холсту
     */
    _initEvents() {
        this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
        this.canvas.addEventListener('click', (e) => this._onMouseClick(e));

        window.addEventListener('keydown', (e) => {
            if(e.key === 'Control') this.canvas.style.cursor = 'crosshair';
        });

        window.addEventListener('keyup', (e) => {
            if(e.key === 'Control') this.canvas.style.cursor = 'default';
        });

        // Зажатие кнопки мыши
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 2) { // 2 — это правая кнопка мыши (ПКМ)
                e.preventDefault();
                this.isDraggingCamera = true;
                const rect = this.canvas.getBoundingClientRect();
                this.lastMouseX = e.clientX - rect.left;
                this.lastMouseY = e.clientY - rect.top;
            }
        });

        // Отпускание кнопки мыши
        window.addEventListener('mouseup', (e) => {
            if (e.button === 2) {
                this.isDraggingCamera = false;
            }
        });

        // Блокируем стандартное контекстное меню браузера при клике ПКМ на Canvas
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        this.canvas.addEventListener('wheel', (e) => this._onMouseWheel(e));
    }

    //Обработчик движения мыши
    _onMouseMove(event) {
        if (!event || event.clientX === undefined) return;

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        if (isNaN(mouseX) || isNaN(mouseY)) return;

        // 1. ЛОГИКА ПЕРЕТАСКИВАНИЯ КАМЕРЫ (Зажата ПКМ)
        if (this.isDraggingCamera) {
            const scene = this.game.game.sceneManager.currentScene;
            if (scene) {
                const deltaX = mouseX - this.lastMouseX;
                const deltaY = mouseY - this.lastMouseY;

                if (!isNaN(deltaX) && !isNaN(deltaY)) {
                    scene.cameraX -= deltaX * GAME_CONFIG.canvas.cameraDragSensitivity;
                    scene.cameraY -= deltaY * GAME_CONFIG.canvas.cameraDragSensitivity;

                    this.clampCamera();
                }
            }
            this.lastMouseX = mouseX;
            this.lastMouseY = mouseY;
            return; 
        }

        // 2. ОБЫЧНАЯ ЛОГИКА НАВЕДЕНИЯ НА ГЕКСЫ И КНОПКИ (Когда ПКМ отпущена)
        const scene = this.game.game.sceneManager.currentScene;

        let currentZoom = (scene && scene.zoom && !isNaN(scene.zoom)) ? scene.zoom : 1.0;

        //Проверяем навели ли мы ли курс на интерфейс
        if (scene?.ui) {
            const ui = scene.ui;

            let isHoveringAnyButton = false;
            
            ui.buttons.forEach(btn => {
                const isMouseOverThisButton = btn.isMouseInside(mouseX, mouseY);
                btn.isHovered = isMouseOverThisButton;

                if(isMouseOverThisButton && !btn.checked) isHoveringAnyButton = true;
            });

            if(isHoveringAnyButton) this.canvas.style.cursor = 'pointer';
            else if(event.ctrlKey)  this.canvas.style.cursor = 'crosshair';
            else this.canvas.style.cursor = 'default';

            // Барьер наведения: если мышь над UI, стираем hoveredHex и выходим
            if (ui.isMouseOverUi(mouseX, mouseY)) {
                this.hoveredHex = null;
                this._updateGridHighlights();
                return;
            }
        }
        
        // Переводим пиксели экрана в пиксели игрового мира с учетом текущего сдвига камеры!
        const worldMouseX = (mouseX + (scene ? scene.cameraX : 0)) / currentZoom;
        const worldMouseY = (mouseY + (scene ? scene.cameraY : 0)) / currentZoom;

        if (isNaN(worldMouseX) || isNaN(worldMouseY)) return;

        // А вот гексы карты ищем по мировым координатам
        const closestHex = this.game.grid._getHexUnderMouse(worldMouseX, worldMouseY);
        if (closestHex !== this.hoveredHex) {
            this.hoveredHex = closestHex;
            this._updateGridHighlights();
        }
    }

    //Обработчик клика мыши
    _onMouseClick(event) {
        if (gameState !== 'PLANNING') return;
        if (!event || event.clientX === undefined) return;

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // Проверяем барьер интерфейса
        const currentUi = this.game.game.sceneManager.currentScene?.ui;
        if (currentUi) {
            if (currentUi.isMouseOverUi(mouseX, mouseY)) {
                let clickedOnUiButton = false;
                currentUi.buttons.forEach(btn => {
                    if (btn.isMouseInside(mouseX, mouseY)) {
                        if(!btn.checked) btn.onClick();
                        clickedOnUiButton = true;
                    }
                });

                if (clickedOnUiButton || currentUi.isMouseOverUi(mouseX, mouseY)) return; 
            }
        }

        // Гексы (по мировым координатам с учетом камеры)
        const scene = this.game.game.sceneManager.currentScene;
        let currentZoom = (scene && scene.zoom && !isNaN(scene.zoom)) ? scene.zoom : 1.0;

        const worldMouseX = (mouseX + (scene ? scene.cameraX : 0)) / currentZoom;
        const worldMouseY = (mouseY + (scene ? scene.cameraY : 0)) / currentZoom;

        if (isNaN(worldMouseX) || isNaN(worldMouseY)) return;
        if (!this.hoveredHex) return;

        const entitiesArray = window.entities;
        const player = entitiesArray ? entitiesArray.find(e => e.type === 'player') : null;
        if (!player) return;

        // Стрельба
        const weaponsConfig = GAME_CONFIG.weapons[player.weapon];

        if(window.entities && !event.ctrlKey){
            const clickedUnit = window.entities.find(e => e.type !== 'player' && e.isMouseOverBody(worldMouseX, worldMouseY));

            if(clickedUnit){
                const correctEnemyHex = this.game.grid.hexes.find(h => Number(h.q) === Number(clickedUnit.plannedQ) &&  Number(h.r) === Number(clickedUnit.plannedR));

                if(correctEnemyHex){
                    this.hoveredHex = correctEnemyHex; 
                    if(player.currentAP >= weaponsConfig.apCost){
                        player.actionQueue.addShootAction(clickedUnit.q, clickedUnit.r, weaponsConfig.apCost, clickedUnit.id);

                        if(player.state == 'crawl') player.skin = 'crawl_'+weaponsConfig.category;
                        else player.skin = 'idle_'+weaponsConfig.category;

                        player.lookAt(this.hoveredHex.q, this.hoveredHex.r);

                        battleRecorder.addTextMessage(`Выстрел по цели [${weaponsConfig.apCost}]`, 'plan');          
                        this._updateGridHighlights();
                        return;
                    }
                }
            }
        }else if(window.entities && event.ctrlKey){
            if(player.currentAP >= weaponsConfig.apCost) {
                player.actionQueue.addShootAction(this.hoveredHex.q, this.hoveredHex.r, weaponsConfig.apCost);

                if(player.state == 'crawl') player.skin = 'crawl_'+weaponsConfig.category;
                else player.skin = 'idle_'+weaponsConfig.category;

                player.lookAt(this.hoveredHex.q, this.hoveredHex.r);

                battleRecorder.addTextMessage(`Выстрел в точку ${this.hoveredHex.q},${this.hoveredHex.r} [${weaponsConfig.apCost}]`, 'plan');
                this._updateGridHighlights();
                return;
            }
        }

        // Сравниваем клик с виртуальной конечной точкой, а не с физической
        if (this.hoveredHex.q === player.plannedQ && this.hoveredHex.r === player.plannedR) return;

        // Строим путь от виртуального конца маршрута до мышки
        const smartPath = this.game.grid.findSmartPath(player, this.hoveredHex.q, this.hoveredHex.r);

        const closeHex = this.game.grid.highlights.find(h => h.q === this.hoveredHex.q && h.r === this.hoveredHex.r);

        if(!closeHex){
            console.log("[InputHandler]: Путь заблокирован или не хватает AP!");
            return;
        } 

        let totalApSpent = 0;

        smartPath.forEach((step, index) => {
            const currentStepNumber = player.plannedStepsCount + index + 1;
            const currentStepCost = player.getStepCostAP(currentStepNumber);
            totalApSpent += currentStepCost;
            player.actionQueue.addMoveAction(step.q, step.r, player.state, currentStepCost);
        });

        player.plannedStepsCount += smartPath.length;

        if (smartPath.length === 0) {
            console.log("[InputHandler]: Путь заблокирован или не хватает AP!2");
            return;
        }

        const finalStep = smartPath[smartPath.length - 1];
        battleRecorder.addTextMessage(`Перейти в ${finalStep.q}:${finalStep.r} [${totalApSpent}]`, "plan");

        player.lookAt(this.hoveredHex.q, this.hoveredHex.r);

        // ОБЯЗАТЕЛЬНОЕ ОБНОВЛЕНИЕ: Запоминаем, где виртуально финишировал игрок
        player.plannedQ = this.hoveredHex.q;
        player.plannedR = this.hoveredHex.r;
        player.updatePlannedScreenCoordinates();

        const apElement = document.getElementById('ap-value');
        if(apElement){
            apElement.innerText = `${player.currentAP}/${player.maxAp}`;
        }

        // Сохраняем шаги в plannedPath для синей стабильной отрисовки
        if (!this.game.grid.plannedPath) this.game.grid.plannedPath = [];
        this.game.grid.plannedPath.push(...smartPath);

        this._updateGridHighlights();
    }

    _onMouseWheel(e){
        const scene = this.game.game.sceneManager.currentScene;
        if (!scene || window.gameState !== 'PLANNING') return;

        e.preventDefault();

        const zoomDirection = e.deltaY < 0 ? 1 : -1;
        let nextZoom = scene.zoom + (zoomDirection * GAME_CONFIG.canvas.zoomSensitivity);

        if (isNaN(nextZoom) || nextZoom <= 0) {
            nextZoom = 1.0;
        }

        scene.zoom = Math.max(GAME_CONFIG.canvas.minZoom, Math.min(nextZoom, 1.0));
        
        // =========================================================================
        // ВСТАВЬТЕ ЭТУ СТРОКУ:
        // Принудительно корректируем камеру под НОВЫЙ масштаб прямо в момент скролла!
        // Камера мгновенно сдвинется, не дав пустоте оголиться ни на один кадр.
        // =========================================================================
        this.clampCamera();
        // =========================================================================
        
        this._updateGridHighlights();
    }

    //Синхронизирует подсвеченные зоны с массивом рендеринга в CanvasRenderer
    _updateGridHighlights() {
        // Полностью очищаем массив тактической подсветки перед перерасчетом кадра
        this.game.grid.highlights = [];

        const entitiesArray = window.entities;
        const player = entitiesArray ? entitiesArray.find(e => e.type === 'player') : null;
        
        if (!player || gameState !== 'PLANNING') return;
        if (player.state != 'idle' && player.state != 'run') return;

        // 1. Слой А: Считаем и рисуем зеленую зону доступности на ОСТАТОК AP игрока
        const reachableZone = this.game.grid.getReachableZone(player);

        reachableZone.forEach((cost, key) => {
            const [q, r] = key.split(',').map(Number);
            const hex = this.game.grid.hexes.find(h => h.q === q && h.r === r);
            if(hex){
                this.game.grid.highlights.push({
                    q: hex.q, r: hex.r, x: hex.x, y: hex.y,
                    type: 'moveRange' // Зеленый фон
                });
            }
        });

        // 2. Слой Б: Рисуем ЖЕСТКО ЗАФИКСИРОВАННЫЙ путь, который игрок уже накликал
        if (this.game.grid.plannedPath && this.game.grid.plannedPath.length > 0) {
            this.game.grid.plannedPath.forEach(pos => {
                const hex = this.game.grid.hexes.find(h => h.q === pos.q && h.r === pos.r);
                if (hex) {
                    this.game.grid.highlights.push({
                        q: hex.q, r: hex.r, x: hex.x, y: hex.y,
                        type: 'path' // Синий стабильный фон
                    });
                }
            });
        }

        // 3. Слой В: Призрачное превью пути при наведении мыши (золотые гексы)
        if (this.hoveredHex) {
            const hoverKey = `${this.hoveredHex.q},${this.hoveredHex.r}`;

            // Строим призрачную змейку пути от текущего положения игрока до мышки
            const previewPath = this.game.grid.findSmartPath(player, this.hoveredHex.q, this.hoveredHex.r);

            let totalPathCost = 0;
            previewPath.forEach((pos, index) => {
                // Вычисляем порядковый номер шага с учетом уже накликанных ранее шагов
                const currentStepNumber = player.plannedStepsCount + index + 1;
                totalPathCost += player.getStepCostAP(currentStepNumber);
            });
            
            // Рисуем превью, только если мышка находится внутри зеленой зоны
            if (reachableZone.has(hoverKey)) {
                previewPath.forEach(pos => {
                    const pathHex = this.game.grid.hexes.find(h => h.q === pos.q && h.r === pos.r);
                    if (pathHex) {
                        // Перекрашиваем только те гексы превью, которые еще не были зафиксированы кликом
                        const isAlreadyPlanned = this.game.grid.plannedPath.some(p => p.q === pos.q && p.r === pos.r);
                        
                        if (!isAlreadyPlanned) {
                            this.game.grid.highlights.push({
                                q: pathHex.q, r: pathHex.r, x: pathHex.x, y: pathHex.y,
                                type: 'selected' // Золотистый призрачный след превью
                            });
                        }
                    }
                });

                // Золотая рамка строго под курсором мыши
                this.game.grid.highlights.push({
                    q: this.hoveredHex.q, r: this.hoveredHex.r, x: this.hoveredHex.x, y: this.hoveredHex.y,
                    type: 'hover',
                    apCost: totalPathCost
                });
            }
        }
    }

    //УНИВЕРСАЛЬНЫЙ ОГРАНИЧИТЕЛЬ: Не дает камере выйти за рамки карты с учетом текущего зума
    clampCamera() {
        const scene = this.game.game.sceneManager.currentScene;
        if (!scene) return;

        let maxX = 0;
        let maxY = 0;

        // Находим самые дальние физические пиксели правого и нижнего края карты
        if (this.game.grid && this.game.grid.hexes) {
            this.game.grid.hexes.forEach(hex => {
                if (hex.x > maxX) maxX = hex.x;
                if (hex.y > maxY) maxY = hex.y;
            });
        }

        const paddingX = GAME_CONFIG.grid.radius * Math.sqrt(3) * 0.5;
        const paddingY = GAME_CONFIG.grid.radius * GAME_CONFIG.grid.isoYScale;

        const maxWorldX = maxX + paddingX;
        const maxWorldY = maxY + paddingY;
        const margin = GAME_CONFIG.canvas.cameraMargin;
        const currentZoom = scene.zoom || 1.0;

        // Корректируем координаты камеры прямо сейчас
        scene.cameraX = Math.max(-margin, Math.min(scene.cameraX, (maxWorldX * currentZoom) - this.canvas.width + margin));
        scene.cameraY = Math.max(-margin, Math.min(scene.cameraY, (maxWorldY * currentZoom) - this.canvas.height + margin));
    }
}