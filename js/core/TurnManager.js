import { GAME_CONFIG } from '../config.js';
import { battleRecorder } from './BattleRecorder.js';
import { AI } from '../ai/AI.js';
import { TurnSimulator } from './TurnSimulator.js';
import { AnimationPlayer } from '../render/AnimationPlayer.js';
import { audioManager } from '../audio/AudioManager.js';

export class TurnManager {
    constructor(game) {
        this.game = game;
        this.calculatedScript = {};
        this.simulator = new TurnSimulator(this.game);
        this.player = new AnimationPlayer(this.game);
        this.ai = new AI(this.game);

        this.planningTimerStartedAt = 0;
        this.planningTimerActive = false;
        this.autoStartTriggered = false;
    }

    initFirstTurn() {
        window.roundCount = 1;
        gameState = 'PLANNING';

        this.resetPlanningTimer();

        console.log("Фаза планирования. Раздайте приказы персонажам.");

        audioManager.play('start_battle', 0.2);

        const entitiesArray = window.entities;
        const player = entitiesArray.find(e => e.type === 'player');

        if(entitiesArray){
            entitiesArray.forEach(entity => {
                if(entity.type != 'player') entity.lookAt(player.q, player.r);
            });
        } 
    }

    //Вызывается при нажатии кнопки "ГОТОВ"
    startTurnExecution() {

        if(window.gameState !== 'PLANNING') return;

        this.planningTimerActive = false;
        this.autoStartTriggered = true;
        
        this.ai.planAll();

        this.realSimulationStartTime = performance.now();

        // 1. Делегируем чистый математический расчет симулятору!
        this.calculatedScript = this.simulator.calculateRoundScript(window.entities);

        // 2. Делегируем воспроизведение полученного массива нашему независимому AnimationPlayer!
        this.player.play(this.calculatedScript);

        window.gameState = 'EXECUTION';
    }

    /**
     * Метод вызывается каждый кадр внутри gameLoop во время симуляции
     */
    updateExecution(deltaTime) {
        if (window.gameState !== 'EXECUTION') return;

        let allActionsFinished = true;

        // Передаем управление в AnimationPlayer. Пока он возвращает true — плеер крутится.
        // Как только лента анимаций закончится, метод вернет false — и мы закроем раунд!
        const isStillPlaying = this.player.updatePlayback(deltaTime);


        if(!isStillPlaying) {
            const durationInSeconds = (performance.now() - this.realSimulationStartTime) / 1000;
            console.log(`%c[TurnManager]: Сценарий раунда успешно воспроизведен за ${durationInSeconds.toFixed(3)} сек.`, "color: #00ff00; font-weight: bold;");
            this.endTurnExecution();
        }
    }

    endTurnExecution() {
        console.log("[TurnManager]: Все персонажи добежали. Возврат в фазу планирования.");

        window.gameState = 'PLANNING';

        this.resetPlanningTimer();

        this.removeDeadEntities();
        if(window.entities) window.entities.forEach(entity => {entity.resetPlannedState();});

        this.game.grid.plannedPath = []; 
        this.game.grid.highlights = [];

        this.game.input._updateGridHighlights();

        const currentUI = this.game.game.sceneManager.currentScene?.ui;

        if (currentUI && currentUI.consoleUI){
            currentUI.consoleUI.viewingRound = window.roundCount;
        }
    }

    //Вспомогательные методы
    removeDeadEntities() {
      if(!window.entities) return;
      
      const player_death = window.entities.find(e => e.type === 'player' && e.hp <= 0);
      if(player_death) return;

      window.entities = window.entities.filter(entity => {
        if(!entity) return false;
        if(entity.hp > 0) return true;
        if(entity.actionQueue && typeof entity.actionQueue.clear === 'function') entity.actionQueue.clear();
        return false;
      });
    }

    resetPlanningTimer() {
      const limit = GAME_CONFIG.turn.planningTimeLimit || 0;

      this.planningTimerStartedAt = performance.now();
      this.planningTimerActive = limit > 0;
      this.autoStartTriggered = false;
    }

    updatePlanning() {
      if (window.gameState !== 'PLANNING') return;
      if (!this.planningTimerActive) return;
      if (this.autoStartTriggered) return;

      if (this.getPlanningTimeLeftMs() <= 0) {
        this.autoStartTriggered = true;
        console.log('[TurnManager]: Время планирования вышло. Автоматический запуск симуляции.');
        this.startTurnExecution();
      }
    }

    getPlanningTimeLeftMs() {
      const limit = GAME_CONFIG.turn.planningTimeLimit || 0;

      if (limit <= 0) return 0;

      const elapsed = performance.now() - this.planningTimerStartedAt;
      const total = limit * 1000;

      return Math.max(0, total - elapsed);
    }

    getPlanningTimeLeftSeconds() {
      return Math.ceil(this.getPlanningTimeLeftMs() / 1000);
    }

    formatPlanningTime() {
      const limit = GAME_CONFIG.turn.planningTimeLimit || 0;

      if(limit <= 0) return '--:--';

      const totalSeconds = this.getPlanningTimeLeftSeconds();
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;

      return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }

    isPlanningTimerWarning() {
      const warningTime = GAME_CONFIG.turn.planningWarningTime || 15;

      return (
        window.gameState === 'PLANNING' &&
        this.planningTimerActive &&
        this.getPlanningTimeLeftSeconds() <= warningTime
      );
    }
}
