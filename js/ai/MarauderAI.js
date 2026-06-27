import { AIBase } from './AIBase.js';

export class MarauderAI extends AIBase {
  constructor(game, entity) {
    super(game, entity);

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

    const isInCover = this.isNearCover(
      entity.plannedQ,
      entity.plannedR
    );

    // 1. Уже стоит в укрытии и может стрелять.
    if (isInCover && this.canShootTarget(target)) {
      this.shootTargetUntilNoAP(target);
      this.finishTurn(target);
      return;
    }

    // 2. Может стрелять, но стоит не в укрытии.
    // Сначала пробует занять укрытие рядом, если после бега останется AP на выстрел.
    if (!isInCover && this.canShootTarget(target)) {
      const coverForShot = this.findNearbyCoverPosition(
        this.coverSearchRadius,
        target,
        true
      );

      if (coverForShot) {
        this.runPath(coverForShot.path, target);

        if (this.canShootTarget(target)) {
          this.shootTargetUntilNoAP(target);
        }

        this.finishTurn(target);
        return;
      }

      this.shootTargetUntilNoAP(target);
      this.finishTurn(target);
      return;
    }

    // 3. Стрелять пока нельзя.
    // Если рядом есть укрытие — занимает его бегом.
    const nearbyCover = this.findNearbyCoverPosition(
      this.coverSearchRadius,
      target,
      false
    );

    if (nearbyCover) {
      this.runPath(nearbyCover.path, target);

      if (this.canShootTarget(target)) {
        this.shootTargetUntilNoAP(target);
      }

      this.finishTurn(target);
      return;
    }

    // 4. Укрытия рядом нет — сближается бегом.
    this.runTowardTargetUntilCanShoot(target);

    // 5. Как только появилась возможность — стреляет.
    if (this.canShootTarget(target)) {
      this.shootTargetUntilNoAP(target);
    }

    this.finishTurn(target);
  }
}