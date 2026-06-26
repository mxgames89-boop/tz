class EffectRenderer {
    constructor() {
        this.activeEffects = []; // Список всех проигрываемых эффектов (трассеры, текст урона)
    }

    //Сам решает, пустить мгновенный лазер или летящую пулю
    addProjectile(startX, startY, targetX, targetY, weaponConfig, onHitCallback) {
        const sX = startX;
        const sY = startY;
        const tX = targetX;
        const tY = targetY - 45; // Попадание на уровне груди
        const dx = tX - sX;
        const dy = tY - sY;
        const distance = Math.hypot(tX - sX, tY - sY);
        const angle = Math.atan2(tY - sY, tX - sX);

        // =========================================================================
        // ВАРИАНТ 1: ЕСЛИ ОРУЖИЕ СТРЕЛЯЕТ МГНОВЕННЫМ ЛАЗЕРОМ
        // =========================================================================
        if (weaponConfig.projectileType === 'laser') {
            // Лазер наносит урон МГНОВЕННО в эту же миллисекунду, без полета!
            if (typeof onHitCallback === 'function') {
                onHitCallback();
            }

            // Добавляем статический луч, который будет плавно тухнуть несколько кадров
            this.activeEffects.push({
                id: 'laser_beam',
                startX: sX,
                startY: sY,
                targetX: tX,
                targetY: tY,
                color: weaponConfig.projectileColor || "#00ffcc",
                maxTicks: 6, // Время горения луча на экране Canvas
                currentTick: 0
            });
        } 
        // =========================================================================
        // ВАРИАНТ 2: ЕСЛИ ОРУЖИЕ СТРЕЛЯЕТ ЛЕТЯЩИМИ СНАРЯДАМИ (ПУЛЯМИ)
        // =========================================================================
        else {
            this.activeEffects.push({
                id: 'projectile',
                type: weaponConfig.projectileType,   // "bullet" или "plasma"
                color: weaponConfig.projectileColor, 
                speed: weaponConfig.projectileSpeed || 15, 
                x: sX,
                y: sY,
                targetX: tX,
                targetY: tY,
                angle: angle,
                distanceLeft: distance,
                progress: 0,
                onHit: onHitCallback // Сработает только тогда, когда пуля долетит!
            });
        }
    }

    //ДОБАВИТЬ ВСПЛЫВАЮЩИЙ ТЕКСТ УРОНА (Floating Damage Text)
    addFloatingText(text, x, y, type, durationTicks = 75){

        const rowHeight = 10;

        for (let i = 0; i < this.activeEffects.length; i++){
            const fx = this.activeEffects[i];
            
            if (fx.id === 'text' && Math.abs(fx.x - x) < 10){
                fx.y -= rowHeight;
            }
        }

        this.activeEffects.push({
            id: 'text',
            text: text,
            x: x,
            y: y - 85,
            type: type,
            maxTicks: durationTicks,
            currentTick: 0
        });
    }

    renderAndUpdate(ctx) {
        if (this.activeEffects.length === 0) return;

        ctx.save();

        for (let i = this.activeEffects.length - 1; i >= 0; i--) {
            const fx = this.activeEffects[i];

            // -----------------------------------------------------------------
            // РЕНДЕРИНГ МГНОВЕННОГО ЛАЗЕРНОГО ЛУЧА
            // -----------------------------------------------------------------
            if (fx.id === 'laser_beam') {

                ctx.save()

                ctx.beginPath();
                ctx.moveTo(fx.startX, fx.startY);
                ctx.lineTo(fx.targetX, fx.targetY);
                
                ctx.strokeStyle = fx.color;
                ctx.lineWidth = 3;
                
                // Эффект неонового свечения
                ctx.shadowBlur = 10;
                ctx.shadowColor = fx.color;
                
                // Плавное затухание яркости луча к концу его жизни
                ctx.globalAlpha = 1 - (fx.currentTick / fx.maxTicks);
                ctx.stroke();

                fx.currentTick++;
                if (fx.currentTick >= fx.maxTicks) {
                    this.activeEffects.splice(i, 1);
                }

                ctx.restore()
            }
            // -----------------------------------------------------------------
            // ДВИЖЕНИЕ И РЕНДЕРИНГ ЛЕТЯЩЕГО СНАРЯДА (ПУЛИ)
            // -----------------------------------------------------------------
            else if (fx.id === 'projectile') {
                if (fx.type === 'bullet') {
                        
                // 1. ВЫЧИСЛЕНИЕ ТЕКУЩЕЙ ПОЗИЦИИ ГОЛОВЫ ПУЛИ
                // Переводим пиксельную скорость в долю от общего пути
                const stepProgress = fx.speed / fx.distanceLeft;

                fx.progress = Math.min(1.0, fx.progress + stepProgress);

                // Точные экранные координаты головы пули на этом кадре
                const headX = fx.x + (fx.targetX - fx.x) * fx.progress;
                const headY = fx.y + (fx.targetY - fx.y) * fx.progress;

                // 2. ДИНАМИЧЕСКИЙ РАСЧЕТ ДЛИНЫ ХВОСТА
                // Максимальная длина шлейфа для дальних дистанций — 60px.
                // Для сверхкоротких дистанций (в упор) хвост не может превышать 40% от общего расстояния.
                const maxTracerLength = 60;
                const currentMaxTracer = Math.min(maxTracerLength, fx.distanceLeft * 0.4);
                
                // Вычисляем, какую долю пути занимает хвост
                const tailProgressOffset = currentMaxTracer / fx.distanceLeft;
                // Хвост не может уйти в отрицательный прогресс (за спину стрелка)
                const tailProgress = Math.max(0.0, fx.progress - tailProgressOffset);

                // Точные координаты хвоста
                const tailX = fx.x + (fx.targetX - fx.x) * tailProgress;
                const tailY = fx.y + (fx.targetY - fx.y) * tailProgress;

                // 3. ОТРИСОВКА (Только если голова и хвост не слиплись в одной точке)
                if (headX !== tailX || headY !== tailY) {
                    ctx.save();

                    // Создаем градиент строго вдоль линии текущего положения пули
                    const gradient = ctx.createLinearGradient(tailX, tailY, headX, headY);
                    gradient.addColorStop(0, 'rgba(255, 60, 0, 0)');     // Хвост плавно тает
                    gradient.addColorStop(0.4, 'rgba(255, 100, 0, 0.4)'); // Оранжевое неоновое тело пули
                    gradient.addColorStop(1, 'rgba(255, 255, 210, 1)');   // Ослепительно белое ядро

                    // ЭМУЛЯЦИЯ GLOW (Накладываем мягкую широкую подложку вместо тяжелого shadowBlur)
                    ctx.beginPath();
                    ctx.moveTo(tailX, tailY);
                    ctx.lineTo(headX, headY);
                    ctx.lineWidth = 5; 
                    ctx.strokeStyle = 'rgba(255, 80, 0, 0.2)'; 
                    ctx.stroke();
                    ctx.closePath();

                    // ОСНОВНОЙ КЛИН ПУЛИ
                    ctx.beginPath();
                    ctx.moveTo(tailX, tailY);
                    ctx.lineTo(headX, headY);
                    ctx.lineWidth = 2.5; 
                    ctx.strokeStyle = gradient;
                    ctx.stroke();
                    ctx.closePath();

                    // МАЛЕНЬКАЯ ТОЧКА-ЯДРО НА ОСТРИЕ
                    ctx.beginPath();
                    ctx.arc(headX, headY, 1.8, 0, Math.PI * 2);
                    ctx.fillStyle = '#ffffff';
                    ctx.fill();
                    ctx.closePath();

                    ctx.restore();
                }

                // 4. ПРОВЕРКА ФИНИША (Долетели до цели)
                if (fx.progress >= 1.0) {
                    if (typeof fx.onHit === 'function') {
                        fx.onHit(); // Мгновенный взрыв, урон, кровь строго в точке назначения!
                    }
                    this.activeEffects.splice(i, 1);
                    i--; // Корректируем индекс для безопасного удаления в цикле
                }
                }
            } 
            // -----------------------------------------------------------------
            // РЕНДЕРИНГ ВСПЛЫВАЮЩЕГО ТЕКСТА УРОНА
            // -----------------------------------------------------------------
            else if (fx.id === 'text') {
                ctx.font = 'bold 11px Tahoma, Arial, sans-serif';
                const textWidth = ctx.measureText(fx.text).width;
                const rectWidth = textWidth + 12;
                const rectHeight = 16;
                const rectX = fx.x - (rectWidth / 2);
                const rectY = fx.y - (rectHeight / 2);

                const alpha = 1 - (fx.currentTick / fx.maxTicks);
                ctx.globalAlpha = alpha;

                ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
                ctx.fillRect(rectX + 2, rectY + 2, rectWidth, rectHeight);

                let bgStyle = '#b71c1c'; // Базовый кроваво-красный
                let textStyle = '#ffea00'; // Базовые неоново-желтые цифры

                if(fx.type == 'crit'){
                    bgStyle = '#730909'; // Базовый кроваво-красный
                    textStyle = '#FFF';
                }

                ctx.fillStyle = bgStyle;
                ctx.fillRect(rectX, rectY, rectWidth, rectHeight);

                ctx.strokeStyle = '#111415'; 
                ctx.lineWidth = 1.5;
                ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);

                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = textStyle;
                ctx.strokeText(fx.text, fx.x, fx.y);
                ctx.fillText(fx.text, fx.x, fx.y);
                
                fx.y -= 0.35;
                fx.currentTick++;

                if(fx.currentTick >= fx.maxTicks) {
                    this.activeEffects.splice(i, 1);
                }
            }
        }

        ctx.restore();
    }

    /**
     * Полная принудительная очистка (при смене раундов)
     */
    clearAll() {
        this.activeEffects = [];
    }

    //Вспомогателльная функция, которая помогает понять откуда выпускать луч 
    calcDrawXY(entity, weaponConfig){

        let drawX = entity.x;
        let drawY = entity.y;
        let state_set = (entity.state != 'idle' && entity.state != 'run') ? true : false;

        if(entity.directionIndex == 0){
            drawX = entity.x + 35;
            drawY = entity.y - 64;
            if(state_set){
                drawX += 8;
                drawY += 26;
            }
        }

        if(entity.directionIndex == 1){
            drawX = entity.x + 36;
            drawY = entity.y - 27;
            if(state_set){
                drawX -= 10;
                drawY += 23;
            }
        }

        if(entity.directionIndex == 2){
            drawX = entity.x - 36;
            drawY = entity.y - 27;
            if(state_set){
                drawX += 10;
                drawY += 23;
            }
        }

        if(entity.directionIndex == 3){
            drawX = entity.x - 35;
            drawY = entity.y - 64;
            if(state_set){
                drawX -= 3;
                drawY += 26;
            }
        }

        if(entity.directionIndex == 4){
            drawX = entity.x - 36;
            drawY = entity.y - 83;
            if(state_set){
                drawY += 30;
            }
        }

        if(entity.directionIndex == 5){
            drawX = entity.x + 36;
            drawY = entity.y - 83;
            if(state_set){
                drawY += 30;
            }
        }

        return {x: drawX, y: drawY};
    }
}

// Экспортируем синглтон для удобного вызова из любого места игры
export const effectRenderer = new EffectRenderer();
