import { GAME_CONFIG } from '../config.js';

export class TurnSimulator {
    constructor(game) {
        this.game = game;
    }

    calculateRoundScript(entities) {
        if (!entities || entities.length === 0) return [];

        const tempMap = {};
        const globalTimeline = [];
        let maxRoundAP = 0;
        let apnext = 0;
        let coefficient = 1;

        //Виртуальные переменные объектов
        if(this.game.grid && this.game.objectmap.objects){
            this.game.objectmap.objects.forEach(obj => {
                obj.virtualHp = obj.hp !== undefined ? obj.hp : GAME_CONFIG.objectmap.wall.hp;
            });
        }

        // 1. Находим максимальный потенциал ОД для вычисления коэффициентов
        entities.forEach(e => {
            if(e.startRoundAP > maxRoundAP) maxRoundAP = e.startRoundAP;
            //Виртуальные переменные существ
            e.virtualHp = e.hp;
            e.virtualQ = e.plannedQ;
            e.virtualR = e.plannedR;
            e.skin = e.startskin;
            e.state = e.startstate;
        });

        // 2. Распределяем действия по тикам
        entities.forEach(e => {
            let apnext = 0;
            let apreal = 0;
            e.actionQueue.queue.forEach((q, i) => {
                
                coefficient = e.startRoundAP / maxRoundAP;

                apreal += q.apCost;
                apnext += this.getTickCost(q.type, coefficient, i, q.state, q.apCost);

                const targetTick = Math.round(apnext);

                globalTimeline.push({
                    tick: targetTick,
                    entityId: e.id,
                    coefficient: coefficient,
                    action: q
                });
            });
            e.actionQueue.queue = [];
        });

        //Сортируем по времени тика
        globalTimeline.sort((a, b) => a.tick - b.tick);

        let actionResult;

        //Запускаем массив действий и превращаем его в сценарий для анимации
        if(globalTimeline){
            for(const event of globalTimeline){
                const actor = entities.find(e => e.id === event.entityId);

                // Проверка безопасности: если персонаж не найден или уже погиб на прошлых тиках
                if (!actor || actor.virtualHp <= 0) {
                    continue; // Пропускаем это действие и идем к следующему
                }

                if(event.action.type == 'move') actionResult = this.actionMove(event.action, event.tick, event.coefficient, actor);
                if(event.action.type == 'switch') actionResult = this.actionChange(event.action, event.tick, event.coefficient);
                if(event.action.type == 'shoot') actionResult = this.actionShoot(event.action, event.tick, event.coefficient, actor);

                if(!actionResult) continue;

                // Инициализируем структуру для сущности, если её ещё нет
                if (!tempMap[actor.id]) {
                    tempMap[actor.id] = {
                        id: actor.id,
                        timeline: [] // Сюда будут складываться действия конкретно этого персонажа
                    };
                }

                tempMap[actor.id].timeline.push(actionResult);

                // На всякий случай сортируем таймлайн персонажа по тикам
                tempMap[actor.id].timeline.sort((a, b) => a.tick - b.tick);
            }
        }

        const playbackScript = Object.values(tempMap);

        console.log(playbackScript);

        return playbackScript;
    }

    //Получить количество тиков за действие
    getTickCost(type, coefficient, i, state, ap = 1){
        let cost = 0;
        let costAction = 0;

        if(type == 'move'){
            if(state == 'run') cost = 17;
            if(state == 'idle') cost = 34;
        } 
        if(type == 'change') cost = 17;
        if(type == 'shoot') cost = 3 * ap;

        //if(i == 0){
            //if(type == 'move'){
               // if(coefficient < 1) cost = costAction - costAction * coefficient;
                //return cost;
           // }
      //  }

        //if(coefficient < 1) cost = costAction + costAction * coefficient;
       // else cost = costAction / coefficient;

        return cost;
    }

    //Сценарий для передвижения
    actionMove(action, tick, coefficient, actor){
        let result = {};
        let skin = 'idle';

        if(action.state == 'idle') skin = 'idle';
        if(action.state == 'run') skin = 'run';

        actor.virtualQ = action.q;
        actor.virtualR = action.r;
        result = {"tick": tick, "type": "position_change", "state": action.state, "skin": skin, "q": action.q, "r": action.r, "ap": action.apCost, "speed": coefficient};
        return result;
    }

    //Сценарий для смены режима передвижения
    actionChange(action, tick, coefficient){
        let result = {};
        let skin = 'idle';

        if(action.state == 'idle') skin = 'idle';
        if(action.state == 'run') skin = 'run';
        if(action.state == 'crawl') skin = 'crawl';
        if(action.state == 'cover') skin = 'cover';

        result = {"tick": tick, "type": "state_change", "state": action.state, "skin": skin, "ap": action.apCost, "speed": coefficient};
        return result;
    }

    //Сценарий для стрельбы
    actionShoot(action, tick, coefficient, entity){

        let result = {};

        const weaponConfig = GAME_CONFIG.weapons[entity.weapon];
        let accuracy = weaponConfig.accuracy;
        
        const startQ = entity.virtualQ;
        const startR = entity.virtualR;
        let targetQ = action.targetQ;
        let targetR = action.targetR;

        if(action.targetID){
            const enemy = window.entities.find(e => e.id === action.targetID);
            targetQ = enemy.virtualQ;
            targetR = enemy.virtualR;

            if(enemy.virtualHp <= 0) return;
        }

        //Проверяем дистанцию стрельбы
        const fullDistance = this.game.grid.getShootDistance(startQ, startR, targetQ, targetR);

        //ЗАПУСКАЕМ ТРАССИРОВКУ ЛУЧА ПУЛИ КЛЕТКА ЗА КЛЕТКОЙ
        let bulletRay = this.game.grid.traceBulletRay(startQ, startR, targetQ, targetR);
        const limitedBulletRay = this.game.grid.limitBulletRayByShootRange(startQ, startR, bulletRay, weaponConfig.maxRange);

        if(limitedBulletRay.length < bulletRay.length){
          bulletRay = limitedBulletRay;

          const lastValidHex = bulletRay[bulletRay.length - 1];

          if (lastValidHex) {
            targetQ = lastValidHex.q;
            targetR = lastValidHex.r;
          }
        }

        let finalTargetQ = targetQ;
        let finalTargetR = targetR;
        let hitEntity = null;
        let hitObstacleObj = null;
        let distanceToHit = fullDistance;

        const blockedSet = new Set(this.game.grid.nonspawn.map(hex => `${Number(hex.q)},${Number(hex.r)}`));

        // Пробегаемся по пути полета пули
        for (let i = 0; i < bulletRay.length; i++) {
            const currentHex = bulletRay[i];

            // Проверяем, не врезалась ли пуля в забор или камень (статический объект)
            const obstacle = this.game.objectmap.objects.find(o =>  Number(o.q) === Number(currentHex.q) &&  Number(o.r) === Number(currentHex.r));
            
            if(obstacle && obstacle.virtualHp > 0){
                distanceToHit = this.game.grid.getShootDistance(startQ, startR, currentHex.q, currentHex.r);

                if(distanceToHit <= 1 && obstacle.passability != 100) {
                    console.log(`[TurnSimulator]: Стрелок вплотную к объекту (${currentHex.q},${currentHex.r}). Пуля пролетает насквозь по правилу упора.`);
                    continue; 
                }

                const blockChance = (obstacle.passability !== undefined ? obstacle.passability : 100) / 100;
                const diceRoll = Math.random();

                if(diceRoll <= blockChance){
                    finalTargetQ = currentHex.q;
                    finalTargetR = currentHex.r;
                    hitObstacleObj = obstacle;
                    break;
                }
            }

            //Проверяем, не пробегает ли пуля через виртуальное тело ЛЮБОГО персонажа в памяти
            const foundUnit = entities.find(e =>  e.id !== entity.id && Number(e.virtualQ) === Number(currentHex.q) &&  Number(e.virtualR) === Number(currentHex.r) && e.hp > 0);

            if(foundUnit){
                finalTargetQ = currentHex.q;
                finalTargetR = currentHex.r;
                hitEntity = foundUnit;
                distanceToHit = this.game.grid.getShootDistance(startQ, startR, currentHex.q, currentHex.r);
                break; // Пуля попала в живое существо и остановилась!
            }
        }

        // ПРОВЕРКА УРОНА ПО СТЕНЕ:
        let isObstacleDestroyed = false;
        let damageToObstacle = 0;

        if (hitObstacleObj) {
            damageToObstacle = weaponConfig.baseDamage + Math.floor(Math.random() * (weaponConfig.spread * 2)) - weaponConfig.spread;
            hitObstacleObj.virtualHp = Math.max(0, hitObstacleObj.virtualHp - damageToObstacle);
            if (hitObstacleObj.virtualHp <= 0) {
                isObstacleDestroyed = true;
            }
        }

        let isHit = false;
        let isCritical = false;
        let calculatedDamage = 0;

        if(hitEntity){
            const roll = Math.random();
            
            if(distanceToHit > weaponConfig.maxRange) accuracy = 0;
            
            isHit = roll <= accuracy;

            if(isHit){
                calculatedDamage = weaponConfig.baseDamage + Math.floor(Math.random() * (weaponConfig.spread * 2)) - weaponConfig.spread;
                // РЕЖЕМ УРОН В ЗАВИСИМОСТИ ОТ ДАЛЬНОСТИ:
                if (distanceToHit > weaponConfig.optimalRange) {
                    const penaltyHexes = distanceToHit - weaponConfig.optimalRange;
                    const totalDamageDrop = penaltyHexes * weaponConfig.damageDropPerHex;
                    calculatedDamage = Math.max(2, calculatedDamage - totalDamageDrop);
                }

                const critRoll = Math.random();
                if(critRoll <= weaponConfig.critChance) {
                    isCritical = true;
                    calculatedDamage = Math.floor(calculatedDamage * weaponConfig.critMultiplier);
                }

                hitEntity.virtualHp = Math.max(0, hitEntity.virtualHp - calculatedDamage);
            }
        }

        result = {"tick": tick, "type": "shoot", 'attackerID': entity.id, 'targetID': hitEntity ? hitEntity.id : null, 'targetHex': {'q': finalTargetQ, 'r': finalTargetR }, 'isHit': isHit, 'isCritical': isCritical, 'damage': calculatedDamage, 'hitObstacle': hitObstacleObj ? true : false, 'obstacleDamage': damageToObstacle, 'isObstacleDestroyed': isObstacleDestroyed, 'gun': weaponConfig};
        return result;
    }
}
