import { MUZZLE_SOCKETS } from './MuzzleSockets.js';

class EffectRenderer {
  constructor() {
    this.activeEffects = [];
  }

  // Сам решает, пустить мгновенный лазер или летящую пулю
  addProjectile(startX, startY, targetX, targetY, weaponConfig, onHitCallback, targetYOffset = -45) {
    const sX = startX;
    const sY = startY;

    const tX = targetX;
    const tY = targetY + targetYOffset;

    const distance = Math.hypot(tX - sX, tY - sY);
    const angle = Math.atan2(tY - sY, tX - sX);

    if (weaponConfig.projectileType === 'laser') {
      if (typeof onHitCallback === 'function') {
        onHitCallback();
      }

      this.activeEffects.push({
        id: 'laser_beam',
        startX: sX,
        startY: sY,
        targetX: tX,
        targetY: tY,
        color: weaponConfig.projectileColor || '#00ffcc',
        maxTicks: 6,
        currentTick: 0
      });

      return;
    }

    this.activeEffects.push({
      id: 'projectile',
      type: weaponConfig.projectileType,
      color: weaponConfig.projectileColor,
      speed: weaponConfig.projectileSpeed || 15,

      x: sX,
      y: sY,

      targetX: tX,
      targetY: tY,

      angle,
      distanceLeft: distance,
      progress: 0,
      onHit: onHitCallback
    });
  }

  // Добавить всплывающий текст урона
  addFloatingText(text, x, y, type, durationTicks = 75) {
    const rowHeight = 10;

    for (let i = 0; i < this.activeEffects.length; i++) {
      const fx = this.activeEffects[i];

      if (fx.id === 'text' && Math.abs(fx.x - x) < 10) {
        fx.y -= rowHeight;
      }
    }

    this.activeEffects.push({
      id: 'text',
      text,
      x,
      y: y - 85,
      type,
      maxTicks: durationTicks,
      currentTick: 0
    });
  }

  // Обновляет состояние эффектов один раз за кадр.
  // Важно: теперь обновление отделено от отрисовки.
  update() {
    if (this.activeEffects.length === 0) return;

    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const fx = this.activeEffects[i];

      if (fx.id === 'laser_beam') {
        fx.currentTick++;

        if (fx.currentTick >= fx.maxTicks) {
          this.activeEffects.splice(i, 1);
        }

        continue;
      }

      if (fx.id === 'projectile') {
        if (fx.distanceLeft <= 0) {
          if (typeof fx.onHit === 'function') {
            fx.onHit();
          }

          this.activeEffects.splice(i, 1);
          continue;
        }

        const stepProgress = fx.speed / fx.distanceLeft;

        fx.progress = Math.min(1.0, fx.progress + stepProgress);

        if (fx.progress >= 1.0) {
          if (typeof fx.onHit === 'function') {
            fx.onHit();
          }

          this.activeEffects.splice(i, 1);
        }

        continue;
      }

      if (fx.id === 'text') {
        fx.y -= 0.35;
        fx.currentTick++;

        if (fx.currentTick >= fx.maxTicks) {
          this.activeEffects.splice(i, 1);
        }
      }
    }
  }

  // Отдаёт эффекты, которые должны участвовать в Y-сортировке мира:
  // лазеры и пули. Текст урона оставляем поверх карты.
  getDepthSortedItems() {
    return this.activeEffects
      .filter(fx => fx.id === 'laser_beam' || fx.id === 'projectile')
      .map(fx => {
        return {
          renderType: 'effect',
          effect: fx,
          y: this.getEffectDepthY(fx)
        };
      });
  }

  getEffectDepthY(fx) {
    if (fx.id === 'laser_beam') {
      // Для длинного луча это компромисс:
      // берём нижнюю точку, чтобы луч чаще уходил за высокие объекты,
      // которые визуально находятся перед ним.
      return Math.max(fx.startY, fx.targetY);
    }

    if (fx.id === 'projectile') {
      const headY = fx.y + (fx.targetY - fx.y) * fx.progress;
      return headY;
    }

    return fx.y || 0;
  }

  drawEffect(ctx, fx) {
    if (!fx) return;

    if (fx.id === 'laser_beam') {
      this._drawLaser(ctx, fx);
      return;
    }

    if (fx.id === 'projectile') {
      this._drawProjectile(ctx, fx);
    }
  }

  _drawLaser(ctx, fx) {
    ctx.save();

    ctx.beginPath();
    ctx.moveTo(fx.startX, fx.startY);
    ctx.lineTo(fx.targetX, fx.targetY);

    ctx.strokeStyle = fx.color;
    ctx.lineWidth = 3;

    ctx.shadowBlur = 10;
    ctx.shadowColor = fx.color;

    ctx.globalAlpha = Math.max(
      0,
      1 - (fx.currentTick / fx.maxTicks)
    );

    ctx.stroke();

    ctx.restore();
  }

  _drawProjectile(ctx, fx) {
    if (fx.type !== 'bullet') {
      this._drawSimpleProjectile(ctx, fx);
      return;
    }

    const headX = fx.x + (fx.targetX - fx.x) * fx.progress;
    const headY = fx.y + (fx.targetY - fx.y) * fx.progress;

    const maxTracerLength = 60;
    const currentMaxTracer = Math.min(maxTracerLength, fx.distanceLeft * 0.4);
    const tailProgressOffset = currentMaxTracer / fx.distanceLeft;
    const tailProgress = Math.max(0.0, fx.progress - tailProgressOffset);

    const tailX = fx.x + (fx.targetX - fx.x) * tailProgress;
    const tailY = fx.y + (fx.targetY - fx.y) * tailProgress;

    if (headX === tailX && headY === tailY) return;

    ctx.save();

    const gradient = ctx.createLinearGradient(tailX, tailY, headX, headY);

    gradient.addColorStop(0, 'rgba(255, 60, 0, 0)');
    gradient.addColorStop(0.4, 'rgba(255, 100, 0, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 255, 210, 1)');

    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(headX, headY);
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255, 80, 0, 0.2)';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(headX, headY);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = gradient;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(headX, headY, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }

  _drawSimpleProjectile(ctx, fx) {
    const headX = fx.x + (fx.targetX - fx.x) * fx.progress;
    const headY = fx.y + (fx.targetY - fx.y) * fx.progress;

    ctx.save();

    ctx.beginPath();
    ctx.arc(headX, headY, 4, 0, Math.PI * 2);
    ctx.fillStyle = fx.color || '#ffffff';
    ctx.shadowBlur = 8;
    ctx.shadowColor = fx.color || '#ffffff';
    ctx.fill();

    ctx.restore();
  }

  // Текст урона рисуем отдельно поверх мира,
  // чтобы цифры не прятались за стенами.
  renderOverlayEffects(ctx) {
    if (this.activeEffects.length === 0) return;

    ctx.save();

    for (const fx of this.activeEffects) {
      if (fx.id !== 'text') continue;

      this._drawFloatingText(ctx, fx);
    }

    ctx.restore();
  }

  _drawFloatingText(ctx, fx) {
    ctx.save();

    ctx.font = 'bold 11px Tahoma, Arial, sans-serif';

    const textWidth = ctx.measureText(fx.text).width;
    const rectWidth = textWidth + 12;
    const rectHeight = 16;
    const rectX = fx.x - (rectWidth / 2);
    const rectY = fx.y - (rectHeight / 2);

    const alpha = Math.max(
      0,
      1 - (fx.currentTick / fx.maxTicks)
    );

    ctx.globalAlpha = alpha;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(rectX + 2, rectY + 2, rectWidth, rectHeight);

    let bgStyle = '#b71c1c';
    let textStyle = '#ffea00';

    if (fx.type === 'crit') {
      bgStyle = '#730909';
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

    ctx.restore();
  }

  // Старый метод оставляем как совместимость,
  // но CanvasRenderer после правок его вызывать не должен.
  renderAndUpdate(ctx) {
    this.update();

    for (const item of this.getDepthSortedItems()) {
      this.drawEffect(ctx, item.effect);
    }

    this.renderOverlayEffects(ctx);
  }

  clearAll() {
    this.activeEffects = [];
  }

  // Вспомогательная функция, которая помогает понять откуда выпускать луч
  calcDrawXY(entity, weaponConfig) {
    const category = weaponConfig?.category || 'default';
    const direction = Number(entity.directionIndex) || 0;

    const pose = this.getMuzzlePose(entity);

    const categorySockets = MUZZLE_SOCKETS[category] || MUZZLE_SOCKETS.default;
    const poseSockets = categorySockets[pose] || categorySockets.idle || MUZZLE_SOCKETS.default.idle;

    const offset =
      poseSockets[direction] ||
      MUZZLE_SOCKETS.default.idle[direction] ||
      { x: 0, y: 0 };

    return {
      x: entity.x + offset.x,
      y: entity.y + offset.y
    };
  }

  getMuzzlePose(entity){
    if(!entity) return 'idle';
    if(entity.state === 'crawl') return 'crawl';
    return 'idle';
  }
}

export const effectRenderer = new EffectRenderer();