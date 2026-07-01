import { Game } from './core/Game.js';
import { textureManager } from './render/TextureManager.js';
import { audioManager } from './audio/AudioManager.js';
import { libFunc } from './libFunc.js';

window.addEventListener('DOMContentLoaded', async () => {
    try { 
        
        await textureManager.loadPacks(['battle_core', 'player', 'marauder']);
        await audioManager.loadAll();
        const game = new Game('gameCanvas');

        //const asset = textureManager.get('player_idle_pistol_NE');
        //libFunc.saveShadowToFile(asset.element, 'player_idle_pistol_ne');
        //libFunc.convertPngToWebpAndDownload(asset.element, 'player_run_se_shadow');

        game.start();
    } catch (error) {
        console.error("Критическая ошибка запуска игры:", error);
    }
});