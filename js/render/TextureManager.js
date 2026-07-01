import { SPRITE_PACKS } from './SpritePacks.js';

class TextureManager {
  constructor() {
    this.vault = new Map();
    this.loadedPacks = new Set();

    // Чтобы один и тот же url не создавал несколько Image в памяти.
    this.imageCacheByUrl = new Map();
  }

  async loadPack(packName){

    if (this.loadedPacks.has(packName)) {
      return;
    }

    const pack = SPRITE_PACKS[packName];

    if (!pack) {
      console.warn(`[TextureManager]: Пак "${packName}" не найден.`);
      return;
    }

    const promises = Object.entries(pack).map(([key, data]) => {
      if (this.vault.has(key)) {
        return Promise.resolve();
      }

      if (data.alias) {
        const sourceAsset = this.vault.get(data.alias);

        if (!sourceAsset) {
          console.warn(
            `[TextureManager]: Алиас "${key}" ссылается на незагруженный ассет "${data.alias}"`
          );

          return Promise.resolve();
        }

        this.vault.set(key, {
          ...sourceAsset,
          category: packName,
          aliasOf: data.alias
        });

        return Promise.resolve();
      }

      const totalFrames = data.frames || 1;

      return this._loadImage(key, data, {
        type: data.type,
        frames: totalFrames,
        category: packName
      });
    });

    await Promise.all(promises);

    this.loadedPacks.add(packName);

    console.log(
      `[TextureManager]: Загружен пак "${packName}". Всего ассетов: ${this.vault.size}`
    );
  }

  async loadPacks(packNames = []) {
    for (const packName of packNames) {
      await this.loadPack(packName);
    }
  }

  _loadImage(key, data, meta) {
    return new Promise((resolve, reject) => {
      if (!data || !data.url) {
        reject(new Error(`[TextureManager]: Отсутствует URL для ключа "${key}"`));
        return;
      }

      const saveAsset = (img) => {
        const frameWidth = data.frameWidth !== undefined
          ? data.frameWidth
          : img.width / meta.frames;

        this.vault.set(key, {
          element: img,
          type: meta.type,
          category: meta.category,
          totalFrames: meta.frames,
          width: img.width,
          height: img.height,
          frameWidth,
          speed: data.speed !== undefined ? data.speed : 30,
          anchorX: data.anchorX !== undefined ? data.anchorX : 0.5,
          anchorY: data.anchorY !== undefined ? data.anchorY : 1.0,
          frameHeight: data.frameHeight !== undefined ? data.frameHeight : img.height,
          cols: data.cols !== undefined ? data.cols : 0
        });

        resolve();
      };

      // Если этот файл уже загружался по другому ключу,
      // не создаём второй Image, а переиспользуем картинку.
      if (this.imageCacheByUrl.has(data.url)) {
        saveAsset(this.imageCacheByUrl.get(data.url));
        return;
      }

      const img = new Image();
      img.src = data.url;

      img.onload = () => {
        this.imageCacheByUrl.set(data.url, img);
        saveAsset(img);
      };

      img.onerror = () => {
        reject(
          new Error(
            `[TextureManager]: Ошибка загрузки файла в паке [${meta.category}] -> ${data.url}`
          )
        );
      };
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

  has(key) {
    return this.vault.has(key);
  }

  unloadPack(packName) {
    for (const [key, asset] of this.vault.entries()) {
      if (asset.category === packName) {
        this.vault.delete(key);
      }
    }

    this.loadedPacks.delete(packName);

    console.log(`[TextureManager]: Пак "${packName}" выгружен.`);
  }
}

export const textureManager = new TextureManager();