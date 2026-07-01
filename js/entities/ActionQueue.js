import { GAME_CONFIG } from '../config.js';

export class ActionQueue {
    /**
     * @param {Entity} entity - Ссылка на персонажа, которому принадлежит эта очередь
     */
    constructor(entity) {
        this.entity = entity;
        this.queue = [];
    }

    addMoveAction(q, r, state, apCost, type = 'move') {
        
        this.takeAP(Number(apCost));

        this.queue.push({
            'type': type,
            'state': state,
            'q': Number(q),
            'r': Number(r),
            'apCost': Number(apCost)
        });
    }

    addShootAction(targetQ, targetR, apCost, targetID) {

        this.takeAP(Number(apCost));

        this.queue.push({
            'type': 'shoot',
            'targetQ': Number(targetQ),
            'targetR': Number(targetR),
            'targetID': targetID,
            'apCost': Number(apCost)
        });
    }

    // Функция которая списывает ОД персонажа в режиме планирования
    takeAP(ap) {
        this.entity.currentAP -= ap;
    }

    // Функция очистки очереди
    clear() {
        this.queue = [];
        this.isExecutingAction = false;
    }
}