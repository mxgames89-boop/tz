import { HexGrid } from '../map/HexGrid.js';
import { ObjectsMap } from '../map/ObjectsMap.js';
import { TurnManager } from '../core/TurnManager.js';
import { InputHandler } from '../core/InputHandler.js';
import { CanvasRenderer } from '../render/CanvasRenderer.js';
import { Entity } from '../entities/Entity.js';
import { CombatUI } from '../ui/CombatUI.js';
import { battleRecorder } from '../core/BattleRecorder.js';

export class CombatScene {
    constructor(game) {
        this.game = game;
        
        // Наше игровое состояние
        this.map = 'sands';
        this.nonspawn = [{'q': 0, 'r': 0}];
        
        // Инициализируем подсистемы
        this.grid = new HexGrid(this.map, this.nonspawn);
        this.objectmap = new ObjectsMap(this);
        this.turnManager = new TurnManager(this);
        this.renderer = new CanvasRenderer(this);
        this.input = new InputHandler(this);
        this.ui = new CombatUI(this);

        this.cameraX = 0;
        this.cameraY = 0;
        this.zoom = 1.0;

        // Перевязываем ссылки, чтобы рендерер и мышь видели карту этой сцены
        this.game.grid = this.grid;
        this.game.turnManager = this.turnManager;
        this.game.input = this.input;
    }

    init(data) {
        window.gameState = 'PLANNING';
        window.entities = [];
        window.roundCount = 1;

        this.grid.generateGrid(); // Генерируем ландшафт и умные стены
        this.objectmap.generateObject(); // Генерируем объекты
        window.entities.push(new Entity('player', 2, 10, this.grid, 'AppTime')); // Добавляем главного игрока
        window.entities.push(new Entity('enemy', 47, 32, this.grid, 'Громила'));
        window.entities.push(new Entity('enemy', 25, 10, this.grid, 'Авганец'));
        window.entities.push(new Entity('enemy', 28, 10, this.grid, 'Мудила'));
        //window.entities.push(new Entity('enemy', 20, 20, this.grid, 'Путрушка'));
        //window.entities.push(new Entity('enemy', 10, 15, this.grid, 'Воевода'));
            
        // Синхронизируем ссылки для рендерера
        this.turnManager.initFirstTurn();

        //Запускаем запись логера
        battleRecorder.initMatchRecord(this);

        if (this.input) this.input._updateGridHighlights();
    }

    update(){
        //Обновляем существ если они есть
        if (window.entities) window.entities.forEach(entity => entity.update());

        if(window.gameState === 'EXECUTION'){
            this.turnManager.updateExecution();
            this.objectmap.objects.forEach(obj => {if(obj.update) this.objectmap.update();});
        }
    }

    render(ctx){
        this.renderer.render();
        if (this.ui) this.ui.draw(ctx); // Рисует кнопки и текст AP поверх всего мира

    }

    destroy() {
        if (this.input) {
            this.game.canvas.removeEventListener('mousemove', this.input._onMouseMove);
            this.game.canvas.removeEventListener('click', this.input._onMouseClick);
            this.game.canvas.removeEventListener('mouseleave', this.input._onMouseLeave);
        }
    
        // Очищаем боевые ссылки
        this.game.grid = null;
        this.game.turnManager = null;
        this.game.input = null;
        this.game.entities = [];

        this.grid = null;
        this.turnManager = null;
        this.renderer = null;
        this.input = null;
        this.ui = null;

        //Очищаем глобальные переменные
        window.entities = [];
        window.roundCount = undefined;
        
        console.log(`[CombatScene]: Боевая сцена выгружена из памяти.`);
    }
}
