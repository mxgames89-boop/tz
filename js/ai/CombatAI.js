import { GAME_CONFIG } from '../config.js';

export class CombatAI {
  constructor(game) {
    this.game = game;

    // Защита от зависаний.
    // Бот не будет обходить всю карту в поиске укрытия.
    this.MAX_COVER_SEARCH_NODES = 180;
  }

  _init_planTurn() {
    if (!window.entities) return;

    window.entities.forEach(entity => {
      if (entity.type === 'enemy') {
        this.planTurn(entity);
      }
    });
  }

  planTurn(bot) {
    if (!bot || bot.type !== 'enemy' || bot.hp <= 0) return;

    this.prepareBotForPlanning(bot);

    const player = this.getPlayer();
    if (!player) return;

    const weaponConfig = GAME_CONFIG.weapons[bot.weapon];

    if (!weaponConfig) {
      console.warn(`[CombatAI]: У ${bot.name} нет оружия: ${bot.weapon}`);
      return;
    }

    const target = {
      id: player.id,
      name: player.name,
      plannedQ: Number(player.plannedQ),
      plannedR: Number(player.plannedR)
    };

    const isInCoverNow = this.hasAdjacentCover(bot.plannedQ, bot.plannedR);

    // 1. Если бот уже стоит рядом с любым укрытием —
    // просто стреляет, если хватает дальности.
    if (isInCoverNow) {
      console.log(`[CombatAI]: ${bot.name} уже рядом с укрытием.`);

      if (this.canShootByDistance(bot, target, weaponConfig)) {
        this.addShootBurst(bot, target, weaponConfig);
      } else {
        console.log(
          `[CombatAI]: ${bot.name} в укрытии, но цель вне дальности. ` +
          `Дистанция: ${this.getDistance(bot.plannedQ, bot.plannedR, target.plannedQ, target.plannedR)}, ` +
          `дальность оружия: ${weaponConfig.maxRange}`
        );
      }

      this.finishPlanning(bot);
      return;
    }

    // 2. Если бот НЕ в укрытии — ищем ближайшую свободную клетку рядом с любым объектом.
    // Без лучей, без оценки типа объекта, без флангов.
    const coverPosition = this.findNearestCoverPosition(bot, bot.currentAP);

    if (coverPosition && coverPosition.path.length > 0) {
      console.log(
        `[CombatAI]: ${bot.name} идёт к ближайшему укрытию ` +
        `${coverPosition.q},${coverPosition.r}. ` +
        `steps=${coverPosition.path.length}, moveCost=${coverPosition.moveCost}`
      );

      this.addMovePath(bot, coverPosition.path, target);

      // После движения стреляем только если хватает дальности и AP.
      if (this.canShootByDistance(bot, target, weaponConfig)) {
        this.addShootBurst(bot, target, weaponConfig);
      } else {
        console.log(
          `[CombatAI]: ${bot.name} занял укрытие, но не стреляет: ` +
          `цель вне дальности или не хватает AP.`
        );
      }

      this.finishPlanning(bot);
      return;
    }

    // 3. Если укрытия рядом в пределах AP нет — не зависаем.
    // Тогда стреляем с места, если хватает дальности.
    if (this.canShootByDistance(bot, target, weaponConfig)) {
      console.log(
        `[CombatAI]: ${bot.name} не нашёл укрытие в пределах AP. ` +
        `Стреляет с места.`
      );

      this.addShootBurst(bot, target, weaponConfig);
      this.finishPlanning(bot);
      return;
    }

    // 4. Если ни укрытия, ни дальности — просто идём ближе к игроку,
    // но без тяжёлых просчётов. Это запасное поведение.
    this.moveTowardTargetUntilRange(bot, target, weaponConfig);

    if (this.canShootByDistance(bot, target, weaponConfig)) {
      this.addShootBurst(bot, target, weaponConfig);
    }

    this.finishPlanning(bot);
  }

  prepareBotForPlanning(bot) {
    // Защита от повторного планирования:
    // очищаем старую очередь, чтобы бот не копил действия поверх действий.
    if (bot.actionQueue) {
      if (typeof bot.actionQueue.clear === 'function') {
        bot.actionQueue.clear();
      } else if (Array.isArray(bot.actionQueue.queue)) {
        bot.actionQueue.queue = [];
      }
    }

    bot.plannedQ = Number(bot.q);
    bot.plannedR = Number(bot.r);
    bot.plannedStepsCount = 0;

    if (typeof bot.startRoundAP === 'number') {
      bot.currentAP = bot.startRoundAP;
    }

    if (bot.updatePlannedScreenCoordinates) {
      bot.updatePlannedScreenCoordinates();
    }
  }

  finishPlanning(bot) {
    if (bot.updatePlannedScreenCoordinates) {
      bot.updatePlannedScreenCoordinates();
    }

    console.log(
      `[CombatAI]: План завершён для ${bot.name}. ` +
      `planned=${bot.plannedQ},${bot.plannedR}, AP=${bot.currentAP}`
    );
  }

  getPlayer() {
    if (!window.entities) return null;
    return window.entities.find(e => e.type === 'player' && e.hp > 0) || null;
  }

  findNearestCoverPosition(bot, moveBudget) {
    const coverSet = this.getCoverCellsSet();

    if (coverSet.size === 0) {
      return null;
    }

    const startQ = Number(bot.plannedQ);
    const startR = Number(bot.plannedR);

    if (this.hasAdjacentCover(startQ, startR, coverSet)) {
      return {
        q: startQ,
        r: startR,
        path: [],
        moveCost: 0
      };
    }

    const validSet = this.getValidCellsSet();
    const blockedSet = this.getBlockedSet(bot);

    const startKey = this.makeKey(startQ, startR);

    const queue = [{
      q: startQ,
      r: startR,
      path: [],
      moveCost: 0
    }];

    const bestCost = new Map();
    bestCost.set(startKey, 0);

    let queueIndex = 0;
    let checkedNodes = 0;

    while (
      queueIndex < queue.length &&
      checkedNodes < this.MAX_COVER_SEARCH_NODES
    ) {
      const current = queue[queueIndex++];
      checkedNodes++;

      const neighbors = this.game.grid.getHexNeighbors(current.q, current.r);

      for (const neighbor of neighbors) {
        const nQ = Number(neighbor.q);
        const nR = Number(neighbor.r);
        const key = this.makeKey(nQ, nR);

        if (!validSet.has(key)) continue;
        if (blockedSet.has(key)) continue;

        const nextStepNumber = bot.plannedStepsCount + current.path.length + 1;
        const stepCost = bot.getStepCostAP(nextStepNumber);
        const newCost = current.moveCost + stepCost;

        if (newCost > moveBudget) continue;

        if (bestCost.has(key) && bestCost.get(key) <= newCost) continue;

        const nextPath = [
          ...current.path,
          { q: nQ, r: nR }
        ];

        const candidate = {
          q: nQ,
          r: nR,
          path: nextPath,
          moveCost: newCost
        };

        if (this.hasAdjacentCover(nQ, nR, coverSet)) {
          console.log(
            `[CombatAI]: ближайшее укрытие найдено за ${checkedNodes} проверок.`
          );

          return candidate;
        }

        bestCost.set(key, newCost);
        queue.push(candidate);
      }
    }

    console.log(
      `[CombatAI]: укрытие не найдено. Проверено клеток: ${checkedNodes}.`
    );

    return null;
  }

  hasAdjacentCover(q, r, preparedCoverSet = null) {
    const coverSet = preparedCoverSet || this.getCoverCellsSet();

    if (coverSet.size === 0) return false;

    const neighbors = this.game.grid.getHexNeighbors(Number(q), Number(r));

    for (const neighbor of neighbors) {
      if (coverSet.has(this.makeKey(neighbor.q, neighbor.r))) {
        return true;
      }
    }

    return false;
  }

  getCoverCellsSet() {
    const result = new Set();

    const objects = this.game.objectmap?.objects || [];

    for (const obj of objects) {
      if (!obj) continue;
      if (obj.hp !== undefined && obj.hp <= 0) continue;

      // Любой живой объект считаем укрытием:
      // дерево, камень, стена, окно, пень и т.д.
      // Тип объекта и passability не анализируем.
      result.add(this.makeKey(obj.q, obj.r));
    }

    return result;
  }

  getValidCellsSet() {
    return new Set(
      this.game.grid.hexes.map(hex => this.makeKey(hex.q, hex.r))
    );
  }

  getBlockedSet(bot) {
    const blockedSet = new Set(
      this.game.grid.nonspawn.map(hex => this.makeKey(hex.q, hex.r))
    );

    if (window.entities) {
      window.entities.forEach(entity => {
        if (entity === bot) return;
        if (entity.hp <= 0) return;

        // Блокируем planned-позиции живых существ.
        blockedSet.add(this.makeKey(entity.plannedQ, entity.plannedR));
      });
    }

    return blockedSet;
  }

  addMovePath(bot, path, target) {
    let stepsPlanned = 0;

    for (const step of path) {
      const nextStepNumber = bot.plannedStepsCount + 1;
      const stepCost = bot.getStepCostAP(nextStepNumber);

      if (bot.currentAP < stepCost) {
        break;
      }

      bot.actionQueue.addMoveAction(step.q, step.r, 'idle', stepCost);

      bot.plannedStepsCount++;
      bot.plannedQ = Number(step.q);
      bot.plannedR = Number(step.r);
      stepsPlanned++;

      bot.lookAt(target.plannedQ, target.plannedR);
    }

    console.log(
      `[CombatAI]: ${bot.name} запланировал шагов: ${stepsPlanned}. ` +
      `Остаток AP: ${bot.currentAP}`
    );

    return stepsPlanned;
  }

  moveTowardTargetUntilRange(bot, target, weaponConfig) {
    const path = this.game.grid.findSmartPath(
      bot,
      target.plannedQ,
      target.plannedR
    );

    if (!path || path.length === 0) {
      bot.lookAt(target.plannedQ, target.plannedR);
      return 0;
    }

    let stepsPlanned = 0;

    for (const step of path) {
      // Не встаём прямо в клетку игрока.
      if (
        Number(step.q) === Number(target.plannedQ) &&
        Number(step.r) === Number(target.plannedR)
      ) {
        break;
      }

      // Если уже вошли в дальность — дальше не идём.
      const currentDistance = this.getDistance(
        bot.plannedQ,
        bot.plannedR,
        target.plannedQ,
        target.plannedR
      );

      if (currentDistance <= weaponConfig.maxRange) {
        break;
      }

      const nextStepNumber = bot.plannedStepsCount + 1;
      const stepCost = bot.getStepCostAP(nextStepNumber);

      if (bot.currentAP < stepCost) {
        break;
      }

      bot.actionQueue.addMoveAction(step.q, step.r, 'idle', stepCost);

      bot.plannedStepsCount++;
      bot.plannedQ = Number(step.q);
      bot.plannedR = Number(step.r);
      stepsPlanned++;

      bot.lookAt(target.plannedQ, target.plannedR);
    }

    console.log(
      `[CombatAI]: ${bot.name} идёт ближе к цели. ` +
      `Шагов: ${stepsPlanned}, AP: ${bot.currentAP}`
    );

    return stepsPlanned;
  }

  canShootByDistance(bot, target, weaponConfig) {
    if (!bot || !target || !weaponConfig) return false;
    if (bot.currentAP < weaponConfig.apCost) return false;

    const distance = this.getDistance(
      bot.plannedQ,
      bot.plannedR,
      target.plannedQ,
      target.plannedR
    );

    return distance <= weaponConfig.maxRange;
  }

  addShootBurst(bot, target, weaponConfig) {
    if (!weaponConfig || !weaponConfig.apCost) return 0;

    let shotsPlanned = 0;
    const maxShotsByAP = Math.floor(bot.currentAP / weaponConfig.apCost);

    for (let i = 0; i < maxShotsByAP; i++) {
      if (!this.canShootByDistance(bot, target, weaponConfig)) {
        break;
      }

      this.addShootAction(bot, target, weaponConfig);
      shotsPlanned++;
    }

    console.log(
      `[CombatAI]: ${bot.name} запланировал выстрелов: ${shotsPlanned}. ` +
      `Остаток AP: ${bot.currentAP}`
    );

    return shotsPlanned;
  }

  addShootAction(bot, target, weaponConfig) {
    // Стреляем по targetID.
    // targetQ / targetR остаются запасными координатами,
    // а TurnSimulator сможет взять текущие virtualQ / virtualR цели.
    bot.actionQueue.addShootAction(
      target.plannedQ,
      target.plannedR,
      weaponConfig.apCost,
      target.id
    );

    if (bot.state === 'crawl') {
      bot.skin = `crawl_${weaponConfig.category}`;
    } else {
      bot.skin = `idle_${weaponConfig.category}`;
    }

    bot.lookAt(target.plannedQ, target.plannedR);

    console.log(
      `[CombatAI]: ${bot.name} стреляет по ${target.name}. ` +
      `targetID=${target.id}, AP=${bot.currentAP}`
    );
  }

  getDistance(q1, r1, q2, r2) {
    return this.game.grid.getHexDistance(
      Number(q1),
      Number(r1),
      Number(q2),
      Number(r2)
    );
  }

  makeKey(q, r) {
    return `${Number(q)},${Number(r)}`;
  }
}