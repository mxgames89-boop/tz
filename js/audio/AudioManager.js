import { AUDIO_LIST } from './audioList.js';

class AudioManager {
  constructor() {
    this.sounds = {};
    this.loops = {};
  }

  async loadAll() {
    const keys = Object.keys(AUDIO_LIST);

    if (keys.length === 0) return;

    const promises = keys.map(key => {
      return new Promise((resolve) => {
        const audio = new Audio();

        audio.src = AUDIO_LIST[key];
        audio.preload = 'auto';

        audio.addEventListener('canplaythrough', () => {
          this.sounds[key] = audio;
          resolve();
        }, { once: true });

        audio.addEventListener('error', () => {
          console.error(
            `[AudioManager]: Ошибка загрузки звукового файла по ключу: "${key}" ` +
            `(Путь: ${AUDIO_LIST[key]})`
          );

          resolve();
        }, { once: true });
      });
    });

    await Promise.all(promises);

    console.log(
      `[AudioManager]: Все звуковые ассеты (${Object.keys(this.sounds).length}) успешно импортированы и кэшированы!`
    );
  }

  play(key, volume = 0.5) {
    const originalAudio = this.sounds[key];

    if (!originalAudio) {
      console.warn(`[AudioManager]: Попытка сыграть несуществующий звук по ключу: "${key}"`);
      return;
    }

    const soundClone = originalAudio.cloneNode();

    soundClone.volume = volume;

    soundClone.play().catch(err => {
      console.warn(
        `[AudioManager]: Воспроизведение звука "${key}" заблокировано политикой браузера. Нужен клик по Canvas.`,
        err
      );
    });
  }

  playLoop(loopId, key, volume = 0.5) {
    if (this.loops[loopId]) {
      return;
    }

    const originalAudio = this.sounds[key];

    if (!originalAudio) {
      console.warn(`[AudioManager]: Попытка запустить loop несуществующего звука: "${key}"`);
      return;
    }

    const loopAudio = originalAudio.cloneNode();

    loopAudio.loop = true;
    loopAudio.volume = volume;

    this.loops[loopId] = loopAudio;

    loopAudio.play().catch(err => {
      console.warn(
        `[AudioManager]: Loop-звук "${key}" заблокирован браузером.`,
        err
      );

      delete this.loops[loopId];
    });
  }

  stopLoop(loopId) {
    const loopAudio = this.loops[loopId];

    if (!loopAudio) return;

    loopAudio.pause();
    loopAudio.currentTime = 0;

    delete this.loops[loopId];
  }

  stopAllLoops() {
    Object.keys(this.loops).forEach(loopId => {
      this.stopLoop(loopId);
    });
  }
}

export const audioManager = new AudioManager();