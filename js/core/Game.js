import { SceneManager } from './SceneManager.js';
import { CombatScene } from '../scenes/CombatScene.js'; // Наша стартовая сцена

export class Game {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        // Создаем менеджер сцен
        this.sceneManager = new SceneManager(this);
    }

    /**
     * Запуск игры
     */
    start() {
        // Назначаем БОЕВУЮ СЦЕНУ в качестве стартовой
        this.sceneManager.changeScene(CombatScene);
        
        // Запускаем бесконечный цикл отрисовки
        this.gameLoop();
    }

    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        // Передаем тик обновления активной сцене
        if (this.sceneManager.currentScene) {
            this.sceneManager.currentScene.update();
        }
    }

    render() {
        // Очищаем холст
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Передаем отрисовку активной сцене
        if (this.sceneManager.currentScene) {
            this.sceneManager.currentScene.render(this.ctx);
        }
    }
}