import { GAME_CONFIG } from '../config.js';

export class AIBase {
  constructor(game, entity) {
    this.game = game;
    this.entity = entity;
  }

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

    entity.currentAP = config?.maxAp || entity.maxAp || entity.currentAP;
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

  getWeapon(weaponName) {
    return GAME_CONFIG.weapons[weaponName] || null;
  }

  getAvailableWeapons() {
    const entity = this.entity;

    let weaponNames = [];

    if (Array.isArray(entity.weapons) && entity.weapons.length > 0) {
      weaponNames = entity.weapons;
    } else if (Array.isArray(entity.inventory?.weapons) && entity.inventory.weapons.length > 0) {
      weaponNames = entity.inventory.weapons;
    } else {
      // Пока у сущности нет нормального инвентаря,
      // считаем, что ИИ может пользоваться всем оружием из конфига.
      weaponNames = Object.keys(GAME_CONFIG.weapons || {});
    }

    return weaponNames
      .map(name => ({
        name,
        config: this.getWeapon(name)
      }))
      .filter(item => item.config);
  }

  getWeaponsInRange(distance, availableAP = null) {
    const entity = this.entity;
    const ap = availableAP !== null ? Number(availableAP) : Number(entity.currentAP);

    return this.getAvailableWeapons().filter(item => {
      const weapon = item.config;

      return (
        distance <= weapon.maxRange &&
        ap >= weapon.apCost
      );
    });
  }

  getBestWeaponForDistance(distance, availableAP = null, style = 'balanced') {
    const weapons = this.getWeaponsInRange(distance, availableAP);

    if (weapons.length === 0) return null;

    let best = null;
    let bestScore = -Infinity;

    for (const item of weapons) {
      const weapon = item.config;

      const damagePerAP = weapon.baseDamage / Math.max(1, weapon.apCost);
      const accuracy = weapon.accuracy || 0.5;
      const optimalRange = weapon.optimalRange || weapon.maxRange;
      const maxRange = weapon.maxRange || 1;

      const rangeComfort = 1 - Math.min(
        1,
        Math.abs(distance - optimalRange) / maxRange
      );

      let score =
        damagePerAP * 50 +
        accuracy * 40 +
        rangeComfort * 35;

      if (style === 'long') {
        score += weapon.maxRange * 2;
      }

      if (style === 'close') {
        score -= weapon.maxRange;
        score += rangeComfort * 60;
      }

      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }

    return best;
  }

  getBestWeaponForTarget(target, style = 'balanced', fromQ = null, fromR = null, availableAP = null) {
    const distance = this.getDistanceToTarget(target, fromQ, fromR);

    return this.getBestWeaponForDistance(
      distance,
      availableAP,
      style
    );
  }

  getLongestRangeWeapon() {
    const weapons = this.getAvailableWeapons();

    if (weapons.length === 0) return null;

    return weapons.reduce((best, item) => {
      if (!best) return item;

      return item.config.maxRange > best.config.maxRange
        ? item
        : best;
    }, null);
  }

  getShortestRangeWeapon() {
    const weapons = this.getAvailableWeapons();

    if (weapons.length === 0) return null;

    return weapons.reduce((best, item) => {
      if (!best) return item;

      return item.config.maxRange < best.config.maxRange
        ? item
        : best;
    }, null);
  }

  getPreferredCloseWeapon() {
    return this.getShortestRangeWeapon() || this.getBestWeaponForDistance(999999);
  }

  getPreferredLongWeapon() {
    return this.getLongestRangeWeapon();
  }

  canShootTarget(target, weaponName = null, fromQ = null, fromR = null, availableAP = null) {
    const entity = this.entity;
    if (!entity || !target) return false;

    const q = fromQ !== null ? Number(fromQ) : Number(entity.plannedQ);
    const r = fromR !== null ? Number(fromR) : Number(entity.plannedR);
    const ap = availableAP !== null ? Number(availableAP) : Number(entity.currentAP);

    const distance = this.getDistanceToTarget(target, q, r);

    let weaponItem = null;

    if (weaponName) {
      const weapon = this.getWeapon(weaponName);
      if (!weapon) return false;

      weaponItem = {
        name: weaponName,
        config: weapon
      };
    } else {
      weaponItem = this.getBestWeaponForDistance(distance, ap);
    }

    if (!weaponItem) return false;

    const weapon = weaponItem.config;

    if (ap < weapon.apCost) return false;

    return distance <= weapon.maxRange;
  }

  shootTarget(target, weaponName = null, style = 'balanced') {
    const entity = this.entity;
    if (!entity || !target) return false;

    let weaponItem = null;

    if (weaponName) {
      const weapon = this.getWeapon(weaponName);
      if (!weapon) return false;

      weaponItem = {
        name: weaponName,
        config: weapon
      };
    } else {
      weaponItem = this.getBestWeaponForTarget(target, style);
    }

    if (!weaponItem) return false;
    if (!this.canShootTarget(target, weaponItem.name)) return false;

    const weapon = weaponItem.config;

    entity.weapon = weaponItem.name;

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
      `weapon=${weaponItem.name}, AP=${entity.currentAP}`
    );

    return true;
  }

  shootTargetUntilNoAP(target, style = 'balanced') {
    const entity = this.entity;
    if (!entity || !target) return 0;

    let shots = 0;
    const maxShotsGuard = 100;

    while (shots < maxShotsGuard) {
      const weaponItem = this.getBestWeaponForTarget(target, style);

      if (!weaponItem) break;
      if (!this.canShootTarget(target, weaponItem.name)) break;
      if (!this.shootTarget(target, weaponItem.name, style)) break;

      shots++;
    }

    return shots;
  }

  runPath(path, target = null, reserveAP = 0) {
    const entity = this.entity;
    if (!entity || !path || path.length === 0) return 0;

    let steps = 0;

    entity.state = 'run';
    entity.skin = 'run';

    for (const step of path) {
      entity.state = 'run';

      const nextStepNumber = entity.plannedStepsCount + 1;
      const stepCost = entity.getStepCostAP(nextStepNumber);

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

    return steps;
  }

  runTowardTargetUntilDistance(target, desiredDistance, reserveWeaponName = null) {
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
      const currentDistance = this.getDistance(
        entity.plannedQ,
        entity.plannedR,
        target.plannedQ,
        target.plannedR
      );

      if (currentDistance <= desiredDistance) {
        break;
      }

      const isTargetCell =
        Number(step.q) === Number(target.plannedQ) &&
        Number(step.r) === Number(target.plannedR);

      if (isTargetCell) {
        break;
      }

      const distanceAfterStep = this.getDistance(
        step.q,
        step.r,
        target.plannedQ,
        target.plannedR
      );

      let reserveAP = 0;

      if (reserveWeaponName) {
        const reserveWeapon = this.getWeapon(reserveWeaponName);

        if (
          reserveWeapon &&
          distanceAfterStep <= reserveWeapon.maxRange
        ) {
          reserveAP = reserveWeapon.apCost;
        }
      } else {
        const bestWeaponAfterStep = this.getBestWeaponForTarget(
          target,
          'balanced',
          step.q,
          step.r
        );

        if (bestWeaponAfterStep) {
          reserveAP = bestWeaponAfterStep.config.apCost;
        }
      }

      const moved = this.runPath([step], target, reserveAP);

      if (moved === 0) {
        break;
      }

      steps += moved;
    }

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

        entity.state = 'run';

        const nextStepNumber = entity.plannedStepsCount + current.path.length + 1;
        const stepCost = entity.getStepCostAP(nextStepNumber);
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