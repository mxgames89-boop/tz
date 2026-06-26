import { effectRenderer } from './EffectRenderer.js';
import { GAME_CONFIG } from '../config.js';
import { audioManager } from '../audio/AudioManager.js';

export class AnimationPlayer {
    constructor(game) {
        this.game = game;
        this.script = [];      // Сюда загружается проигрываемый сценарий раунда
        this.currentTick = 0;  // Текущий кадр воспроизведения
        this.isPlaying = false;
        this.animation = false;
    }

    /**
     * Загружает готовый сценарий и запускает плеер
     * @param {Array<Object>} script - Массив кадров симуляции
     */
    play(script) {
        this.script = script;
        this.currentTick = 0;
        this.timerTick = 0;
        this.isPlaying = true;
    }

    /**
     * Основной метод обновления, вызываемый на каждом кадре игры из TurnManager
     * @param {Array<Entity>} entities - Список живых существ на экране
     * @returns {boolean} true, если плеер еще проигрывает анимацию, false — если финиш
     */
    updatePlayback() {
        if (!this.isPlaying) return false;
        if (!this.script) return false;

        // Если видеоплеер докрутил ленту до самого конца — останавливаем проигрывание
        if(!this.script.length){
            this.isPlaying = false;
            this.script = [];
            return false;
        }

        this.script.forEach((enty, index) => {
            const event = enty.timeline[0];
            if(event){
                if(this.currentTick >= event.tick){
                    if(event.type == 'position_change') this.animation = this.moveAnimation(enty.id, event);
                    if(event.type == 'state_change') this.animation = this.changePosAnimation(enty.id, event);
                    if(event.type == 'shoot') this.animation = this.shootAnimation(enty.id, event);
                    
                    if(!this.animation) this.script[index].timeline.shift();
                }

                //Удаляем существо если оно выполнило все действия
                if(!this.script[index].timeline.length){
                    const ent = window.entities.find(e => e.id === enty.id);
                    ent.currentFrame = 0;
                    this.script.splice(index, 1);
                } 
            }
        });

        // Перематываем плеер на 1 кадр вперед
        this.currentTick++;
        return true; 
    }

    //Анимация передвижения
    moveAnimation(entityId, action){
        if(action.state == 'idle') this.moveSpeed = 1.5;
        if(action.state == 'run') this.moveSpeed = 3;

        const entity = window.entities.find(e => e.id === entityId);

        entity.state = action.state;
        entity.skin = action.skin;
        entity.animation = true;

        // Находим целевой гекс на карте
        const targetHex = this.game.grid.hexes.find(h => 
            Number(h.q) === Number(action.q) && 
            Number(h.r) === Number(action.r)
        );

        if(!targetHex){
            return;
        }

        entity.lookAt(action.q, action.r);

        if(entity.directionIndex != 0 && entity.directionIndex != 3){
            this.moveSpeed = this.moveSpeed * 0.72;
        }

        // Расчет расстояния
        const dx = targetHex.x - entity.x;
        const dy = targetHex.y - entity.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if(distance > this.moveSpeed){
            // Продолжаем попиксельное скольжение к цели
            entity.x += (dx / distance) * this.moveSpeed;
            entity.y += (dy / distance) * this.moveSpeed;
            return true;
        }else{
            // ПРИБЫТИЕ НА КЛЕТКУ
            // Официально меняем логические координаты на сетке гексов
            entity.q = action.q;
            entity.r = action.r;
            entity.updateScreenCoordinates(); // Примагничивание к центру ячейки
            entity.animation = false;
            return false;
        } 
    }

    //Анимация смены режима передвижения
    changePosAnimation(entityId, action){
        const entity = window.entities.find(e => e.id === entityId);
        entity.state = action.state;
        entity.skin = action.skin;

        if(entity.state == 'run'){
            entity.animation = false;
            this.timerTick = 0;
            return false;
        }

        this.timerTick++;

        if(this.timerTick >= 15){
            entity.animation = false;
            this.timerTick = 0;
            return false;
        }else{
            return true;
        }
        
    }

    //Анимация стрельбы
    shootAnimation(entityId, action){
        const attacker = window.entities.find(e => e.id === action.attackerID);
        const hitUnit = window.entities.find(e => e.id === action.targetID);
        let targetX;
        let targetY;

        attacker.lookAt(action.targetHex.q, action.targetHex.r);
        if(attacker.state == 'crawl') attacker.skin = 'crawl_'+action.gun.category;
        else attacker.skin = 'idle_'+action.gun.category;

        if(action.targetID){
            if(hitUnit) {targetX = hitUnit.x; targetY = hitUnit.y;}
        }else{
            const targetHexOnCanvas = this.game.grid.hexes.find(h => h.q === action.targetHex.q && h.r === action.targetHex.r);
            if(targetHexOnCanvas) {targetX = targetHexOnCanvas.x; targetY = targetHexOnCanvas.y;}
        }

        if(attacker) effectRenderer.addProjectile(effectRenderer.calcDrawXY(attacker, action.gun).x, effectRenderer.calcDrawXY(attacker, action.gun).y, targetX, targetY, action.gun, this._handleBulletHit.bind(this, attacker, hitUnit, targetX, targetY, action));
        
        audioManager.play('laser_shoot', 0.2);

        attacker.animation = false;
        return false;
    }

    _handleBulletHit(attacker, hitUnit, targetX, targetY, action){
        if(action.targetID){
            if(action.isHit){
                hitUnit.hp = Math.max(0, hitUnit.hp - action.damage);
                if(action.isCritical) effectRenderer.addFloatingText(`-${action.damage}!`, targetX, targetY, 'crit');
                else effectRenderer.addFloatingText(`-${action.damage}`, targetX, targetY, 'normal');

                if(hitUnit.hp <= 0) audioManager.play('laser_death', 0.2);
            }
        }else if(action.hitObstacle){
            const realObstacle = this.game.objectmap.objects.find(o => Number(o.q) === Number(action.targetHex.q) && Number(o.r) === Number(action.targetHex.r));
            if(realObstacle){
                if(realObstacle.hp !== undefined) realObstacle.hp -= action.obstacleDamage;
                realObstacle.update = true;
                effectRenderer.addFloatingText(`-${action.obstacleDamage}`, targetX, targetY, '#ffcc00');

                 if(action.isObstacleDestroyed){
                    this.game.objectmap.objects = this.game.objectmap.objects.filter(o => o !== realObstacle);
                    this.game.grid.nonspawn = this.game.grid.nonspawn.filter(n => Number(n.q) !== Number(action.targetHex.q) || Number(n.r) !== Number(action.targetHex.r));
                 }
            }
        }
    }
}