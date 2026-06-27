import { AIBase } from './AIBase.js';

export class MarauderAI extends AIBase {
  constructor(game, entity) {
    super(game, entity);

    this.coverSearchRadiusMin = 2;
    this.coverSearchRadiusMax = 3;
  }

  planTurn() {
    this.prepareTurn();

    const player = this.getPlayer();

    if (!player) {
      this.finishTurn();
      return;
    }

    const target = this.makeTarget(player);
    const entity = this.entity;

    const pm = this.getWeapon('pm');
    const pmRange = pm ? pm.maxRange : 12;
    const pmOptimalRange = pm ? pm.optimalRange : 5;

    const distance = this.getDistanceToTarget(target);

    const canShootPM = this.canShootTarget(target, 'pm');
    const canShootLaser = this.canShootTarget(target, 'lasergun');

    const isInCover = this.isNearCover(
      entity.plannedQ,
      entity.plannedR
    );

    const tactic = this.chooseRandomTactic({
      distance,
      pmRange,
      canShootPM,
      canShootLaser,
      isInCover
    });

    console.log(
      `[MarauderAI]: ${entity.name} выбирает тактику: ${tactic}. ` +
      `distance=${distance}, AP=${entity.currentAP}`
    );

    switch (tactic) {
      case 'LASER_STAND':
        this.tacticLaserStand(target);
        break;

      case 'RUSH_PM':
        this.tacticRushPM(target, pmOptimalRange, pmRange);
        break;

      case 'COVER_THEN_SHOOT':
        this.tacticCoverThenShoot(target);
        break;

      case 'PM_ATTACK':
        this.tacticPMAttack(target, pmOptimalRange, pmRange);
        break;

      default:
        this.tacticRushPM(target, pmOptimalRange, pmRange);
        break;
    }

    this.finishTurn(target);
  }

  chooseRandomTactic(context) {
    const {
      distance,
      pmRange,
      canShootPM,
      canShootLaser,
      isInCover
    } = context;

    if (distance > pmRange) {
      if (canShootLaser) {
        return this.weightedRandom([
          ['LASER_STAND', 35],
          ['RUSH_PM', 45],
          ['COVER_THEN_SHOOT', 20]
        ]);
      }

      return this.weightedRandom([
        ['RUSH_PM', 75],
        ['COVER_THEN_SHOOT', 25]
      ]);
    }

    if (canShootPM) {
      if (isInCover) {
        return this.weightedRandom([
          ['PM_ATTACK', 75],
          ['RUSH_PM', 15],
          ['LASER_STAND', 10]
        ]);
      }

      return this.weightedRandom([
        ['PM_ATTACK', 55],
        ['COVER_THEN_SHOOT', 35],
        ['LASER_STAND', 10]
      ]);
    }

    return this.weightedRandom([
      ['RUSH_PM', 65],
      ['COVER_THEN_SHOOT', 35]
    ]);
  }

  tacticLaserStand(target) {
    if (!this.canShootTarget(target, 'lasergun')) {
      this.tacticRushPM(target);
      return;
    }

    console.log(
      `[MarauderAI]: ${this.entity.name} стреляет с места лазерной винтовкой.`
    );

    this.shootUntilNoAPWithWeapon(target, 'lasergun');
  }

  tacticRushPM(target, minDesiredRange = 5, maxDesiredRange = 12) {
    const desiredRange = this.randomInt(
      Math.max(1, minDesiredRange),
      Math.max(1, maxDesiredRange)
    );

    console.log(
      `[MarauderAI]: ${this.entity.name} сближается бегом под ПМ. ` +
      `Желаемая дистанция: ${desiredRange}`
    );

    this.runTowardDistance(target, desiredRange, 'pm');

    if (this.canShootTarget(target, 'pm')) {
      this.shootUntilNoAPWithWeapon(target, 'pm');
      return;
    }

    if (this.canShootTarget(target, 'lasergun')) {
      this.shootUntilNoAPWithWeapon(target, 'lasergun');
    }
  }

  tacticCoverThenShoot(target) {
    const radius = this.randomInt(
      this.coverSearchRadiusMin,
      this.coverSearchRadiusMax
    );

    const cover = this.findNearbyCoverPosition(
      radius,
      target,
      false
    );

    if (cover && cover.path && cover.path.length > 0) {
      console.log(
        `[MarauderAI]: ${this.entity.name} бежит в ближайшее укрытие. ` +
        `radius=${radius}`
      );

      this.runPath(cover.path, target);
    } else {
      console.log(
        `[MarauderAI]: ${this.entity.name} не нашёл укрытие рядом.`
      );
    }

    if (this.canShootTarget(target, 'pm')) {
      this.shootUntilNoAPWithWeapon(target, 'pm');
      return;
    }

    if (this.canShootTarget(target, 'lasergun')) {
      this.shootUntilNoAPWithWeapon(target, 'lasergun');
      return;
    }

    this.tacticRushPM(target);
  }

  tacticPMAttack(target, pmOptimalRange = 5, pmRange = 12) {
    if (this.chance(0.35)) {
      const desiredRange = this.randomInt(
        Math.max(1, pmOptimalRange),
        Math.max(1, pmRange)
      );

      this.runTowardDistance(target, desiredRange, 'pm');
    }

    if (this.canShootTarget(target, 'pm')) {
      this.shootUntilNoAPWithWeapon(target, 'pm');
      return;
    }

    if (this.canShootTarget(target, 'lasergun')) {
      this.shootUntilNoAPWithWeapon(target, 'lasergun');
    }
  }

  runTowardDistance(target, desiredDistance, reserveWeaponName = null) {
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
      }

      const moved = this.runPath([step], target, reserveAP);

      if (moved === 0) {
        break;
      }

      steps += moved;
    }

    console.log(
      `[MarauderAI]: ${entity.name} пробежал шагов: ${steps}. ` +
      `planned=${entity.plannedQ},${entity.plannedR}, AP=${entity.currentAP}`
    );

    return steps;
  }

  shootUntilNoAPWithWeapon(target, weaponName) {
    const entity = this.entity;

    if (!entity || !target) return 0;

    let shots = 0;

    while (this.canShootTarget(target, weaponName)) {
      if (!this.shootTarget(target, weaponName)) {
        break;
      }

      shots++;

      if (shots > 100) {
        console.warn(
          `[MarauderAI]: защита от бесконечного цикла стрельбы.`
        );

        break;
      }
    }

    console.log(
      `[MarauderAI]: ${entity.name} сделал выстрелов: ${shots}. ` +
      `weapon=${weaponName}, AP=${entity.currentAP}`
    );

    return shots;
  }

  weightedRandom(items) {
    const total = items.reduce((sum, item) => sum + item[1], 0);

    let roll = Math.random() * total;

    for (const [value, weight] of items) {
      roll -= weight;

      if (roll <= 0) {
        return value;
      }
    }

    return items[items.length - 1][0];
  }

  chance(probability) {
    return Math.random() < probability;
  }

  randomInt(min, max) {
    const from = Math.ceil(min);
    const to = Math.floor(max);

    return Math.floor(Math.random() * (to - from + 1)) + from;
  }
}