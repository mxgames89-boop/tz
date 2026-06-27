import { GAME_CONFIG } from '../config.js';

export class AI {
  constructor(game, entity = null) {
    this.game = game;
    this.entity = entity;

    // Кэш подключённых классов ИИ.
    this.aiClasses = {};
  }

  async planAll() {
    if (!window.entities) return;

    for (const entity of window.entities) {
      if (!entity || entity.hp <= 0) continue;

      const AIClass = await this.getAIClassForEntity(entity);

      if (!AIClass) continue;

      const ai = new AIClass(this.game, entity);
      ai.planTurn();
    }
  }

  async getAIClassForEntity(entity) {
    if (!entity || !entity.type) return null;

    if (this.aiClasses[entity.type]) {
      return this.aiClasses[entity.type];
    }

    switch (entity.type) {
      case 'enemy': {
        const module = await import('./MarauderAI.js');
        this.aiClasses[entity.type] = module.MarauderAI;
        return module.MarauderAI;
      }

      default:
        return null;
    }
  }

  planTurn() {}

  prepareTurn() {
    const entity = this.entity;
    if (!entity) return;

    if (entity.actionQueue) {
      entity.actionQueue.clear();
    }

    entity.plannedQ = Number(entity.q);
    entity.plannedR = Number(entity.r);
    entity.plannedStepsCount = 0;

    const config = GAME_CONFIG.entities[entity.type];

    entity.currentAP = config?.maxAp || entity.currentAP;
    entity.startRoundAP = entity.currentAP;

    entity.state = 'idle';
    entity.skin = 'idle';

    if (entity.updatePlannedScreenCoordinates) {
      entity.updatePlannedScreenCoordinates();
    }
  }

  finishTurn(target = null) {
    const entity = this.entity;
    if (!entity) return;

    if (target) {
      entity.lookAt(target.plannedQ, target.plannedR);
    }

    if (entity.updatePlannedScreenCoordinates) {
      entity.updatePlannedScreenCoordinates();
    }

    console.log(
      `[AI]: ${entity.name} завершил план. ` +
      `planned=${entity.plannedQ},${entity.plannedR}, AP=${entity.currentAP}`
    );
  }

  getPlayer() {
    if (!window.entities) return null;

    return window.entities.find(entity =>
      entity.type === 'player' &&
      entity.hp > 0
    ) || null;
  }

  makeTarget(entity) {
    return {
      id: entity.id,
      name: entity.name,
      plannedQ: Number(entity.plannedQ),
      plannedR: Number(entity.plannedR)
    };
  }

  getWeapon(weaponName) {
    return GAME_CONFIG.weapons[weaponName] || null;
  }

  getDistance(q1, r1, q2, r2) {
    return this.game.grid.getHexDistance(
      Number(q1),
      Number(r1),
      Number(q2),
      Number(r2)
    );
  }

  getDistanceToTarget(target, fromQ = null, fromR = null) {
    const entity = this.entity;

    const q = fromQ !== null ? Number(fromQ) : Number(entity.plannedQ);
    const r = fromR !== null ? Number(fromR) : Number(entity.plannedR);

    return this.getDistance(
      q,
      r,
      target.plannedQ,
      target.plannedR
    );
  }

  chooseWeaponByDistance(distance) {
    const pm = this.getWeapon('pm');
    const lasergun = this.getWeapon('lasergun');

    // PM используем вблизи.
    if (pm && distance <= pm.maxRange) {
      return 'pm';
    }

    // Лазерную винтовку используем на дальней дистанции.
    if (lasergun) {
      return 'lasergun';
    }

    return this.entity?.weapon || 'pm';
  }

  chooseWeaponForTarget(target, fromQ = null, fromR = null) {
    const distance = this.getDistanceToTarget(target, fromQ, fromR);
    return this.chooseWeaponByDistance(distance);
  }

  canShootTarget(target, weaponName = null, fromQ = null, fromR = null, availableAP = null) {
    const entity = this.entity;
    if (!entity || !target) return false;

    const q = fromQ !== null ? Number(fromQ) : Number(entity.plannedQ);
    const r = fromR !== null ? Number(fromR) : Number(entity.plannedR);
    const ap = availableAP !== null ? Number(availableAP) : Number(entity.currentAP);

    const distance = this.getDistanceToTarget(target, q, r);
    const selectedWeaponName = weaponName || this.chooseWeaponByDistance(distance);
    const weapon = this.getWeapon(selectedWeaponName);

    if (!weapon) return false;
    if (ap < weapon.apCost) return false;

    return distance <= weapon.maxRange;
  }

  shootTarget(target, weaponName = null) {
    const entity = this.entity;
    if (!entity || !target) return false;

    const selectedWeaponName = weaponName || this.chooseWeaponForTarget(target);
    const weapon = this.getWeapon(selectedWeaponName);

    if (!weapon) return false;
    if (!this.canShootTarget(target, selectedWeaponName)) return false;

    entity.weapon = selectedWeaponName;

    entity.actionQueue.addShootAction(
      target.plannedQ,
      target.plannedR,
      weapon.apCost,
      target.id
    );

    entity.state = 'idle';
    entity.skin = `idle_${weapon.category}`;
    entity.lookAt(target.plannedQ, target.plannedR);

    console.log(
      `[AI]: ${entity.name} стреляет из ${weapon.name} по ${target.name}. ` +
      `AP=${entity.currentAP}`
    );

    return true;
  }

  shootTargetUntilNoAP(target) {
    const entity = this.entity;
    if (!entity || !target) return 0;

    let shots = 0;

    // Защита от случайного бесконечного цикла.
    const maxShotsGuard = 50;

    while (shots < maxShotsGuard && this.canShootTarget(target)) {
      const weaponName = this.chooseWeaponForTarget(target);

      if (!this.shootTarget(target, weaponName)) {
        break;
      }

      shots++;
    }

    console.log(`[AI]: ${entity.name} запланировал выстрелов: ${shots}`);

    return shots;
  }

  getMoveCost(stepNumber, state = 'run') {
    const entity = this.entity;
    if (!entity) return Infinity;

    const moveAP = entity.MoveAP || {};
    const baseCost = moveAP[state] || moveAP.idle || 1;

    return Number(stepNumber) * Number(baseCost);
  }

  getNextRunStepCost(extraSteps = 0) {
    const entity = this.entity;
    const stepNumber = entity.plannedStepsCount + extraSteps + 1;

    return this.getMoveCost(stepNumber, 'run');
  }

  runPath(path, target = null, reserveAP = 0) {
    const entity = this.entity;
    if (!entity || !path || path.length === 0) return 0;

    let steps = 0;

    entity.state = 'run';
    entity.skin = 'run';

    for (const step of path) {
      const stepCost = this.getNextRunStepCost();

      if (entity.currentAP - stepCost < reserveAP) {
        break;
      }

      entity.actionQueue.addMoveAction(
        step.q,
        step.r,
        'run',
        stepCost
      );

      entity.plannedStepsCount++;
      entity.plannedQ = Number(step.q);
      entity.plannedR = Number(step.r);

      if (target) {
        entity.lookAt(target.plannedQ, target.plannedR);
      }

      steps++;
    }

    console.log(
      `[AI]: ${entity.name} бежит. Шагов: ${steps}, AP=${entity.currentAP}`
    );

    return steps;
  }

  runTowardTargetUntilCanShoot(target) {
    const entity = this.entity;
    if (!entity || !target) return 0;

    const path = this.game.grid.findSmartPath(
      entity,
      target.plannedQ,
      target.plannedR
    );

    if (!path || path.length === 0) {
      entity.lookAt(target.plannedQ, target.plannedR);
      return 0;
    }

    let steps = 0;

    entity.state = 'run';
    entity.skin = 'run';

    for (const step of path) {
      if (this.canShootTarget(target)) {
        break;
      }

      const isTargetCell =
        Number(step.q) === Number(target.plannedQ) &&
        Number(step.r) === Number(target.plannedR);

      if (isTargetCell) {
        break;
      }

      const stepCost = this.getNextRunStepCost();

      const distanceAfterStep = this.getDistance(
        step.q,
        step.r,
        target.plannedQ,
        target.plannedR
      );

      const weaponNameAfterStep = this.chooseWeaponByDistance(distanceAfterStep);
      const weaponAfterStep = this.getWeapon(weaponNameAfterStep);

      const willBeInRangeAfterStep =
        weaponAfterStep &&
        distanceAfterStep <= weaponAfterStep.maxRange;

      const reserveAP = willBeInRangeAfterStep
        ? weaponAfterStep.apCost
        : 0;

      if (entity.currentAP - stepCost < reserveAP) {
        break;
      }

      entity.actionQueue.addMoveAction(
        step.q,
        step.r,
        'run',
        stepCost
      );

      entity.plannedStepsCount++;
      entity.plannedQ = Number(step.q);
      entity.plannedR = Number(step.r);

      entity.lookAt(target.plannedQ, target.plannedR);

      steps++;
    }

    console.log(
      `[AI]: ${entity.name} сближается бегом. Шагов: ${steps}, AP=${entity.currentAP}`
    );

    return steps;
  }

  findNearbyCoverPosition(radius = 3, target = null, requireShotAfterMove = false) {
    const entity = this.entity;
    if (!entity) return null;

    const coverSet = this.getCoverSet();

    if (coverSet.size === 0) return null;

    const startQ = Number(entity.plannedQ);
    const startR = Number(entity.plannedR);
    const startKey = this.key(startQ, startR);

    const validSet = this.getValidHexSet();
    const blockedSet = this.getBlockedSet();

    const queue = [{
      q: startQ,
      r: startR,
      depth: 0,
      path: [],
      moveCost: 0
    }];

    const visited = new Set([startKey]);

    let index = 0;

    while (index < queue.length) {
      const current = queue[index++];

      if (current.depth > radius) {
        continue;
      }

      if (
        current.path.length > 0 &&
        this.isNearCover(current.q, current.r, coverSet)
      ) {
        if (requireShotAfterMove && target) {
          const apAfterMove = entity.currentAP - current.moveCost;

          const canShootAfterMove = this.canShootTarget(
            target,
            null,
            current.q,
            current.r,
            apAfterMove
          );

          if (!canShootAfterMove) {
            continue;
          }
        }

        return current;
      }

      if (current.depth >= radius) {
        continue;
      }

      const neighbors = this.game.grid.getHexNeighbors(current.q, current.r);

      for (const neighbor of neighbors) {
        const q = Number(neighbor.q);
        const r = Number(neighbor.r);
        const key = this.key(q, r);

        if (visited.has(key)) continue;
        if (!validSet.has(key)) continue;
        if (blockedSet.has(key)) continue;

        const nextStepNumber = entity.plannedStepsCount + current.path.length + 1;
        const stepCost = this.getMoveCost(nextStepNumber, 'run');
        const moveCost = current.moveCost + stepCost;

        if (moveCost > entity.currentAP) continue;

        visited.add(key);

        queue.push({
          q,
          r,
          depth: current.depth + 1,
          path: [
            ...current.path,
            { q, r }
          ],
          moveCost
        });
      }
    }

    return null;
  }

  isNearCover(q, r, preparedCoverSet = null) {
    const coverSet = preparedCoverSet || this.getCoverSet();

    if (coverSet.size === 0) return false;

    const neighbors = this.game.grid.getHexNeighbors(
      Number(q),
      Number(r)
    );

    for (const neighbor of neighbors) {
      if (coverSet.has(this.key(neighbor.q, neighbor.r))) {
        return true;
      }
    }

    return false;
  }

  getCoverSet() {
    const result = new Set();
    const objects = this.game.objectmap?.objects || [];

    for (const obj of objects) {
      if (!obj) continue;
      if (obj.hp !== undefined && obj.hp <= 0) continue;

      // Любой живой объект считается укрытием:
      // дерево, камень, окно, стена, пень и т.д.
      result.add(this.key(obj.q, obj.r));
    }

    return result;
  }

  getValidHexSet() {
    return new Set(
      this.game.grid.hexes.map(hex => this.key(hex.q, hex.r))
    );
  }

  getBlockedSet() {
    const entity = this.entity;

    const blocked = new Set(
      (this.game.grid.nonspawn || []).map(hex => this.key(hex.q, hex.r))
    );

    if (window.entities) {
      for (const other of window.entities) {
        if (!other) continue;
        if (other === entity) continue;
        if (other.hp <= 0) continue;

        blocked.add(this.key(other.plannedQ, other.plannedR));
      }
    }

    return blocked;
  }

  key(q, r) {
    return `${Number(q)},${Number(r)}`;
  }
}