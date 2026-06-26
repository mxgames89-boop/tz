export class CombatAI {
    constructor(game) {
        this.game = game;
    }

    _init_planTurn(){
        if (window.entities) {
            window.entities.forEach(entity => {
                if (entity.type === 'enemy') this.planTurn(entity);
            });
        }
    }

    planTurn(bot) {
        if (!bot || bot.type !== 'enemy' || bot.hp <= 0) return;

        const player = window.entities ? window.entities.find(e => e.type === 'player') : null;
        if (!player) return;

        //if(distanceToPlayer = weaponConfig.apCost){
            //entity.actionQueue.addShootAction(player.plannedQ, player.plannedR, weaponConfig.apCost); 
            //console.log(`[CombatAI]: Враг [${entity.name}] запланировал ВЫСТРЕЛ по игроку в гекс ${player.plannedQ},${player.plannedR}. Потрачено ${weaponConfig.apCost} AP.`);
            //continue;
        //}

        // =========================================================================
        // УМНЫЙ ВЫБОР ЦЕЛИ: Ищем свободный гекс ВПЛОТНУЮ к игроку
        // =========================================================================
        const neighborsAroundPlayer = this.game.grid.getHexNeighbors(player.plannedQ, player.plannedR);
        const blockedSet = new Set(this.game.grid.nonspawn.map(hex => `${Number(hex.q)},${Number(hex.r)}`));
        
        let bestTargetHex = null;
        let minDistanceToBot = Infinity;

        neighborsAroundPlayer.forEach(neighbor => {
            const nKey = `${Number(neighbor.q)},${Number(neighbor.r)}`;
            if (blockedSet.has(nKey)) return;

            const exists = this.game.grid.hexes.some(h => Number(h.q) === Number(neighbor.q) && Number(h.r) === Number(neighbor.r));
            if (!exists) return;

            const dx = neighbor.q - bot.plannedQ;
            const dy = neighbor.r - bot.plannedR;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < minDistanceToBot) {
                minDistanceToBot = distance;
                bestTargetHex = neighbor;
            }
        });

        if (!bestTargetHex) {
            console.log(`[CombatAI]: Все клетки вокруг игрока заняты. Враг стоит на месте.`);
            return;
        }

        // 3. Строем путь в найденную свободную соседнюю клетку
        const fullPath = this.game.grid.findSmartPath(bot, bestTargetHex.q, bestTargetHex.r);
        
        // ВАЖНОЕ ИСПРАВЛЕНИЕ: findSmartPath уже возвращает путь, включая конечную точку, 
        // если она доступна. Метод push() здесь был лишним и дублировал гексы, ломая AP!
        if (fullPath.length === 0) {
            console.log(`[CombatAI]: Путь до соседней клетки игрока заблокирован стенками.`);
            return;
        }

        let stepsPlanned = 0;

        // 4. Забиваем шаги в очередь. Если на какой-то шаг AP не хватит — бот просто 
        // остановится на предыдущем гексе, а не сбросит весь ход в ноль!
        for (let i = 0; i < fullPath.length; i++) {
            const nextStep = fullPath[i];

            const currentStepNumber = bot.plannedStepsCount + 1;
            const stepCost = bot.getStepCostAP(currentStepNumber);

            if (bot.currentAP >= stepCost) {
                bot.actionQueue.addMoveAction(nextStep.q, nextStep.r, 'idle', stepCost);
                
                bot.plannedStepsCount++;
                stepsPlanned++;
                bot.plannedQ = nextStep.q;
                bot.plannedR = nextStep.r;
            } else {
                console.log(`[CombatAI]: Врагу не хватило AP на ${currentStepNumber}-й шаг (нужно ${stepCost} AP). Он пройдет только ${stepsPlanned} шагов.`);
                break; // Выходим из цикла, сохраняя все УЖЕ добавленные шаги!
            }
        }

        if (bot.updatePlannedScreenCoordinates) {
            bot.updatePlannedScreenCoordinates();
        }

        console.log(`[CombatAI]: Планирование завершено. Враг сделает шагов: ${stepsPlanned}. Остаток AP: ${bot.currentAP}`);
    }
}