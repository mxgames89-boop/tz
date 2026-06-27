import { AI } from './AI.js';

export class MarauderAI extends AI {
  constructor(game, entity) {
    super(game, entity);

    // Мародёр ищет укрытие только рядом.
    // Радиус маленький, чтобы ИИ не перебирал всю карту.
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
    // Сначала ищет укрытие в радиусе 2-3 клеток.
    // Идёт туда только если после бега останется AP на выстрел.
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

      // Укрытия рядом нет — стреляет с места при первой возможности.
      this.shootTargetUntilNoAP(target);
      this.finishTurn(target);
      return;
    }

    // 3. Стрелять пока нельзя.
    // Если рядом есть любое укрытие — занимает его бегом.
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
    // Останавливается, как только появляется возможность стрелять.
    this.runTowardTargetUntilCanShoot(target);

    // 5. При первой возможности стреляет.
    if (this.canShootTarget(target)) {
      this.shootTargetUntilNoAP(target);
    }

    this.finishTurn(target);
  }
}