export class SceneManager {
    constructor(game) {
        this.game = game;
        this.currentScene = null; // Ссылка на активную сцену
    }

    /**
     * Метод переключения сцен
     * @param {Class} SceneClass - Класс сцены (например, CombatScene)
     * @param {Object} [data] - Опциональные данные для передачи между сценами
     */
    changeScene(SceneClass, data = {}) {
        // 1. Если сцена уже идет, выгружаем её и очищаем события
        if (this.currentScene && this.currentScene.destroy) {
            this.currentScene.destroy();
        }

        // 2. Создаем экземпляр новой сцены
        this.currentScene = new SceneClass(this.game);

        // 3. Инициализируем её (наполнение данными)
        if (this.currentScene.init) {
            this.currentScene.init(data);
        }

        console.log(`[SceneManager]: Успешно переключено на сцену: ${SceneClass.name}`);
    }
}
