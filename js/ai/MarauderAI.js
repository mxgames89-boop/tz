import { AIBase } from './AIBase.js';

export class MarauderAI extends AIBase {
  constructor(game, entity) {
    super(game, entity);

    this.coverSearchRadius = 3;

    // Мародёр не должен сливать весь ход в стрельбу.
    // Это не modes, это просто лимит одиночных выстрелов за ход.
    this.maxShotsPerTurn = 3;
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

    const distance = this.getDistanceToTarget(target);

    console.log(
      `[MarauderAI]: ${entity.name} стартует. ` +
      `distance=${distance}, pmRange=${pmRange}, AP=${entity.currentAP}`
    );

    // 1. Если мародёр дальше PM-дистанции,
    // он НЕ ищет ближайшее укрытие и НЕ стреляет с места лазеркой.
    // Сначала сближается бегом.
    if (distance > pmRange) {
      this.runTowardDistance(target, pmRange);

      if (this.canShootTarget(target)) {
        this.shootTargetLimited(target, this.maxShotsPerTurn);
      }

      this.finishTurn(target);
      return;
    }

    // 2. Если мародёр уже на PM-дистанции,
    // тогда можно думать про укрытие рядом.
    const isInCover = this.isNearCover(
      entity.plannedQ,
      entity.plannedR
    );

    if (!isInCover) {
      const coverForShot = this.findNearbyCoverPosition(
        this.coverSearchRadius,
        target,
        true
      );

      if (coverForShot && coverForShot.path.length > 0) {
        console.log(
          `[MarauderAI]: ${entity.name} рядом с целью, занимает укрытие.`
        );

        this.runPath(coverForShot.path, target);
      }
    }

    // 3. После сближения / укрытия стреляет ограниченное число раз.
    if (this.canShootTarget(target)) {
      this.shootTargetLimited(target, this.maxShotsPerTurn);
    } else {
      this.runTowardDistance(target, pmRange);

      if (this.canShootTarget(target)) {
        this.shootTargetLimited(target, this.maxShotsPerTurn);
      }
    }

    this.finishTurn(target);
  }

  runTowardDistance(target, desiredDistance) {
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

      const weaponNameAfterStep = this.chooseWeaponByDistance(distanceAfterStep);
      const weaponAfterStep = this.getWeapon(weaponNameAfterStep);

      // Если после шага появится возможность стрелять,
      // оставляем AP хотя бы на один выстрел.
      const reserveAP =
        weaponAfterStep && distanceAfterStep <= weaponAfterStep.maxRange
          ? weaponAfterStep.apCost
          : 0;

      const moved = this.runPath([step], target, reserveAP);

      if (moved === 0) {
        break;
      }

      steps += moved;
    }

    console.log(
      `[MarauderAI]: ${entity.name} сблизился бегом. ` +
      `steps=${steps}, planned=${entity.plannedQ},${entity.plannedR}, AP=${entity.currentAP}`
    );

    return steps;
  }

  shootTargetLimited(target, maxShots = 3) {
    const entity = this.entity;
    if (!entity || !target) return 0;

    let shots = 0;

    while (shots < maxShots && this.canShootTarget(target)) {
      const weaponName = this.chooseWeaponForTarget(target);

      if (!this.shootTarget(target, weaponName)) {
        break;
      }

      shots++;
    }

    console.log(
      `[MarauderAI]: ${entity.name} сделал выстрелов: ${shots}, AP=${entity.currentAP}`
    );

    return shots;
  }
}