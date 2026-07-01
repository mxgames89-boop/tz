import { UiButton } from './UiButton.js';
import { textureManager } from '../render/TextureManager.js';
import { GAME_CONFIG } from '../config.js';
import { battleRecorder } from '../core/BattleRecorder.js';

export class CombatUserpanelUI {
    /**
     * @param {CombatScene} scene - Ссылка на текущую боевую сцену
     */
    constructor(scene) {
        this.scene = scene;
        this.width = 250;
        this.height = 404;
        this.x = scene.game.canvas.width - this.width;
        this.y = 0;
        this.interfaces = [];
        this.cells = [];
        this.buttons = [];

        this._initButtons();
    }

    _initButtons(){
        this.interfaces.push({'x' : this.x, 'y' : this.y, 'width' : 250, 'height' : 404});
        this.interfaces.push({'x' : this.x + 15, 'y' : this.y + 400, 'width' : 226, 'height' : 123});
        this.interfaces.push({'x' : this.x - 82, 'y' : this.y + 530, 'width' : 350, 'height' : 191});

        //Все кнопки переключения состояния передвижения
        this.buttons.push(new UiButton({'id' : 'user-state-idle', 'type' : 'state', 'x' : this.x + 36, 'y' : this.y + 427, 'width' : 35, 'height' : 63, 'text' : false, 'checked' : true, onClick : this.switchState.bind(this, 'user-state-idle')}));
        this.buttons.push(new UiButton({'id' : 'user-state-run', 'type' : 'state', 'x' : this.x + 73, 'y' : this.y + 427, 'width' : 35, 'height' : 63, 'text' : false, 'checked' : false, onClick : this.switchState.bind(this, 'user-state-run')}));
        this.buttons.push(new UiButton({'id' : 'user-state-crawl', 'type' : 'state', 'x' : this.x + 110, 'y' : this.y + 427, 'width' : 35, 'height' : 63, 'text' : false, 'checked' : false, onClick : this.switchState.bind(this, 'user-state-crawl')}));
        this.buttons.push(new UiButton({'id' : 'user-state-cover', 'type' : 'state', 'x' : this.x + 147, 'y' : this.y + 427, 'width' : 35, 'height' : 63, 'text' : false, 'checked' : false, onClick : this.switchState.bind(this, 'user-state-cover')}));
        
        //Пропуск од
        this.buttons.push(new UiButton({'id' : 'user-state-n', 'type' : 'state', 'x' : this.x + 184, 'y' : this.y + 427, 'width' : 35, 'height' : 63, 'text' : false, 'checked' : false, onClick : this.switchState.bind(this)}));

        //Завершить ход
        this.buttons.push(new UiButton({'id' : 'end-turn-btn', 'type' : 'endturn', 'x' : this.x - 30, 'y' : this.y + 655, 'width' : 82, 'height' : 35, 'text' : 'ГОТОВ', onClick : this.endTurn.bind(this)}));

        //Перезарядка оружия
        this.buttons.push(new UiButton({'id' : 'reload-guns', 'type' : 'reloadguns', 'x' : this.x - 30, 'y' : this.y + 655, 'width' : 82, 'height' : 35, 'text' : false, onClick : this.endTurn.bind(this)}));

        let uicells = textureManager.get('cells2');
        const cellsMax = Math.round(this.scene.game.canvas.width / (uicells.width + 5.75));

        for(var i = 1; i <= cellsMax; i++){
            let x = this.scene.game.canvas.width - (i * uicells.width) - (i * 5.75);
            let y = this.scene.game.canvas.height - uicells.height + 8;
            this.interfaces.push({'x' : x, 'y' : y, 'width' : uicells.width, 'height' : uicells.height});
            this.buttons.push(new UiButton({'id' : 'down-cellc-'+i, 'x' : x, 'y' : y, 'width' : uicells.width, 'height' : uicells.height, 'text' : false, 'texture' : false, onClick : this.switchState.bind(this.switchState)}));
        }

    }

    //Переключаем статус движения персонажа
    switchState(btnID){
        this.buttons.forEach(b => {
            if(b.type == 'state')  b.checked = false;
            if(b.type == 'state' && b.id == btnID){
                b.checked = true;
                window.entities.forEach(e => {
                    if(e.type == 'player'){
                        e.state = btnID.slice(11);
                        if(btnID.slice(11) == 'crawl' || btnID.slice(11) == 'cover') e.skin = btnID.slice(11);
                        else e.skin = 'idle';
                        e.actionQueue.addMoveAction(e.plannedQ, e.plannedR, e.state, 3, 'switch');
                    } 
                });
                if(btnID.slice(11) == 'idle') battleRecorder.addTextMessage(`Идти [3]`, "plan");
                if(btnID.slice(11) == 'run') battleRecorder.addTextMessage(`Бежать [3]`, "plan");
                if(btnID.slice(11) == 'crawl') battleRecorder.addTextMessage(`Присесть [3]`, "plan");
                if(btnID.slice(11) == 'cover') battleRecorder.addTextMessage(`Укрыться [3]`, "plan");
            } 
        });
        this.scene.game.input._updateGridHighlights();
    }

    //Заканчиваем ход
    endTurn(){
        if (window.gameState === 'PLANNING' && this.scene.turnManager){
            this.scene.turnManager.startTurnExecution();
        }
    }

    //Отрисовка интерфейса панели логов
    draw(ctx){
        ctx.save();

        this.interfaces = [];

        const player = window.entities ? window.entities.find(e => e.type === 'player') : null;

        const uiuserpanel = textureManager.get('userpanel');
        ctx.drawImage(uiuserpanel.element, this.x, this.y, 250, 404);

        const uistate = textureManager.get('state');
        ctx.drawImage(uistate.element, this.x + 15, this.y + 400, 226, 123);

        const uigun = textureManager.get('gunpanel');
        ctx.drawImage(uigun.element, this.x - 82, this.y + 530, 350, 191);

        const gun_icon = textureManager.get(player.weapon);
        ctx.drawImage(gun_icon.element, this.x - 25, this.y + 552, 220, 77);

        //Отрисовываем ячейки под хранения
        let uicells = textureManager.get('cells2');
        const cellsMax = Math.round(this.scene.game.canvas.width / (uicells.width + 5.75));

        for(var i = 1; i <= cellsMax; i++){

            if(i == 4) uicells = textureManager.get('cells3');
            else if(i == 3) uicells = textureManager.get('cells4');
            else if(i == 2) uicells = textureManager.get('cells5');
            else if(i == 1) uicells = textureManager.get('cells6');
            else uicells = textureManager.get('cells2');

            let x = this.scene.game.canvas.width - (i * uicells.width) - (i * 5.75);
            let y = this.scene.game.canvas.height - uicells.height + 8;
            
            ctx.drawImage(uicells.element, x, y, uicells.width, uicells.width);
        }

        if(player){
            //Выводим имя персонажа на панель
            ctx.font = 'bold 13px Tahoma, Arial';
            ctx.fillStyle = GAME_CONFIG.colors.textPlayer;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(`${player.name}`, this.x + 124, 150);

            //Выводим реальный таймер раунда
            const timerText = this.scene.turnManager ? this.scene.turnManager.formatPlanningTime() : '--:--';
            const isTimerWarning = this.scene.turnManager ? this.scene.turnManager.isPlanningTimerWarning() : false;

            ctx.font = 'bold 11px Tahoma, Arial';
            ctx.fillStyle = isTimerWarning ? '#ff3333' : '#f6da1e';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(timerText, this.x + 54, 161);

            //Выводим количество од на панель
            ctx.font = 'bold 14px Tahoma, Arial';
            ctx.fillStyle = '#00ff66';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(`${player.currentAP}`, this.x + 124, 190);
            ctx.restore();

            //Далее выводим полоску здорья персонажа
            this.drawGlossyBar(ctx, this.x + 78, 242, this.lightBar(player.hp, player.maxHp, 120), 10, player, player.hp, player.maxHp, 'Здоровье');

            //Далее выводим полоску стамины
            this.drawGlossyBar(ctx, this.x + 78, 278, this.lightBar(player.stamina, player.maxStamina, 120), 10, player, player.stamina, player.maxStamina, 'Выносливость', ['#8d740d', '#a08000', '#fff266', '#bb9f03', '#907604', '#7a6300']);

            //Далее выводим полоску маны
            this.drawGlossyBar(ctx, this.x + 78, 327, this.lightBar(player.mana, player.maxMana, 120), 10, player, player.mana, player.maxMana, 'Радиация',  ['#1a2b4a', '#2d5a8c', '#7ac3ff', '#1d5897', '#20456d', '#0f1a2e']);
        }
    }

    drawGlossyBar(ctx, x, y, width, height, player, param1, param2, param3, colors){
        const gradient = ctx.createLinearGradient(x, y, x, y + height);
        if(!colors) colors = ['#4a0404', '#8a0d0d', '#ff7070', '#cc0000', '#660000', '#330000'];
        
        gradient.addColorStop(0.0, colors[0]);  // 0%   - Очень темный верхний край
        gradient.addColorStop(0.15, colors[1]); // 15%  - Плавный переход
        gradient.addColorStop(0.3, colors[2]);  // 30%  - Светлый блик (создает эффект глянца)
        gradient.addColorStop(0.5, colors[3]);  // 50%  - Основной цвет
        gradient.addColorStop(0.85, colors[4]); // 85%  - Плавное затемнение
        gradient.addColorStop(1.0, colors[5]);  // 100% - Очень темный нижний край
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 2); 
        ctx.fill();

        ctx.restore();

        ctx.font = '300 11px Tahoma, Arial';
        ctx.fillStyle = '#000';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';

        ctx.fillText(`${param1} / ${param2}`, x + 131, y - 14);

        ctx.fillStyle = GAME_CONFIG.colors.textPlayer;
        ctx.fillText(`${param1} / ${param2}`, x + 129, y - 16);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#000';
        ctx.fillText(`${param3}`, x - 14, y - 14);

        ctx.fillStyle = GAME_CONFIG.colors.textPlayer;
        ctx.fillText(`${param3}`, x - 12, y - 16);
        ctx.restore();
    }

    lightBar(currentHP, maxHP, maxWidth) {
        const percentage = currentHP / maxHP;
        const currentWidth = percentage * maxWidth;
        return currentWidth;
    }
}