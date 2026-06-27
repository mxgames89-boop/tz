import { AIBase } from './AIBase.js';

export class MarauderAI extends AIBase {
  constructor(game, entity) {
    super(game, entity);

    // Мародёр ищет укрытие только рядом,
    // чтобы не было тяжёлого перебора карты.
    this.coverSearchRadius = 3;
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
    const lasergun = this.getWeapon('lasergun');

    const closeRange = pm ? pm.maxRange : 8;

    const distanceToTarget = this.getDistanceToTarget(target);

    const isInCover = this.isNearCover(
      entity.plannedQ,
      entity.plannedR
    );

    const canShootNow = this.canShootTarget(target);

    // 1. Если мародёр далеко — НЕ стреляем сразу из лазерки.
    // Сначала сближаемся до дистанции PM.
    if (distanceToTarget > closeRange) {
      // Если рядом есть укрытие, из которого можно будет стрелять,
      // сначала занимаем его.
      const coverForShot = this.findNearbyCoverPosition(
        this.coverSearchRadius,
        target,
        true
      );

      if (coverForShot) {
        console.log(
          `[MarauderAI]: ${entity.name} бежит в укрытие перед стрельбой.`
        );

        this.runPath(coverForShot.path, target);

        if (this.canShootTarget(target)) {
          this.shootTargetUntilNoAP(target);
        }

        this.finishTurn(target);
        return;
      }

      // Укрытия рядом нет — просто сближаемся.
      // Метод сам оставит AP на выстрел, если после шага цель будет в дальности.
      console.log(
        `[MarauderAI]: ${entity.name} далеко от цели. ` +
        `Дистанция ${distanceToTarget}, сближается до ${closeRange}.`
      );

      this.runTowardTargetUntilDistance(target, closeRange);

      if (this.canShootTarget(target)) {
        this.shootTargetUntilNoAP(target);
      }

      this.finishTurn(target);
      return;
    }

    // 2. Мародёр уже на ближней/средней дистанции.
    // Если он не в укрытии, пробует занять укрытие рядом,
    // но только если после бега сможет стрелять.
    if (!isInCover) {
      const coverForShot = this.findNearbyCoverPosition(
        this.coverSearchRadius,
        target,
        true
      );

      if (coverForShot) {
        console.log(
          `[MarauderAI]: ${entity.name} занимает ближайшее укрытие и стреляет.`
        );

        this.runPath(coverForShot.path, target);

        if (this.canShootTarget(target)) {
          this.shootTargetUntilNoAP(target);
        }

        this.finishTurn(target);
        return;
      }
    }

    // 3. Если уже можно стрелять — стреляем.
    if (canShootNow || this.canShootTarget(target)) {
      this.shootTargetUntilNoAP(target);
      this.finishTurn(target);
      return;
    }

    // 4. Запасной вариант:
    // если почему-то всё ещё не можем стрелять, сближаемся.
    this.runTowardTargetUntilDistance(target, closeRange);

    if (this.canShootTarget(target)) {
      this.shootTargetUntilNoAP(target);
    }

    this.finishTurn(target);
  }
}