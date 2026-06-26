import { UiButton } from './UiButton.js';
import { CombatConsoleUI } from './CombatConsoleUI.js';
import { CombatUserpanelUI } from './CombatUserpanelUI.js';

export class CombatUI {
    constructor(scene) {
        this.scene = scene;
        this.buttons = [];
        this.interfaces = [];
        
        // 2. Создаем экземпляр панели логов
        this.consoleUI = new CombatConsoleUI(scene);

        // 4. Отрисовываем панель игрока
        this.userpanelUI = new CombatUserpanelUI(scene);
        
        this._initInterfaces();
        this._getActiveButtons();
    }

    //Собираем все интерфейсы в кучу
    _initInterfaces(){
        if (this.consoleUI && this.consoleUI.interfaces) {
            this.interfaces.push(...this.consoleUI.interfaces);
        }

        if (this.userpanelUI && this.userpanelUI.interfaces) {
            this.interfaces.push(...this.userpanelUI.interfaces);
        }
    }

    //Собираем все кнопки в кучу
    _getActiveButtons(){
        if (this.buttons) {
            this.buttons.push(...this.buttons);
        }

        // 2. Добавляем кнопки из панели логов
        if (this.consoleUI && this.consoleUI.buttons) {
            // Умное условие: если консоль СВЕРНУТА, мы даем мышке нажать только кнопку "LOG"
            if (this.consoleUI.isCollapsed) {
                const toggleBtn = this.consoleUI.buttons.find(b => b.id === 'log-toggle-btn');
                if (toggleBtn) this.buttons.push(toggleBtn);
            } else {
                // Если консоль РАЗВЕРНУТА, отдаем вообще все её кнопки (стрелочки, скролл)
                this.buttons.push(...this.consoleUI.buttons);
            }
        }

        if (this.userpanelUI && this.userpanelUI.buttons){
            this.buttons.push(...this.userpanelUI.buttons);
        }
    }

    // УНИВЕРСАЛЬНЫЙ МЕТОД: Проверяет, находится ли курсор мыши над любым элементом интерфейса
    isMouseOverUi(mouseX, mouseY) {

        let overInterface = false;

        if(this.interfaces.length > 0){
            this.interfaces.forEach(f => {
                if (mouseX >= f.x && mouseX <= f.x + f.width && mouseY >= f.y && mouseY <= f.y + f.height){
                    overInterface = true;
                    return;
                }
            });
        }
        return overInterface;
    }

    draw(ctx, canvas) {
        ctx.save();

        if (this.consoleUI) this.consoleUI.draw(ctx);
        if (this.userpanelUI) this.userpanelUI.draw(ctx);

        this.buttons.forEach(btn => btn.draw(ctx));
        ctx.restore();
    }
}
