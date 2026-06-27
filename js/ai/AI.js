import { MarauderAI } from './MarauderAI.js';

export class AI {
  constructor(game) {
    this.game = game;

    this.aiClasses = {
      enemy: MarauderAI
    };
  }

  planAll() {
    if (!window.entities) return;

    for (const entity of window.entities) {
      if (!entity || entity.hp <= 0) continue;

      const AIClass = this.aiClasses[entity.type];

      if (!AIClass) continue;

      const ai = new AIClass(this.game, entity);
      ai.planTurn();
    }
  }
}