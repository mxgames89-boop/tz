import { TILES_SPRITES } from './sprites/tilesSprites.js';
import { WALL_SPRITES } from './sprites/wallSprites.js';
import { ENVIRONMENT_SPRITES } from './sprites/environmentSprites.js';
import { WEAPONS_SPRITES } from './sprites/weaponsSprites.js';
import { BATTLEUI_SPRITES } from './sprites/battleuiSprites.js';

import { NOOB_SPRITES } from './sprites/characters/noobSprites.js';
import { MARAUDER_SPRITES } from './sprites/characters/marauderSprites.js';


export const SPRITE_PACKS = {
  battle_core: {
    ...TILES_SPRITES,
    ...WALL_SPRITES,
    ...ENVIRONMENT_SPRITES,
    ...BATTLEUI_SPRITES,
    ...WEAPONS_SPRITES
  },

  player: {
    ...NOOB_SPRITES
  },

  marauder: {
    ...MARAUDER_SPRITES
  }
};