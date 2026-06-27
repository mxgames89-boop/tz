import { GAME_CONFIG } from '../config.js';

export class CombatAI {
  constructor(game) {
    this.game = game;
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

    const player = window.entities
      ? window.entities.find(e => e.type === 'player' && e.hp > 0)
      : null;

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

    // 1. Если бот уже может стрелять по ПЛАНИРУЕМОЙ точке игрока — стреляет.
    if (this.canShootFrom(
      bot.plannedQ,
      bot.plannedR,
      target.plannedQ,
      target.plannedR,
      weaponConfig,
      bot
    )) {
      this.addShootBurst(bot, target, weaponConfig);
      return;
    }

    // 2. Ищем ближайшую клетку, с которой:
    // - хватает дальности оружия;
    // - есть линия огня;
    // - после движения останется AP хотя бы на 1 выстрел.
    let combatPosition = this.findReachableShootingPosition(bot, target, weaponConfig);

    // 3. Если в этот ход не можем выйти на линию огня,
    // ищем дальнюю фланговую позицию и начинаем обходить.
    if (!combatPosition) {
      combatPosition = this.findFutureFlankPosition(bot, target, weaponConfig);
    }

    if (combatPosition && combatPosition.path && combatPosition.path.length > 0) {
      this.addMovePath(bot, combatPosition.path, target);

      console.log(
        `[CombatAI]: ${bot.name} двигается на боевую позицию ` +
        `${combatPosition.q},${combatPosition.r}.`
      );
    }

    // 4. После движения ещё раз проверяем стрельбу по planned-точке игрока.
    if (this.canShootFrom(
      bot.plannedQ,
      bot.plannedR,
      target.plannedQ,
      target.plannedR,
      weaponConfig,
      bot
    )) {
      this.addShootBurst(bot, target, weaponConfig);
    } else {
      bot.lookAt(target.plannedQ, target.plannedR);
    }

    if (bot.updatePlannedScreenCoordinates) {
      bot.updatePlannedScreenCoordinates();
    }

    console.log(
      `[CombatAI]: План завершён для ${bot.name}. ` +
      `planned=${bot.plannedQ},${bot.plannedR}, AP=${bot.currentAP}`
    );
  }

  findReachableShootingPosition(bot, target, weaponConfig) {
    const shootAP = weaponConfig.apCost;

    if (bot.currentAP < shootAP) return null;

    // Важно: оставляем AP хотя бы на один выстрел.
    const moveBudget = bot.currentAP - shootAP;

    const reachable = this.getReachablePositionsWithPaths(bot, moveBudget);

    let best = null;
    let bestScore = Infinity;

    for (const position of reachable) {
      const distance = this.game.grid.getHexDistance(
        position.q,
        position.r,
        target.plannedQ,
        target.plannedR
      );

      if (distance > weaponConfig.maxRange) continue;

      const hasShot = this.canShootFrom(
        position.q,
        position.r,
        target.plannedQ,
        target.plannedR,
        weaponConfig,
        bot
      );

      if (!hasShot) continue;

      const optimalRange = weaponConfig.optimalRange || weaponConfig.maxRange;
      const rangePenalty = Math.abs(distance - optimalRange);

      // Главный приоритет — минимально пройти.
      // То есть бот подходит ровно настолько, насколько нужно для стрельбы.
      const score =
        position.moveCost * 1000 +
        rangePenalty * 10 +
        distance;

      if (score < bestScore) {
        bestScore = score;
        best = position;
      }
    }

    return best;
  }

  findFutureFlankPosition(bot, target, weaponConfig) {
    let best = null;
    let bestScore = Infinity;

    const currentDistance = this.game.grid.getHexDistance(
      bot.plannedQ,
      bot.plannedR,
      target.plannedQ,
      target.plannedR
    );

    for (const hex of this.game.grid.hexes) {
      const q = Number(hex.q);
      const r = Number(hex.r);

      if (!this.isHexFreeForBot(q, r, bot)) continue;

      const distanceToTarget = this.game.grid.getHexDistance(
        q,
        r,
        target.plannedQ,
        target.plannedR
      );

      if (distanceToTarget > weaponConfig.maxRange) continue;

      const hasShot = this.canShootFrom(
        q,
        r,
        target.plannedQ,
        target.plannedR,
        weaponConfig,
        bot
      );

      if (!hasShot) continue;

      const path = this.game.grid.findSmartPath(bot, q, r);

      if (!path || path.length === 0) continue;

      const optimalRange = weaponConfig.optimalRange || weaponConfig.maxRange;
      const rangePenalty = Math.abs(distanceToTarget - optimalRange);

      // Это уже не позиция "куда дойти прямо сейчас",
      // а направление для флангового обхода.
      const score =
        path.length * 100 +
        rangePenalty * 5 +
        Math.max(0, currentDistance - distanceToTarget);

      if (score < bestScore) {
        bestScore = score;
        best = {
          q,
          r,
          path,
          moveCost: null,
          isFutureFlank: true
        };
      }
    }

    if (best) {
      console.log(
        `[CombatAI]: ${bot.name} не видит цель напрямую. ` +
        `Выбрана фланговая позиция ${best.q},${best.r}.`
      );
    }

    return best;
  }

  getReachablePositionsWithPaths(bot, moveBudget) {
    const result = [];

    const startQ = Number(bot.plannedQ);
    const startR = Number(bot.plannedR);
    const startKey = `${startQ},${startR}`;

    const validHexesSet = new Set(
      this.game.grid.hexes.map(hex => `${Number(hex.q)},${Number(hex.r)}`)
    );

    const blockedSet = this.getBlockedSet(bot);

    const queue = [{
      q: startQ,
      r: startR,
      path: [],
      moveCost: 0
    }];

    const bestCost = new Map();
    bestCost.set(startKey, 0);

    while (queue.length > 0) {
      const current = queue.shift();

      result.push({
        q: current.q,
        r: current.r,
        path: current.path,
        moveCost: current.moveCost
      });

      const neighbors = this.game.grid.getHexNeighbors(current.q, current.r);

      for (const neighbor of neighbors) {
        const nQ = Number(neighbor.q);
        const nR = Number(neighbor.r);
        const key = `${nQ},${nR}`;

        if (!validHexesSet.has(key)) continue;
        if (blockedSet.has(key)) continue;

        const nextStepNumber = bot.plannedStepsCount + current.path.length + 1;
        const stepCost = bot.getStepCostAP(nextStepNumber);
        const newCost = current.moveCost + stepCost;

        if (newCost > moveBudget) continue;

        if (bestCost.has(key) && bestCost.get(key) <= newCost) continue;

        bestCost.set(key, newCost);

        queue.push({
          q: nQ,
          r: nR,
          path: [...current.path, { q: nQ, r: nR }],
          moveCost: newCost
        });
      }
    }

    return result;
  }

  addMovePath(bot, path, target) {
    let stepsPlanned = 0;

    for (const nextStep of path) {
      const currentStepNumber = bot.plannedStepsCount + 1;
      const stepCost = bot.getStepCostAP(currentStepNumber);

      if (bot.currentAP < stepCost) {
        console.log(
          `[CombatAI]: ${bot.name} не хватило AP на шаг. ` +
          `Нужно ${stepCost}, есть ${bot.currentAP}.`
        );
        break;
      }

      bot.actionQueue.addMoveAction(nextStep.q, nextStep.r, 'idle', stepCost);

      bot.plannedStepsCount++;
      stepsPlanned++;

      bot.plannedQ = Number(nextStep.q);
      bot.plannedR = Number(nextStep.r);

      bot.lookAt(target.plannedQ, target.plannedR);
    }

    console.log(
      `[CombatAI]: ${bot.name} запланировал шагов: ${stepsPlanned}. ` +
      `Остаток AP: ${bot.currentAP}`
    );

    return stepsPlanned;
  }

  canShootFrom(fromQ, fromR, targetQ, targetR, weaponConfig, bot) {
    if (!weaponConfig) return false;
    if (bot.currentAP < weaponConfig.apCost) return false;

    const distance = this.game.grid.getHexDistance(
      Number(fromQ),
      Number(fromR),
      Number(targetQ),
      Number(targetR)
    );

    if (distance > weaponConfig.maxRange) return false;

    return this.hasLineOfFire(
      Number(fromQ),
      Number(fromR),
      Number(targetQ),
      Number(targetR),
      weaponConfig,
      bot
    );
  }

  hasLineOfFire(fromQ, fromR, targetQ, targetR, weaponConfig, bot) {
    let ray = this.game.grid.traceBulletRay(fromQ, fromR, targetQ, targetR);

    if (!ray || ray.length === 0) return false;

    if (ray.length > weaponConfig.maxRange) {
      ray = ray.slice(0, weaponConfig.maxRange);
    }

    const targetKey = `${Number(targetQ)},${Number(targetR)}`;
    const shooterKey = `${Number(fromQ)},${Number(fromR)}`;

    for (const hex of ray) {
      const key = `${Number(hex.q)},${Number(hex.r)}`;

      if (key === shooterKey) continue;

      if (key === targetKey) {
        return true;
      }

      const obstacle = this.game.objectmap?.objects?.find(o =>
        Number(o.q) === Number(hex.q) &&
        Number(o.r) === Number(hex.r) &&
        (o.hp === undefined || o.hp > 0)
      );

      if (obstacle) {
        const passability = obstacle.passability !== undefined
          ? obstacle.passability
          : 100;

        // 100 = глухое укрытие/стена.
        // Если цель за такой преградой, бот должен искать фланг.
        if (passability >= 100) {
          return false;
        }
      }
    }

    return false;
  }

  addShootBurst(bot, target, weaponConfig) {
    if (!weaponConfig || !weaponConfig.apCost) return 0;

    let shotsPlanned = 0;

    // modes не используем.
    // Просто одиночные выстрелы, пока хватает AP.
    const maxShotsByAP = Math.floor(bot.currentAP / weaponConfig.apCost);

    for (let i = 0; i < maxShotsByAP; i++) {
      if (!this.canShootFrom(
        bot.plannedQ,
        bot.plannedR,
        target.plannedQ,
        target.plannedR,
        weaponConfig,
        bot
      )) {
        break;
      }

      this.addShootAction(bot, target, weaponConfig);
      shotsPlanned++;
    }

    console.log(
      `[CombatAI]: ${bot.name} запланировал одиночных выстрелов: ${shotsPlanned}. ` +
      `Остаток AP: ${bot.currentAP}`
    );

    return shotsPlanned;
  }

  addShootAction(bot, target, weaponConfig) {
    // ВАЖНО:
    // Стреляем именно в planned-точку игрока.
    // Поэтому targetID передаём null, иначе TurnSimulator может перенацелиться
    // на текущую virtual-позицию сущности во время проигрывания хода.
    bot.actionQueue.addShootAction(
      target.plannedQ,
      target.plannedR,
      weaponConfig.apCost,
      null
    );

    if (bot.state === 'crawl') {
      bot.skin = `crawl_${weaponConfig.category}`;
    } else {
      bot.skin = `idle_${weaponConfig.category}`;
    }

    bot.lookAt(target.plannedQ, target.plannedR);

    console.log(
      `[CombatAI]: ${bot.name} стреляет по planned-точке игрока ` +
      `${target.plannedQ},${target.plannedR}. ` +
      `Потрачено ${weaponConfig.apCost} AP. Остаток AP: ${bot.currentAP}`
    );
  }

  getBlockedSet(bot) {
    const blockedSet = new Set(
      this.game.grid.nonspawn.map(hex => `${Number(hex.q)},${Number(hex.r)}`)
    );

    if (window.entities) {
      window.entities.forEach(entity => {
        if (entity === bot) return;
        if (entity.hp <= 0) return;

        // Блокируем planned-позиции, а не стартовые.
        blockedSet.add(`${Number(entity.plannedQ)},${Number(entity.plannedR)}`);
      });
    }

    return blockedSet;
  }

  isHexFreeForBot(q, r, bot) {
    const key = `${Number(q)},${Number(r)}`;

    const validHexesSet = new Set(
      this.game.grid.hexes.map(hex => `${Number(hex.q)},${Number(hex.r)}`)
    );

    if (!validHexesSet.has(key)) return false;

    const blockedSet = this.getBlockedSet(bot);

    return !blockedSet.has(key);
  }
}