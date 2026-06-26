import { SPRITES_CONFIG } from './spritesConfig.js';

class TextureManager {
    constructor() {
        this.vault = new Map();
    }

    /**
     * Сканирует все категории в конфиге и запускает асинхронную загрузку
     */
    async loadAll() {
        const promises = [];

        // Перебираем категории (tiles, walls, players, mobs, environment...)
        Object.entries(SPRITES_CONFIG).forEach(([categoryName, categoryItems]) => {
            // Перебираем элементы внутри конкретной категории
            Object.entries(categoryItems).forEach(([key, data]) => {
                // Если frames не указан в конфиге, по умолчанию ставим 1 кадр (для статики)
                const totalFrames = data.frames || 1; 
                
                // ВАЖНО: передаем 'data' (объект) вторым аргументом, а метаданные — третьим
                promises.push(
                    this._loadImage(key, data, { 
                        type: data.type, 
                        frames: totalFrames,
                        category: categoryName 
                    })
                );
            });
        });

        await Promise.all(promises);
        console.log(`[TextureManager]: Успешно загружено ассетов: ${this.vault.size}`);
    }

    /**
     * Внутренний хелпер для асинхронной загрузки одной картинки
     */
    _loadImage(key, data, meta) {
        return new Promise((resolve, reject) => {
            // Проверка на случай, если в конфиге забыли написать url
            if (!data || !data.url) {
                reject(new Error(`[TextureManager]: Отсутствует URL для ключа "${key}"`));
                return;
            }

            const img = new Image();
            img.src = data.url; // Теперь data точно определен и содержит строку пути
            
            img.onload = () => {
                const frameWidth = data.frameWidth !== undefined ? data.frameWidth : img.width / meta.frames;

                // Сохраняем в единую мапу для мгновенного поиска по текстовому ключу
                this.vault.set(key, {
                    element: img,
                    type: meta.type,
                    category: meta.category,
                    totalFrames: meta.frames,
                    width: img.width,
                    height: img.height,
                    frameWidth: frameWidth,
                    speed: data.speed !== undefined ? data.speed : 30,
                    
                    // Безопасно читаем анкоры из data, возвращая дефолты если их нет
                    anchorX: data.anchorX !== undefined ? data.anchorX : 0.5,
                    anchorY: data.anchorY !== undefined ? data.anchorY : 1.0,

                    // Безопасно читаем дополнительные параметры для спрайтшитов
                    frameHeight: data.frameHeight !== undefined ? data.frameHeight : img.height,
                    cols: data.cols !== undefined ? data.cols : 0
                });
                resolve();
            };

            // Теперь здесь всегда выведется реальный путь, если картинка физически не найдется на диске
            img.onerror = () => reject(new Error(`[TextureManager]: Ошибка загрузки файла в категории [${meta.category}] -> ${data.url}`));
        });
    }

    get(key) {
        const asset = this.vault.get(key);
        if (!asset) {
            console.warn(`[TextureManager]: Ассет "${key}" не найден!`);
            return null;
        }
        return asset;
    }
}

export const textureManager = new TextureManager();