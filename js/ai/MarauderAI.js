import { AIBase } from './AIBase.js';

export class MarauderAI extends AIBase {
  constructor(game, entity) {
    super(game, entity);

    // Маленький радиус, чтобы не было тяжёлых просчётов.
    this.coverSearchRadiusMin = 2;
    this.coverSearchRadiusMax = 3;

    // Бот больше не стреляет на все ОД.
    this.minShotsPerTurn = 1;
    this.maxShotsPerTurn = 15;
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
    const laser = this.getWeapon('lasergun');

    const pmRange = pm ? pm.maxRange : 12;
    const pmOptimalRange = pm ? pm.optimalRange : 5;

    const distance = this.getDistanceToTarget(target);

    const canShootPM = this.canShootWithWeapon(target, 'pm');
    const canShootLaser = this.canShootWithWeapon(target, 'lasergun');

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

    // Далеко от игрока:
    // иногда стреляет лазеркой с места,
    // иногда бежит сближаться под ПМ,
    // иногда ищет укрытие.
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

    // Уже близко.
    // Если ПМ достаёт, чаще атакует с ПМ,
    // но иногда всё равно ищет укрытие.
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
    if (!this.canShootWithWeapon(target, 'lasergun')) {
      this.tacticRushPM(target);
      return;
    }

    const shots = this.randomInt(
      this.minShotsPerTurn,
      this.maxShotsPerTurn
    );

    console.log(
      `[MarauderAI]: ${this.entity.name} стреляет с места лазерной винтовкой.`
    );

    this.shootTargetLimited(target, shots, 'lasergun');
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

    if (this.canShootWithWeapon(target, 'pm')) {
      const shots = this.randomInt(
        this.minShotsPerTurn,
        this.maxShotsPerTurn
      );

      this.shootTargetLimited(target, shots, 'pm');
      return;
    }

    // Если до ПМ не добежал, но лазерка достаёт —
    // иногда делает 1 выстрел, чтобы ход не был пустой.
    if (this.canShootWithWeapon(target, 'lasergun') && this.chance(0.45)) {
      this.shootTargetLimited(target, 1, 'lasergun');
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

    // После укрытия стреляет тем, что достаёт.
    if (this.canShootWithWeapon(target, 'pm')) {
      this.shootTargetLimited(
        target,
        this.randomInt(1, this.maxShotsPerTurn),
        'pm'
      );
      return;
    }

    if (this.canShootWithWeapon(target, 'lasergun')) {
      this.shootTargetLimited(
        target,
        this.randomInt(1, 2),
        'lasergun'
      );
      return;
    }

    // Если из укрытия всё ещё не достаёт — сближается.
    this.tacticRushPM(target);
  }

  tacticPMAttack(target, pmOptimalRange = 5, pmRange = 12) {
    // Иногда даже на PM-дистанции чуть сближается,
    // чтобы поведение не было одинаковым.
    if (this.chance(0.35)) {
      const desiredRange = this.randomInt(
        Math.max(1, pmOptimalRange),
        Math.max(1, pmRange)
      );

      this.runTowardDistance(target, desiredRange, 'pm');
    }

    if (this.canShootWithWeapon(target, 'pm')) {
      this.shootTargetLimited(
        target,
        this.randomInt(this.minShotsPerTurn, this.maxShotsPerTurn),
        'pm'
      );
      return;
    }

    if (this.canShootWithWeapon(target, 'lasergun')) {
      this.shootTargetLimited(target, 1, 'lasergun');
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

  canShootWithWeapon(target, weaponName) {
    return this.canShootTarget(
      target,
      weaponName
    );
  }

  shootTargetLimited(target, maxShots = 1, weaponName = null) {
    const entity = this.entity;
    if (!entity || !target) return 0;

    let shots = 0;

    while (shots < maxShots) {
      const selectedWeaponName = weaponName || this.chooseWeaponForTarget(target);

      if (!this.canShootWithWeapon(target, selectedWeaponName)) {
        break;
      }

      if (!this.shootTarget(target, selectedWeaponName)) {
        break;
      }

      shots++;
    }

    console.log(
      `[MarauderAI]: ${entity.name} сделал выстрелов: ${shots}. ` +
      `weapon=${weaponName || 'auto'}, AP=${entity.currentAP}`
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