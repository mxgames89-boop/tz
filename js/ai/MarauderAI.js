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

    const closeWeapon = this.getPreferredCloseWeapon();
    const longWeapon = this.getPreferredLongWeapon();

    if (!closeWeapon && !longWeapon) {
      this.finishTurn(target);
      return;
    }

    const closeRange = closeWeapon
      ? closeWeapon.config.maxRange
      : 8;

    const closeOptimalRange = closeWeapon
      ? closeWeapon.config.optimalRange || Math.ceil(closeWeapon.config.maxRange / 2)
      : 4;

    const distance = this.getDistanceToTarget(target);

    const canShootAny = this.canShootTarget(target);
    const canShootClose = closeWeapon
      ? this.canShootTarget(target, closeWeapon.name)
      : false;

    const canShootLong = longWeapon
      ? this.canShootTarget(target, longWeapon.name)
      : false;

    const isInCover = this.isNearCover(
      entity.plannedQ,
      entity.plannedR
    );

    const tactic = this.chooseRandomTactic({
      distance,
      closeRange,
      canShootAny,
      canShootClose,
      canShootLong,
      isInCover
    });

    console.log(
      `[MarauderAI]: ${entity.name} выбирает тактику: ${tactic}. ` +
      `distance=${distance}, AP=${entity.currentAP}, ` +
      `closeWeapon=${closeWeapon?.name}, longWeapon=${longWeapon?.name}`
    );

    switch (tactic) {
      case 'LONG_STAND':
        this.tacticLongStand(target, longWeapon);
        break;

      case 'RUSH_CLOSE':
        this.tacticRushClose(target, closeWeapon, closeOptimalRange, closeRange);
        break;

      case 'COVER_THEN_SHOOT':
        this.tacticCoverThenShoot(target);
        break;

      case 'CURRENT_ATTACK':
        this.tacticCurrentAttack(target);
        break;

      default:
        this.tacticRushClose(target, closeWeapon, closeOptimalRange, closeRange);
        break;
    }

    this.finishTurn(target);
  }

  chooseRandomTactic(context) {
    const {
      distance,
      closeRange,
      canShootAny,
      canShootClose,
      canShootLong,
      isInCover
    } = context;

    if (distance > closeRange) {
      if (canShootLong) {
        return this.weightedRandom([
          ['LONG_STAND', 35],
          ['RUSH_CLOSE', 45],
          ['COVER_THEN_SHOOT', 20]
        ]);
      }

      return this.weightedRandom([
        ['RUSH_CLOSE', 75],
        ['COVER_THEN_SHOOT', 25]
      ]);
    }

    if (canShootClose) {
      if (isInCover) {
        return this.weightedRandom([
          ['CURRENT_ATTACK', 75],
          ['RUSH_CLOSE', 15],
          ['LONG_STAND', 10]
        ]);
      }

      return this.weightedRandom([
        ['CURRENT_ATTACK', 55],
        ['COVER_THEN_SHOOT', 35],
        ['LONG_STAND', 10]
      ]);
    }

    if (canShootAny) {
      return this.weightedRandom([
        ['CURRENT_ATTACK', 50],
        ['RUSH_CLOSE', 35],
        ['COVER_THEN_SHOOT', 15]
      ]);
    }

    return this.weightedRandom([
      ['RUSH_CLOSE', 70],
      ['COVER_THEN_SHOOT', 30]
    ]);
  }

  tacticLongStand(target, longWeapon) {
    if (!longWeapon || !this.canShootTarget(target, longWeapon.name)) {
      this.tacticCurrentAttack(target);
      return;
    }

    console.log(
      `[MarauderAI]: ${this.entity.name} стреляет с места дальним оружием: ${longWeapon.name}.`
    );

    this.shootUntilNoAPWithWeapon(target, longWeapon.name);
  }

  tacticRushClose(target, closeWeapon, minDesiredRange = 4, maxDesiredRange = 8) {
    if (!closeWeapon) {
      this.tacticCurrentAttack(target);
      return;
    }

    const desiredRange = this.randomInt(
      Math.max(1, minDesiredRange),
      Math.max(1, maxDesiredRange)
    );

    console.log(
      `[MarauderAI]: ${this.entity.name} сближается под оружие ${closeWeapon.name}. ` +
      `Желаемая дистанция: ${desiredRange}`
    );

    this.runTowardTargetUntilDistance(
      target,
      desiredRange,
      closeWeapon.name
    );

    if (this.canShootTarget(target, closeWeapon.name)) {
      this.shootUntilNoAPWithWeapon(target, closeWeapon.name);
      return;
    }

    this.tacticCurrentAttack(target);
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

    this.tacticCurrentAttack(target);
  }

  tacticCurrentAttack(target) {
    if (!this.canShootTarget(target)) {
      return;
    }

    console.log(
      `[MarauderAI]: ${this.entity.name} стреляет лучшим оружием для текущей дистанции.`
    );

    this.shootTargetUntilNoAP(target, 'balanced');
  }

  shootUntilNoAPWithWeapon(target, weaponName) {
    const entity = this.entity;

    if (!entity || !target || !weaponName) return 0;

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

  randomInt(min, max) {
    const from = Math.ceil(min);
    const to = Math.floor(max);

    return Math.floor(Math.random() * (to - from + 1)) + from;
  }
}