import { AUDIO_LIST } from './audioList.js';

class AudioManager {
    constructor() {
        this.sounds = {}; // Сюда кэшируются полностью готовые объекты Audio
    }

    /**
     * АСИНХРОННАЯ ПРЕДЗАГРУЗКА ЗВУКОВ
     * Запускается один раз при старте движка и загружает файлы в буфер браузера
     */
    async loadAll() {
        const keys = Object.keys(AUDIO_LIST);
        if (keys.length === 0) return;

        const promises = keys.map(key => {
            return new Promise((resolve) => {
                const audio = new Audio();
                audio.src = AUDIO_LIST[key];
                audio.preload = 'auto'; // Заставляем браузер принудительно скачать файл в кэш

                // Браузер подтверждает, что файл скачан и готов к мгновенному воспроизведению
                audio.addEventListener('canplaythrough', () => {
                    this.sounds[key] = audio;
                    resolve();
                }, { once: true });

                // Страховка от зависания загрузки, если файла физически нет на диске
                audio.addEventListener('error', () => {
                    console.error(`[AudioManager]: Ошибка загрузки звукового файла по ключу: "${key}" (Путь: ${AUDIO_LIST[key]})`);
                    resolve(); 
                }, { once: true });
            });
        });

        await Promise.all(promises);
        console.log(`[AudioManager]: Все звуковые ассеты (${Object.keys(this.sounds).length}) успешно импортированы и кэшированы!`);
    }

    /**
     * ВОСПРОИЗВЕДЕНИЕ ЗВУКА ОДНОЙ СТРОКОЙ
     * @param {string} key - Ключ звука из AUDIO_LIST (например, 'pm_shoot')
     * @param {number} [volume=0.5] - Громкость от 0.0 до 1.0
     */
    play(key, volume = 0.5) {
        const originalAudio = this.sounds[key];
        if (!originalAudio) {
            console.warn(`[AudioManager]: Попытка сыграть несуществующий звук по ключу: "${key}"`);
            return;
        }

        // Многоканальность (Multi-channel) через быстрое клонирование аудио-ноды на лету.
        // Позволяет звукам естественно накладываться друг на друга (например, при частой стрельбе).
        const soundClone = originalAudio.cloneNode();
        soundClone.volume = volume;
        
        soundClone.play().catch(err => {
            // Современные браузеры блокируют автозвук до первого клика юзера по экрану
            console.warn(`[AudioManager]: Воспроизведение звука "${key}" заблокировано политикой браузера. Нужен клик по Canvas.`, err);
        });
    }
}

// Экспортируем готовый синглтон
export const audioManager = new AudioManager();
