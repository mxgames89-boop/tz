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
        this.lastEvents = [];
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
    updatePlayback(deltaTime = 16.67) {
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
                const nextEvent = enty.timeline[1];
                const hasNextMoveWithSameState = nextEvent && nextEvent.type === 'position_change' && nextEvent.state === event.state;
                const hasLastMoveWithSameState = this.lastEvents[enty.id] && this.lastEvents[enty.id].type === 'position_change' && this.lastEvents[enty.id].state === event.state;

                if(this.currentTick >= event.tick || hasLastMoveWithSameState){
                    if(event.type == 'position_change') this.animation = this.moveAnimation(enty.id, event, hasNextMoveWithSameState, deltaTime);
                    if(event.type == 'state_change') this.animation = this.changePosAnimation(enty.id, event, deltaTime);
                    if(event.type == 'shoot') this.animation = this.shootAnimation(enty.id, event);

                    this.lastEvents[enty.id] = enty.timeline[0];
                    
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
        this.currentTick += deltaTime / GAME_CONFIG.turn.tickDuration;
        return true; 
    }

    //Анимация передвижения
    moveAnimation(entityId, action, hasNextMoveWithSameState = false, deltaTime = 16.67){

        const frameScale = deltaTime / 16.67;

        if(action.state == 'idle') this.moveSpeed = 1.5 * frameScale;
        if(action.state == 'run') this.moveSpeed = 3 * frameScale;

        const entity = window.entities.find(e => e.id === entityId);

        const footstepLoopId = `footsteps_${entity.id}`;
        const footstepSoundKey = action.state === 'run' ? 'run' : 'idle';
        audioManager.playLoop(footstepLoopId, footstepSoundKey, 0.15);

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
            if(!hasNextMoveWithSameState) audioManager.stopLoop(footstepLoopId);
            return false;
        } 
    }

    //Анимация смены режима передвижения
    changePosAnimation(entityId, action, deltaTime = 16.67){
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
            this.timerTick = 0;
            entity.animation = false;
            return false;
        }else return true;
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

        const targetYOffset = action.targetID ? -45 : 0;

        if(attacker){
            const muzzle = effectRenderer.calcDrawXY(attacker, action.gun);
            effectRenderer.addProjectile(muzzle.x, muzzle.y, targetX, targetY, action.gun, this._handleBulletHit.bind(this, attacker, hitUnit, targetX, targetY + targetYOffset, action), targetYOffset);
        } 

        const nameAudio = action.gun.category+'_shoot';
        audioManager.play(nameAudio, 0.15);

        attacker.animation = false;
        return false;
    }

    _handleBulletHit(attacker, hitUnit, targetX, targetY, action){
        if(action.targetID){
            if(action.isHit){
                hitUnit.hp = Math.max(0, hitUnit.hp - action.damage);
                if(action.isCritical) effectRenderer.addFloatingText(`-${action.damage}!`, targetX, targetY, 'crit');
                else effectRenderer.addFloatingText(`-${action.damage}`, targetX, targetY, 'normal');

                if(hitUnit.hp <= 0) audioManager.play('laser_death', 0.15);
            }
        }else if(action.hitObstacle){
            const realObstacle = this.game.objectmap.objects.find(o => Number(o.q) === Number(action.targetHex.q) && Number(o.r) === Number(action.targetHex.r));
            if(realObstacle){
                if(realObstacle.hp !== undefined) realObstacle.hp -= action.obstacleDamage;
                realObstacle.update = true;

                 if(action.isObstacleDestroyed){
                    this.game.objectmap.objects = this.game.objectmap.objects.filter(o => o !== realObstacle);
                    this.game.grid.nonspawn = this.game.grid.nonspawn.filter(n => Number(n.q) !== Number(action.targetHex.q) || Number(n.r) !== Number(action.targetHex.r));
                 }
            }
        }
    }
}