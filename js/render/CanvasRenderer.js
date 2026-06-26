import { textureManager } from './TextureManager.js';
import { GAME_CONFIG } from '../config.js';
import { Entity } from '../entities/Entity.js';
import { effectRenderer } from './EffectRenderer.js';

export class CanvasRenderer {
    constructor(scene) {
        this.ctx = scene.game.ctx;
        this.scene = scene;

        this.hexRadius = GAME_CONFIG.grid.radius;
        this.isoYScale = GAME_CONFIG.grid.isoYScale;
        this.colors = GAME_CONFIG.colors; 
    }

    /**
     * Главный метод рендеринга кадра, вызываемый из Game.js (requestAnimationFrame)
     */
    render() {
        const scenes = this.scene.game.sceneManager.currentScene;
        const camX = scenes ? scenes.cameraX : 0;
        const camY = scenes ? scenes.cameraY : 0;
        const currentZoom = scenes ? scenes.zoom : 1.0;

        // 1. Очищаем экран перед каждым новым кадром
        this.ctx.clearRect(0, 0, this.scene.game.canvas.width, this.scene.game.canvas.height);

        // --- СЛОЙ 1: Базовая земля (Тайлы грунта/травы) ---
        this._drawGround();

        this._moveCamera(camX, camY, currentZoom);

        //Вспомогательная функция для показана координат
        //this._drawMapCoordinates();

        this._drawNonPlayableShadow();
        
        // --- СЛОЙ 2: Подсветка тактической сетки (Зоны хода, атаки, курсор) ---
        this._drawGridHighlights();

        // --- СЛОЙ 3: Динамическая Y-сортировка (Стены, окна, деревья, персонажи) ---
        this._drawDepthSortedObjects();

        //Эффекты боя
        effectRenderer.renderAndUpdate(this.ctx);

        //this.ctx.restore(); 

        // --- СЛОЙ 4: Интерфейс и текст поверх игрового мира ---
        this._drawOverlayUI(camX, camY, currentZoom);
    }

    //Отрисовка подложки карты (чистая земля)
    _drawGround() {
        const asset = textureManager.get('ground_sand'); // Наша текстура песка/травы
        if (!asset) return;
        
        const scene = this.scene.game.sceneManager.currentScene;
        const camX = scene ? scene.cameraX : 0;
        const camY = scene ? scene.cameraY : 0;

        const pattern = this.ctx.createPattern(asset.element, 'repeat');
        
        this.ctx.save();
        // Магия Canvas: скроллим саму текстуру паттерна вслед за движениями камеры!
        const matrix = new DOMMatrix();
        pattern.setTransform(matrix.translate(-camX, -camY));
        
        this.ctx.fillStyle = pattern;
        // Заливаем абсолютно весь холст Canvas целиком от края до края экрана
        this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
        this.ctx.restore();
    }

    //Сдвиг камеры
    _moveCamera(camX, camY, currentZoom){
        this.ctx.save();
        this.ctx.translate(-camX, -camY);
        this.ctx.scale(currentZoom, currentZoom);
    }

    //Отрисовка тактических слоев (сетка, подсветка радиуса хода, клики)
    _drawGridHighlights() {
        const activeHighlights = this.scene.grid.highlights; 
        if (!activeHighlights || activeHighlights.length === 0) return;

        activeHighlights.forEach(hl => {
            this.ctx.save();

            // 1. СЛОЙ ЗАЛИВКИ (Уменьшенные соты)
            // Строим контур гексагона, который уменьшен на 4 пикселя по краям
            const padding = 4; // Зазор в пикселях между ячейками. Можете менять от 2 до 5
            this._defineHexPath(hl.x, hl.y, this.hexRadius - padding);

            // Назначаем полупрозрачный цвет из вашей конфигурации
            if (hl.type === 'moveRange')   this.ctx.fillStyle = this.colors.moveRangeHighlight;
            if (hl.type === 'attackRange') this.ctx.fillStyle = this.colors.attackRangeHighlight;
            if (hl.type === 'selected')    this.ctx.fillStyle = this.colors.selectedHexHighlight;
            if (hl.type === 'hover')    this.ctx.fillStyle = this.colors.hoverHexHighlight;
            if (hl.type === 'path')        this.ctx.fillStyle = this.colors.pathHighlight;

            this.ctx.fill(); // Заливаем внутреннюю уменьшенную часть гекса
            this.ctx.restore();

            if (hl.type === 'hover' && hl.apCost !== undefined && hl.apCost > 0) {
                this.ctx.save();
                
                // Настройки шрифта в стиле TimeZero (маленький, плотный, хорошо читаемый)
                this.ctx.font = 'bold 13px Tahoma, Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';

                // Чтобы цифра не перекрывалась системным белым курсором-рукой ('pointer'),
                // мы смещаем текст на 12 пикселей вверх по вертикали от центра гекса!
                const textX = hl.x;
                const textY = hl.y;

                // 2. Рисуем сам текст сочным неоновым цветом (ярко-оранжевым или зеленым)
                this.ctx.fillStyle = '#FFF'; // Стильный оранжевый цвет для стоимости AP
                this.ctx.fillText(hl.apCost, textX, textY);

                this.ctx.restore();
            }
        });
    }


    /**
     * Единая сквозная сортировка объектов по глубине (Y-sorting)
     * Стены, окна, декорации и все персонажи собираются в одну очередь
     */
    _drawDepthSortedObjects() {

        // Создаем плоский массив и складываем туда все статические объекты карты
        const renderQueue = [...this.scene.objectmap.objects];

        // Добавляем в очередь живых существ (игрока и мобов), если они созданы
        if(window.entities){
           window.entities.forEach(entity => renderQueue.push(entity));
        }

        // Ключевой шаг: сортируем абсолютно ВСЁ сверху вниз по экрану
        renderQueue.sort((a, b) => {
            const yA = (a instanceof Entity && window.gameState === 'PLANNING') ? a.plannedY : a.y;
            const yB = (b instanceof Entity && window.gameState === 'PLANNING') ? b.plannedY : b.y;
            return yA - yB;
        });

        // Сначало рисуем тень объектов
        renderQueue.forEach(obj => {
            if(obj instanceof Entity) this.drawEntetyShadow(obj);
            else this.drawPngWithLongShadow(obj);
        });

        // Отрисовываем каждый объект из упорядоченной очереди
        renderQueue.forEach(obj => {
            if(obj instanceof Entity){   
                if(window.gameState === 'PLANNING' && obj.type === 'player') obj.draw(this.ctx, obj.plannedX, obj.plannedY);
                else obj.draw(this.ctx, obj.x, obj.y);
            }
            else this._drawStaticObject(obj);
        });
    }

    //Внутренний метод для отрисовки стен (с автотайлингом/поворотами) и декора
    _drawStaticObject(obj) {
        const asset = textureManager.get(obj.texture || 'wall_single');
        if (!asset) return;

        // Расчет для обычных декораций (деревья, камни, ящики) с учетом их индивидуальных анкоров
        const drawX = obj.x - (asset.width * (asset.anchorX || 0.5));
        const drawY = obj.y - (asset.height * (asset.anchorY || 1.0));
        this.ctx.drawImage(asset.element, drawX, drawY);
    }

    //Вспомогательная функция для показана координат
    _drawMapCoordinates(){
        if(this.scene.grid.hexes){
            this.scene.grid.hexes.forEach(hex => {

                this._defineHexPath(hex.x, hex.y);

                this.ctx.lineWidth = 2;
                this.ctx.closePath();
                this.ctx.stroke();
                this.ctx.beginPath();

                this.ctx.font = 'bold 14px Arial';
                this.ctx.fillStyle = '#171717'; // Красный цвет
                this.ctx.textAlign = 'center';     // По горизонтали
                this.ctx.textBaseline = 'middle';  // По вертикали
                this.ctx.fillText(hex.q+':'+hex.r, hex.x, hex.y);
            });
        }
    }

    /**
     * Отрисовка текста интерфейса поверх игрового поля (например, индикатор фаз)
     */
    _drawOverlayUI(cameraX, cameraY, currentZoom) {
        // Переводим отрисовку в координаты камеры, чтобы лучи и свет были привязаны к миру
            // Вычисляем мировые координаты текущего экрана
            const left = cameraX / currentZoom;
            const top = cameraY / currentZoom;
            const right = 0 + this.ctx.canvas.width / currentZoom;
            const bottom = 0 + this.ctx.canvas.height / currentZoom;

            // =========================================================================
            // ЭТАП 1: ТОЧНАЯ ЦВЕТОКОРРЕКЦИЯ ПЕСКА И ТЕНЕЙ (Fallout СТИЛЬ)
            // =========================================================================
            // На картинке 2 солнце светит сверху-справа налево-вниз.
            // Направление градиента: из правого верхнего угла экрана в левый нижний.
            const colorGrad = this.ctx.createLinearGradient(left, bottom, right, top);
            
            // Солнечная сторона: теплый, насыщенный охристо-золотой цвет (выжигает серый оттенок песка)
            colorGrad.addColorStop(0, 'rgba(226, 144, 62, 0.2)'); 
            // Центр сцены: плотный терракотовый тон
            colorGrad.addColorStop(0.4, 'rgba(241, 134, 41, 0.2)'); 
            // Теневая сторона: глубокий, холодный коричнево-бордовый оттенок для контрастных теней
            colorGrad.addColorStop(1, 'rgba(155, 50, 3, 0.2)'); 

            // Режим 'color-burn' идеально передает этот «выжженный» постапокалиптический контраст
            this.ctx.globalCompositeOperation = 'soft-light';
            this.ctx.fillStyle = colorGrad;
            this.ctx.fillRect(left, top, right, bottom);


            // =========================================================================
            // ЭТАП 2: СОЛНЕЧНЫЕ ЛУЧИ (GOD RAYS) И ОБЩАЯ ЗАСВЕТКА АТМОСФЕРЫ
            // =========================================================================
            // Переключаемся в режим 'screen', который осветляет пиксели и имитирует свечение воздуха
            this.ctx.globalCompositeOperation = 'screen';

            // 2.1. Общее атмосферное свечение от низкого солнца (радиальный блик)
            // Солнечный диск находится чуть за пределами правого верхнего угла
            const sunX = left;
            const sunY = top;
            const atmosphere = this.ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, right * 1.2);
            
            atmosphere.addColorStop(0, 'rgba(187, 116, 26, 0.15)'); // Золотистое ядро за экраном
            atmosphere.addColorStop(0.3, 'rgba(187, 116, 26, 0.05)'); // Мягкое рассеивание лучей
            atmosphere.addColorStop(1, 'rgba(0, 0, 0, 0)');           // Угасание к левому нижнему углу

            this.ctx.fillStyle = atmosphere;
            this.ctx.fillRect(left, top, right, bottom);

            this.ctx.restore();
    }

    drawPngWithLongShadow(obj){
        const asset = textureManager.get(obj.texture+'_shadow');
        if (!asset) return;

        let drawX;
        let drawY;

        if (asset.type === 'autotiling' && obj.rotationAngle !== undefined) {
            // Расчет для изометрического автотайлинга стен
            this.ctx.save();
            this.ctx.translate(obj.x, obj.y);
            this.ctx.scale(1, this.isoYScale); 
            this.ctx.rotate(obj.rotationAngle); 
            drawX = -asset.width / 2;
            drawY = -asset.height + (this.hexRadius * this.isoYScale) / 2;
        } else {
            // Расчет для обычных декораций (деревья, камни, ящики) с учетом их индивидуальных анкоров
            drawX = obj.x - (asset.width * (asset.anchorX || 0.5));
            drawY = obj.y - (asset.height * (asset.anchorY || 1.0));
        }

        drawX = drawX - 3;
        drawY = drawY - 10;

        // 1. ОТРИСОВКА ПАДАЮЩЕЙ ТЕНИ (Летит на видеокарту мгновенно)
        this.ctx.save();

        if(obj.texture == 'wall_diagonal_1_window' || obj.texture == 'wall_diagonal_1' || obj.texture == 'wall_end_diaright' || obj.texture == 'wall_end_dialeft' || obj.texture == 'wall_diagonal_3'){
            this.ctx.translate(drawX + asset.width / 2, drawY + asset.height);
            this.ctx.transform(1, 0, -.1, .5, 0, 0);
            this.ctx.translate(-asset.width / 2, -asset.height);
        }
        else if(obj.texture == 'wall_diagonal_2_window' || obj.texture == 'wall_diagonal_2' || obj.texture == 'wall_end_diaright2' || obj.texture == 'wall_end_dialeft2' || obj.texture == 'wall_diagonal_4'){
            this.ctx.translate(drawX + asset.width, drawY + asset.height);
            this.ctx.transform(1, 0, -0.7, 0.65, 0, 0);
            this.ctx.translate(-asset.width, -asset.height);
        }
        else{
            this.ctx.translate(drawX + asset.width / 2, drawY + asset.height);
            this.ctx.transform(1, 0, -0.6, 0.45, 0, 0);
            this.ctx.translate(-asset.width / 2, -asset.height);
        }

        // Просто рисуем уже готовую черную картинку из памяти! Никаких расчетов!
        this.ctx.drawImage(asset.element, 0, 0, asset.width, asset.height);
        this. ctx.restore();
    }

    drawEntetyShadow(obj){

        const textureKey = obj._getCurrentTextureKey();
        const asset = textureManager.get(textureKey+'_shadow');
        if(!asset) return;

        const directionInfo = obj.directionMap[obj.directionIndex];
        const isMirrored = directionInfo ? directionInfo.mirror : false;

        this.ctx.save();

        const renderX = (window.gameState === "PLANNING" && obj.type == 'player') ? obj.plannedX : obj.x;
        const renderY = (window.gameState === "PLANNING" && obj.type == 'player') ? obj.plannedY : obj.y;

        this.ctx.translate(renderX, renderY);

        if (isMirrored) {
            this.ctx.scale(-1, 1); // Переворачиваем холст по горизонтали на месте
        }

        const frameWidth = asset.frameWidth || asset.width || 64;
        const frameHeight = asset.frameHeight || asset.height || 64;

        const anchorX = asset.anchorX !== undefined ? asset.anchorX : 0.5;
        const anchorY = asset.anchorY !== undefined ? asset.anchorY : 1.0;

        // Рассчитываем многорядную сетку спрайт-листа
        const cols = asset.cols || Infinity;
        const colIndex = obj.currentFrame % cols;
        const rowIndex = Math.floor(obj.currentFrame / cols);

        const srcX = colIndex * frameWidth;
        const srcY = rowIndex * frameHeight;

        // Магия Pivot-анкоров: выравниваем основание спрайта по коэффициентам
        let drawX = -(frameWidth * (anchorX || 0.5));
        let drawY = -(frameHeight * (anchorY || 1.0));

        if(isMirrored) drawX = drawX + 27;
        else drawX = drawX - 1;
        drawY = drawY + 22;

        if(obj.state == 'crawl' || obj.state == 'cover'){
            if(isMirrored) drawX -= 8;
            else drawX += 5;
            drawY -= 7;
        }

        this.ctx.translate(drawX + frameWidth / 2, drawY + frameHeight);
        if(isMirrored) this.ctx.transform(1, 0, 0.4, 0.45, 0, 0);
        else this.ctx.transform(1, 0, -0.4, 0.45, 0, 0);
        this.ctx.translate(-frameWidth / 2, -frameHeight);

        this.ctx.drawImage(asset.element, srcX, srcY, frameWidth, frameHeight, drawX, drawY, frameWidth, frameHeight);
        this.ctx.restore();
    }

    /**
     * Вспомогательный хелпер для отрисовки цифр здоровья над объектами
     */
    _drawHPText(hp, x, y) {
        this.ctx.save();
        this.ctx.font = '10px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 2;
        this.ctx.strokeText(hp, x, y);
        this.ctx.fillStyle = '#ff3333';
        this.ctx.fillText(hp, x, y);
        this.ctx.restore();
    }

    /**
     * Хелпер разметки геометрического контура гексагона (odd-r изометрия)
     */
    _defineHexPath(x, y, customRadius) {
        // Если customRadius передан, используем его, иначе берем стандартный hexRadius
        const currentRadius = customRadius !== undefined ? customRadius : this.hexRadius;

        this.ctx.beginPath();
        let angleRad = (Math.PI / 3) * 0 + (Math.PI / 6);
        this.ctx.moveTo(
            x + currentRadius * Math.cos(angleRad),
            y + (currentRadius * Math.sin(angleRad)) * this.isoYScale
        );

        for (let i = 1; i < 6; i++) {
            let angleRad = (Math.PI / 3) * i + (Math.PI / 6);
            this.ctx.lineTo(
                x + currentRadius * Math.cos(angleRad),
                y + (currentRadius * Math.sin(angleRad)) * this.isoYScale
            );
        }
        this.ctx.closePath();
    }

    _drawNonPlayableShadow() {
        // Безопасная проверка: если карта еще не сгенерирована, выходим
        if (!this.scene.grid || !this.scene.grid.hexes || this.scene.grid.hexes.length === 0) return;

        this.ctx.save();

        // =========================================================================
        // ВАША НАСТРОЙКА: Фиксированная ширина темных полос со всех сторон (в пикселях)
        // =========================================================================
        const shadowWidth = 500; 
        // =========================================================================

        // 1. Опрашиваем РЕАЛЬНЫЕ гексы вашей карты, чтобы узнать, где сейчас на экране 
        // находятся самые крайние физические точки поля боя.
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        this.scene.grid.hexes.forEach(hex => {
            if (hex.x < minX) minX = hex.x;
            if (hex.x > maxX) maxX = hex.x;
            if (hex.y < minY) minY = hex.y;
            if (hex.y > maxY) maxY = hex.y;
        });

        // 2. Добавляем небольшой зазор (толщину половинки гекса), чтобы рамка 
        // аккуратно прижималась к внешним ребрам крайних ячеек
        const paddingX = this.hexRadius * Math.sqrt(3) * 0.5;
        const paddingY = this.hexRadius * this.isoYScale;

        // Идеальные, чистые границы тактического поля боя на вашем экране:
        const x0 = minX - paddingX;
        const y0 = minY - paddingY;
        const x1 = maxX + paddingX;
        const y1 = maxY + paddingY;

        // Назначаем полупрозрачный темный цвет (55% затемнения, как в TimeZero)
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'; 

        // =========================================================================
        // СИММЕТРИЧНЫЙ РАСЧЕТ ЧЕТЫРЕХ ПЛИТ (РОВНО ПО 200 ПИКСЕЛЕЙ ШИРИНОЙ):
        // Теперь размеры прямоугольников жестко привязаны к константе shadowWidth
        // со всех 4-х сторон, независимо от того, насколько сильно отдалена карта!
        // =========================================================================
        
        // Плита 1: ВЕРХНЯЯ (высотой ровно shadowWidth, уходит вверх от верхней границы гексов)
        this.ctx.fillRect(x0 - shadowWidth, y0 - shadowWidth, (x1 - x0) + shadowWidth * 2, shadowWidth);

        // Плита 2: НИЖНЯЯ (высотой ровно shadowWidth, уходит вниз от нижней границы гексов)
        this.ctx.fillRect(x0 - shadowWidth, y1, (x1 - x0) + shadowWidth * 2, shadowWidth);

        // Плита 3: ЛЕВАЯ (шириной ровно shadowWidth, уходит влево)
        this.ctx.fillRect(x0 - shadowWidth, y0, shadowWidth, y1 - y0);

        // Плита 4: ПРАВАЯ (шириной ровно shadowWidth, уходит вправо от правой границы гексов)
        this.ctx.fillRect(x1, y0, shadowWidth, y1 - y0);

        this.ctx.restore();
    }
}
