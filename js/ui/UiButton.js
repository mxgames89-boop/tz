import { textureManager } from '../render/TextureManager.js';

export class UiButton {
    /**
     * @param {object} config - Настройки кнопки { id, text, x, y, width, height, onClick }
     */
    constructor(config) {
        this.id = config.id;
        this.text = config.text;
        this.x = config.x;
        this.y = config.y;
        this.width = config.width;
        this.height = config.height;
        this.onClick = config.onClick;
        this.checked = config.checked;
        this.type = config.type;

        // Стили в стиле постапокалипсиса TimeZero (темный фон, неоновый зеленый контур)
        this.color = '#1a1a1a';
        this.hoverColor = '#2d2d2d';
        this.isHovered = false;
    }

    /**
     * Проверяет, попал ли курсор мыши внутрь границ кнопки
     */
    isMouseInside(mouseX, mouseY) {
        return mouseX >= this.x && mouseX <= this.x + this.width &&
               mouseY >= this.y && mouseY <= this.y + this.height;
    }

    /**
     * Отрисовка кнопки на Canvas
     */
    draw(ctx) {
        ctx.save();

        //Если это кнопки переключения состояние передвижения
        if(this.type == 'state'){
            const asset = textureManager.get('state_panel_btn');
            let sourceX;

            ctx.translate(this.x, this.y);

            if(this.id == 'user-state-idle'){
                if(this.isHovered || this.checked) sourceX = 1 * asset.frameWidth;
                else sourceX = 0 * asset.frameWidth;
            }

            if(this.id == 'user-state-run'){
                if(this.isHovered || this.checked) sourceX = 3 * asset.frameWidth;
                else sourceX = 2 * asset.frameWidth;
            }

            if(this.id == 'user-state-crawl'){
                if(this.isHovered || this.checked) sourceX = 5 * asset.frameWidth;
                else sourceX = 4 * asset.frameWidth;
            }

            if(this.id == 'user-state-cover'){
                if(this.isHovered || this.checked) sourceX = 7 * asset.frameWidth;
                else sourceX = 6 * asset.frameWidth;
            }

            if(this.id == 'user-state-n'){
                if(this.isHovered || this.checked) sourceX = 9 * asset.frameWidth;
                else sourceX = 8 * asset.frameWidth;
            }
            
            const drawX = -(asset.frameWidth * asset.anchorX - 20);
            const drawY = -(asset.height * asset.anchorY - 63);

            ctx.drawImage(asset.element, sourceX, 0, this.width, this.height, drawX, drawY, asset.frameWidth, asset.height);
        }

        if(this.type == 'endturn'){
            ctx.font = 'bold 15px Tahoma, Arial';
            ctx.fillStyle = '#000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            ctx.lineWidth = 2;
            ctx.strokeStyle = '#140a01';

            ctx.strokeText(this.text, this.x + 40, this.y + 19, this.width, this.height);

            if(this.isHovered) ctx.fillStyle = '#f6da1e';
            else ctx.fillStyle = '#b8a084';
            
            ctx.fillText(this.text, this.x + 40, this.y + 19, this.width, this.height);
        }
        
        ctx.restore();
    }
}
