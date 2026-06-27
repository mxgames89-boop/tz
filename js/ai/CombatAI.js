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

    this.prepareBotForPlanning(bot);

    const player = window.entities
      ? window.entities.find(e => e.type === 'player' && e.hp > 0)
      : null;

    if (!player) return;

    const weaponConfig = GAME_CONFIG.weapons[bot.weapon];

    if (!weaponConfig) {
      console.warn(`[CombatAI]: У ${bot.name} нет корректного оружия: ${bot.weapon}`);
      return;
    }

    const target = {
      id: player.id,
      name: player.name,
      plannedQ: Number(player.plannedQ),
      plannedR: Number(player.plannedR)
    };

    const canShootNow = this.canShootFrom(
      bot.plannedQ,
      bot.plannedR,
      target.plannedQ,
      target.plannedR,
      weaponConfig,
      bot
    );

    const coverNow = this.getCoverInfoAt(
      bot.plannedQ,
      bot.plannedR,
      target.plannedQ,
      target.plannedR
    );

    // 1. Если бот уже стоит за укрытием и может стрелять — стреляет.
    if (canShootNow && coverNow) {
      console.log(
        `[CombatAI]: ${bot.name} уже в укрытии за ${coverNow.object.type}. Стреляет.`
      );

      this.addShootBurst(bot, target, weaponConfig);
      this.finishPlanning(bot);
      return;
    }

    // 2. Если бот в открытую — НЕ стреляем сразу.
    // Сначала ищем укрытие, из которого можно стрелять в этот же ход.
    if (!coverNow) {
      const coverAndShootPosition = this.findBestCoverPosition(
        bot,
        target,
        weaponConfig,
        {
          reserveAPForShot: true,
          requireCanShoot: true
        }
      );

      if (coverAndShootPosition && coverAndShootPosition.path.length > 0) {
        console.log(
          `[CombatAI]: ${bot.name} уходит с открытой позиции в укрытие ` +
          `${coverAndShootPosition.q},${coverAndShootPosition.r}, затем стреляет.`
        );

        this.addMovePath(bot, coverAndShootPosition.path, target);

        if (this.canShootFrom(
          bot.plannedQ,
          bot.plannedR,
          target.plannedQ,
          target.plannedR,
          weaponConfig,
          bot
        )) {
          this.addShootBurst(bot, target, weaponConfig);
        }

        this.finishPlanning(bot);
        return;
      }

      // 3. Если не хватает AP на "дойти + выстрелить",
      // ищем укрытие, куда можно просто добежать.
      // Это ключевое изменение: бот больше не обязан стрелять с открытого места.
      const coverOnlyPosition = this.findBestCoverPosition(
        bot,
        target,
        weaponConfig,
        {
          reserveAPForShot: false,
          requireCanShoot: true
        }
      );

      if (coverOnlyPosition && coverOnlyPosition.path.length > 0) {
        console.log(
          `[CombatAI]: ${bot.name} не успевает дойти и выстрелить, ` +
          `поэтому просто занимает укрытие ${coverOnlyPosition.q},${coverOnlyPosition.r}.`
        );

        this.addMovePath(bot, coverOnlyPosition.path, target);
        this.finishPlanning(bot);
        return;
      }
    }

    // 4. Если укрытий нет, но стрелять можно — стреляем с места.
    if (canShootNow) {
      console.log(
        `[CombatAI]: ${bot.name} не нашёл доступного укрытия. Стреляет с текущей позиции.`
      );

      this.addShootBurst(bot, target, weaponConfig);
      this.finishPlanning(bot);
      return;
    }

    // 5. Если стрелять нельзя — ищем обычную позицию для стрельбы.
    const reachableShootingPosition = this.findReachableShootingPosition(
      bot,
      target,
      weaponConfig,
      { requireCover: false }
    );

    if (
      reachableShootingPosition &&
      reachableShootingPosition.path &&
      reachableShootingPosition.path.length > 0
    ) {
      this.addMovePath(bot, reachableShootingPosition.path, target);

      if (this.canShootFrom(
        bot.plannedQ,
        bot.plannedR,
        target.plannedQ,
        target.plannedR,
        weaponConfig,
        bot
      )) {
        this.addShootBurst(bot, target, weaponConfig);
      }

      this.finishPlanning(bot);
      return;
    }

    // 6. Если прямой позиции нет — ищем фланг.
    const flankPosition = this.findFutureFlankPosition(bot, target, weaponConfig);

    if (flankPosition && flankPosition.path && flankPosition.path.length > 0) {
      this.addMovePath(bot, flankPosition.path, target);
      this.finishPlanning(bot);
      return;
    }

    bot.lookAt(target.plannedQ, target.plannedR);
    this.finishPlanning(bot);
  }

  prepareBotForPlanning(bot) {
    // Защита от двойного планирования.
    // Если _init_planTurn случайно вызовется несколько раз,
    // бот не должен накопить старые действия поверх новых.
    if (bot.actionQueue && Array.isArray(bot.actionQueue.queue)) {
      bot.actionQueue.queue = [];
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

  findReachableShootingPosition(bot, target, weaponConfig, options = {}) {
    const requireCover = options.requireCover || false;
    const shootAP = weaponConfig.apCost;

    if (bot.currentAP < shootAP) return null;

    // Оставляем AP хотя бы на один выстрел.
    const moveBudget = bot.currentAP - shootAP;

    const reachable = this.getReachablePositionsWithPaths(bot, moveBudget);

    let bestCover = null;
    let bestCoverScore = Infinity;

    let bestOpen = null;
    let bestOpenScore = Infinity;

    for (const position of reachable) {
      const distance = this.game.grid.getHexDistance(
        position.q,
        position.r,
        target.plannedQ,
        target.plannedR
      );

      if (distance > weaponConfig.maxRange) continue;

      const hasShot = this.canShootGeometryFrom(
        position.q,
        position.r,
        target.plannedQ,
        target.plannedR,
        weaponConfig
      );

      if (!hasShot) continue;

      const coverInfo = this.getCoverInfoAt(
        position.q,
        position.r,
        target.plannedQ,
        target.plannedR
      );

      if (requireCover && !coverInfo) continue;

      const optimalRange = weaponConfig.optimalRange || weaponConfig.maxRange;
      const rangePenalty = Math.abs(distance - optimalRange);

      // Главный приоритет — минимально пройти.
      // Так бот подходит ровно настолько, насколько нужно для стрельбы.
      const baseScore =
        position.moveCost * 1000 +
        rangePenalty * 20 +
        distance * 5;

      if (coverInfo) {
        // Чем выше passability у мягкого укрытия,
        // тем выше шанс, что оно поймает входящую пулю.
        const coverBonus = coverInfo.coverScore * 80;

        // Позиция, где укрытие работает и для защиты, и для выстрела, лучше.
        const twoWayCoverBonus =
          coverInfo.protectsBot && coverInfo.letsBotShootByStopRule
            ? 1000
            : 0;

        const score = baseScore - coverBonus - twoWayCoverBonus;

        if (score < bestCoverScore) {
          bestCoverScore = score;
          bestCover = {
            ...position,
            coverInfo
          };
        }
      } else {
        const score = baseScore + 5000;

        if (score < bestOpenScore) {
          bestOpenScore = score;
          bestOpen = position;
        }
      }
    }

    if (bestCover) {
      console.log(
        `[CombatAI]: найдена позиция в укрытии ${bestCover.q},${bestCover.r} ` +
        `за объектом ${bestCover.coverInfo.object.type} ` +
        `${bestCover.coverInfo.coverQ},${bestCover.coverInfo.coverR}.`
      );

      return bestCover;
    }

    if (requireCover) {
      return null;
    }

    return bestOpen;
  }

  findFutureFlankPosition(bot, target, weaponConfig) {
    let bestCover = null;
    let bestCoverScore = Infinity;

    let bestOpen = null;
    let bestOpenScore = Infinity;

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

      const hasShot = this.canShootGeometryFrom(
        q,
        r,
        target.plannedQ,
        target.plannedR,
        weaponConfig
      );

      if (!hasShot) continue;

      const path = this.game.grid.findSmartPath(bot, q, r);

      if (!path || path.length === 0) continue;

      const coverInfo = this.getCoverInfoAt(
        q,
        r,
        target.plannedQ,
        target.plannedR
      );

      const optimalRange = weaponConfig.optimalRange || weaponConfig.maxRange;
      const rangePenalty = Math.abs(distanceToTarget - optimalRange);

      const baseScore =
        path.length * 100 +
        rangePenalty * 20 +
        distanceToTarget * 5;

      if (coverInfo) {
        const coverBonus = coverInfo.coverScore * 100;
        const twoWayCoverBonus =
          coverInfo.protectsBot && coverInfo.letsBotShootByStopRule
            ? 1000
            : 0;

        const score = baseScore - coverBonus - twoWayCoverBonus;

        if (score < bestCoverScore) {
          bestCoverScore = score;
          bestCover = {
            q,
            r,
            path,
            coverInfo,
            isFutureFlank: true
          };
        }
      } else {
        const score = baseScore + 4000;

        if (score < bestOpenScore) {
          bestOpenScore = score;
          bestOpen = {
            q,
            r,
            path,
            isFutureFlank: true
          };
        }
      }
    }

    if (bestCover) {
      console.log(
        `[CombatAI]: выбрана фланговая позиция в укрытии ` +
        `${bestCover.q},${bestCover.r} за ${bestCover.coverInfo.object.type}.`
      );

      return bestCover;
    }

    if (bestOpen) {
      console.log(
        `[CombatAI]: укрытие не найдено, выбрана открытая фланговая позиция ` +
        `${bestOpen.q},${bestOpen.r}.`
      );
    }

    return bestOpen;
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
    if (!bot) return false;
    if (bot.currentAP < weaponConfig.apCost) return false;

    return this.canShootGeometryFrom(
      fromQ,
      fromR,
      targetQ,
      targetR,
      weaponConfig
    );
  }

  canShootGeometryFrom(fromQ, fromR, targetQ, targetR, weaponConfig) {
    if (!weaponConfig) return false;

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
      weaponConfig
    );
  }

  hasLineOfFire(fromQ, fromR, targetQ, targetR, weaponConfig) {
    let ray = this.game.grid.traceBulletRay(fromQ, fromR, targetQ, targetR);

    if (!ray || ray.length === 0) return false;

    if (ray.length > weaponConfig.maxRange) {
      ray = ray.slice(0, weaponConfig.maxRange);
    }

    const shooterKey = `${Number(fromQ)},${Number(fromR)}`;
    const targetKey = `${Number(targetQ)},${Number(targetR)}`;

    for (const hex of ray) {
      const key = `${Number(hex.q)},${Number(hex.r)}`;

      if (key === shooterKey) continue;

      if (key === targetKey) {
        return true;
      }

      const obstacle = this.getObjectAt(hex.q, hex.r);

      if (obstacle) {
        const passability = this.getObjectPassability(obstacle);

        // 100 = глухая стена. Через неё ИИ не считает выстрел возможным.
        if (passability >= 100) {
          return false;
        }

        // Мягкие укрытия не запрещают стрелять.
        // Попадание в них уже рассчитывает TurnSimulator.
        continue;
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
    // ИИ принимает решение по plannedQ/plannedR игрока,
    // но сам выстрел передаём через targetID.
    // Тогда TurnSimulator в момент выстрела возьмёт virtualQ/virtualR цели.
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
      `[CombatAI]: ${bot.name} стреляет по цели ${target.name}, ` +
      `targetID=${target.id}. ` +
      `Плановая точка цели: ${target.plannedQ},${target.plannedR}. ` +
      `Потрачено ${weaponConfig.apCost} AP. Остаток AP: ${bot.currentAP}`
    );
  }

  getCoverInfoAt(botQ, botR, targetQ, targetR) {
    // Проверяем защиту бота:
    // если игрок стреляет в бота, должен встретиться мягкий объект перед ботом.
    const incomingCover = this.getAdjacentSoftCoverOnRay(
      targetQ,
      targetR,
      botQ,
      botR,
      botQ,
      botR
    );

    if (!incomingCover) {
      return null;
    }

    // Проверяем, сможет ли бот сам стрелять через этот объект по правилу упора.
    const outgoingCover = this.getAdjacentSoftCoverOnRay(
      botQ,
      botR,
      targetQ,
      targetR,
      botQ,
      botR
    );

    return {
      ...incomingCover,
      protectsBot: true,
      letsBotShootByStopRule: !!outgoingCover,
      coverScore:
        incomingCover.passability +
        50 +
        (outgoingCover ? 50 : 0)
    };
  }

  getAdjacentSoftCoverOnRay(rayStartQ, rayStartR, rayEndQ, rayEndR, coveredQ, coveredR) {
    const ray = this.game.grid.traceBulletRay(
      Number(rayStartQ),
      Number(rayStartR),
      Number(rayEndQ),
      Number(rayEndR)
    );

    if (!ray || ray.length === 0) return null;

    const coveredKey = `${Number(coveredQ)},${Number(coveredR)}`;

    for (const hex of ray) {
      const key = `${Number(hex.q)},${Number(hex.r)}`;

      if (key === coveredKey) {
        return null;
      }

      const obj = this.getObjectAt(hex.q, hex.r);

      if (!obj) continue;

      const passability = this.getObjectPassability(obj);

      // 100 = глухая стена.
      // Это не мягкое укрытие для стрельбы из-за объекта.
      if (passability >= 100) {
        return null;
      }

      if (passability <= 0) {
        continue;
      }

      const distanceToCovered = this.game.grid.getHexDistance(
        Number(coveredQ),
        Number(coveredR),
        Number(obj.q),
        Number(obj.r)
      );

      // Объект должен быть прямо рядом с ботом.
      if (distanceToCovered <= 1) {
        return {
          object: obj,
          passability,
          coverScore: passability,
          coverQ: Number(obj.q),
          coverR: Number(obj.r)
        };
      }

      // Если первый объект на линии далеко от бота,
      // это не личное укрытие бота.
      return null;
    }

    return null;
  }
  
  getObjectAt(q, r) {
    return this.game.objectmap?.objects?.find(o =>
      Number(o.q) === Number(q) &&
      Number(o.r) === Number(r) &&
      (o.hp === undefined || o.hp > 0)
    );
  }

  getObjectPassability(obj) {
    if (!obj) return 100;
    return obj.passability !== undefined ? obj.passability : 100;
  }

  getBlockedSet(bot) {
    const blockedSet = new Set(
      this.game.grid.nonspawn.map(hex => `${Number(hex.q)},${Number(hex.r)}`)
    );

    if (window.entities) {
      window.entities.forEach(entity => {
        if (entity === bot) return;
        if (entity.hp <= 0) return;

        // Блокируем planned-позиции, а не только стартовые.
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

  findBestCoverPosition(bot, target, weaponConfig, options = {}) {
    const reserveAPForShot = options.reserveAPForShot || false;
    const requireCanShoot = options.requireCanShoot !== false;

    const reservedAP = reserveAPForShot ? weaponConfig.apCost : 0;
    const moveBudget = bot.currentAP - reservedAP;

    if (moveBudget < 0) return null;

    const reachable = this.getReachablePositionsWithPaths(bot, moveBudget);

    let best = null;
    let bestScore = Infinity;

    for (const position of reachable) {
      // Не выбираем текущую клетку, если бот уже стоит в открытую.
      if (position.path.length === 0) continue;

      const coverInfo = this.getCoverInfoAt(
        position.q,
        position.r,
        target.plannedQ,
        target.plannedR
      );

      if (!coverInfo) continue;

      const distance = this.game.grid.getHexDistance(
        position.q,
        position.r,
        target.plannedQ,
        target.plannedR
      );

      if (distance > weaponConfig.maxRange) continue;

      if (requireCanShoot) {
        const canShootFromCover = this.canShootGeometryFrom(
          position.q,
          position.r,
          target.plannedQ,
          target.plannedR,
          weaponConfig
        );

        if (!canShootFromCover) continue;
      }

      const optimalRange = weaponConfig.optimalRange || weaponConfig.maxRange;
      const rangePenalty = Math.abs(distance - optimalRange);

      // Чем меньше moveCost — тем лучше.
      // Чем сильнее укрытие — тем лучше.
      // Чем ближе к оптимальной дальности оружия — тем лучше.
      const score =
        position.moveCost * 1000 +
        rangePenalty * 25 +
        distance * 5 -
        coverInfo.coverScore * 120;

      if (score < bestScore) {
        bestScore = score;
        best = {
          ...position,
          coverInfo
        };
      }
    }

    if (best) {
      console.log(
        `[CombatAI]: найдена лучшая позиция в укрытии ` +
        `${best.q},${best.r} за объектом ${best.coverInfo.object.type} ` +
        `${best.coverInfo.coverQ},${best.coverInfo.coverR}. ` +
        `moveCost=${best.moveCost}, coverScore=${best.coverInfo.coverScore}`
      );
    }

    return best;
  }
}