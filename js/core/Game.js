import { SceneManager } from './SceneManager.js';
import { CombatScene } from '../scenes/CombatScene.js'; // Наша стартовая сцена

export class Game {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        // Создаем менеджер сцен
        this.sceneManager = new SceneManager(this);

        this.lastFrameTime = 0;
    }

    /**
     * Запуск игры
     */
    start() {
        // Назначаем БОЕВУЮ СЦЕНУ в качестве стартовой
        this.sceneManager.changeScene(CombatScene);

        this.lastFrameTime = performance.now();
        
        // Запускаем бесконечный цикл отрисовки
         requestAnimationFrame((time) => this.gameLoop(time));
    }

    gameLoop(time) {
        let deltaTime = time - this.lastFrameTime;
        this.lastFrameTime = time;

        deltaTime = Math.min(deltaTime, 100);

        this.update(deltaTime);
        this.render(deltaTime);

        requestAnimationFrame((time) => this.gameLoop(time));
      }

    update(deltaTime) {
        // Передаем тик обновления активной сцене
        if (this.sceneManager.currentScene) {
            this.sceneManager.currentScene.update(deltaTime);
        }
    }

    render(deltaTime) {
        // Очищаем холст
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Передаем отрисовку активной сцене
        if (this.sceneManager.currentScene) {
            this.sceneManager.currentScene.render(this.ctx, deltaTime);
        }
    }
}