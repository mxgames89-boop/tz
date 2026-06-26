export const SPRITES_CONFIG = {
    tiles: {
        ground_ground: { url: '../texture/ground/1.jpg', type: 'static' },
        ground_grass: { url: '../texture/ground/2.jpg', type: 'static' },
        ground_sand: { url: '../texture/ground/3.jpg',  type: 'static' },
        ground_sand2: { url: '../texture/ground/4.jpg',type: 'static' }
    },

    walls: {
        wall_single: {url : '../texture/wall/wall_single.png', type: 'autotiling', anchorX: 0.5, anchorY: 0.85},
        wall_end_right: {url : '../texture/wall/wall_end_right.png', type: 'autotiling', anchorX: 0.43, anchorY: 0.9},
        wall_end_left: {url : '../texture/wall/wall_end_left.png', type: 'autotiling', anchorX: 0.55, anchorY: 0.9},
        wall_end_dialeft: {url : '../texture/wall/wall_end_dialeft.png', type: 'autotiling', anchorX: 0.48, anchorY: 0.85},
        wall_end_dialeft2: {url : '../texture/wall/wall_end_dialeft2.png', type: 'autotiling', anchorX: 0.47, anchorY: 0.75},
        wall_end_diaright: {url : '../texture/wall/wall_end_diaright.png', type: 'autotiling', anchorX: 0.55, anchorY: 0.8},
        wall_end_diaright2: {url : '../texture/wall/wall_end_diaright2.png', type: 'autotiling', anchorX: 0.45, anchorY: 0.7},
        wall_horizontal: {url : '../texture/wall/wall_horizontal.png', type: 'autotiling', anchorX: 0.5, anchorY: 0.9},
        wall_horizontal2: {url : '../texture/wall/wall_horizontal2.png', type: 'autotiling', anchorX: 0.6, anchorY: 0.88},
        wall_horizontal3: {url : '../texture/wall/wall_horizontal3.png', type: 'autotiling', anchorX: 0.5, anchorY: 0.9},
        wall_horizontal4: {url : '../texture/wall/wall_horizontal4.png', type: 'autotiling', anchorX: 0.5, anchorY: 0.9},
        wall_horizontal_window: {url : '../texture/wall/wall_horizontal_window.png', type: 'autotiling', anchorX: 0.55, anchorY: 0.9},
        wall_diagonal_1: {url : '../texture/wall/wall_diagonal_1.png', type: 'autotiling', anchorX: 0.55, anchorY: 0.85},
        wall_diagonal_1_window: {url : '../texture/wall/wall_diagonal_1_window.png', type: 'autotiling', anchorX: 0.55, anchorY: 0.85},
        wall_diagonal_2: {url : '../texture/wall/wall_diagonal_2.png', type: 'autotiling', anchorX: 0.45, anchorY: 0.8},
        wall_diagonal_2_window: {url : '../texture/wall/wall_diagonal_2_window.png', type: 'autotiling', anchorX: 0.47, anchorY: 0.85},
        wall_diagonal_3: {url : '../texture/wall/wall_diagonal_3.png', type: 'autotiling', anchorX: 0.55, anchorY: 0.85},
        wall_diagonal_4: {url : '../texture/wall/wall_diagonal_4.png', type: 'autotiling', anchorX: 0.45, anchorY: 0.8},
        wall_corner_2: {url : '../texture/wall/wall_corner_2.png', type: 'autotiling', anchorX: 0.5, anchorY: 0.9},
        wall_corner_3: {url : '../texture/wall/wall_corner_3.png', type: 'autotiling', anchorX: 0.5, anchorY: 0.8},
        wall_corner_4: {url : '../texture/wall/wall_corner_4.png', type: 'autotiling', anchorX: 0.55, anchorY: 0.9},
        wall_corner_5: {url : '../texture/wall/wall_corner_5.png', type: 'autotiling', anchorX: 0.5, anchorY: 0.85},
        wall_corner_6: {url : '../texture/wall/wall_corner_6.png', type: 'autotiling', anchorX: 0.5, anchorY: 0.85},
        wall_corner_7: {url : '../texture/wall/wall_corner_7.png', type: 'autotiling', anchorX: 0.5, anchorY: 0.85}
    },

    players: {
        player_idle_E:  { url: '../texture/player/player_idle_e.webp',  type: 'spritesheet', frames: 16, anchorX: 0.56, anchorY: 0.87, frameWidth: 48.5, frameHeight: 100, cols: 4, speed: 38},
        player_idle_SE:  { url: '../texture/player/player_idle_se.webp',  type: 'spritesheet', frames: 16, anchorX: 0.56, anchorY: 0.87, frameWidth: 54, frameHeight: 100, cols: 4, speed: 35},
        player_idle_NE:  { url: '../texture/player/player_idle_ne.webp',  type: 'spritesheet', frames: 16, anchorX: 0.56, anchorY: 0.87, frameWidth: 47.5, frameHeight: 100, cols: 4, speed: 34},
        
        player_run_E:  { url: '../texture/player/player_run_e.webp',  type: 'spritesheet', frames: 24, anchorX: 0.56, anchorY: 0.87, frameWidth: 61.166666, frameHeight: 100, cols: 6, speed: 32},
        player_run_NE:  { url: '../texture/player/player_run_ne.webp',  type: 'spritesheet', frames: 25, anchorX: 0.56, anchorY: 0.87, frameWidth: 53.6, frameHeight: 100, cols: 5, speed: 35},
        player_run_SE:  { url: '../texture/player/player_run_se.webp',  type: 'spritesheet', frames: 36, anchorX: 0.56, anchorY: 0.87, frameWidth: 49.1, frameHeight: 100, cols: 6, speed: 32},

        player_idle_laser_E:  { url: '../texture/player/player_idle_laser_e.png',  type: 'static', anchorX: 0.40, anchorY: 0.87},
        player_idle_laser_SE:  { url: '../texture/player/player_idle_laser_se.png',  type: 'static', anchorX: 0.40, anchorY: 0.87},
        player_idle_laser_NE:  { url: '../texture/player/player_idle_laser_ne.png',  type: 'static', anchorX: 0.40, anchorY: 0.87},

        player_crawl_laser_E:  { url: '../texture/player/player_crawl_laser_e.png',  type: 'static', anchorX: 0.35, anchorY: 0.87},
        player_crawl_laser_SE:  { url: '../texture/player/player_crawl_laser_se.png',  type: 'static', anchorX: 0.40, anchorY: 0.87},
        player_crawl_laser_NE:  { url: '../texture/player/player_crawl_laser_ne.png',  type: 'static', anchorX: 0.40, anchorY: 0.87},

        player_crawl_E:  { url: '../texture/player/player_crawl_e.png',  type: 'static', anchorX: 0.56, anchorY: 0.87},
        player_crawl_SE:  { url: '../texture/player/player_crawl_se.png',  type: 'static', anchorX: 0.5, anchorY: 0.8},
        player_crawl_NE:  { url: '../texture/player/player_crawl_ne.png',  type: 'static', anchorX: 0.5, anchorY: 0.8},

        player_cover_E:  { url: '../texture/player/player_cover_e.png',  type: 'static', anchorX: 0.5, anchorY: 0.87},
        player_cover_SE:  { url: '../texture/player/player_cover_se.png',  type: 'static', anchorX: 0.45, anchorY: 0.87},
        player_cover_NE:  { url: '../texture/player/player_cover_ne.png',  type: 'static', anchorX: 0.45, anchorY: 0.87},

        enemy_idle_E:  { url: '../texture/player/player_idle_e.webp',  type: 'spritesheet', frames: 16, anchorX: 0.56, anchorY: 0.87, frameWidth: 48.5, frameHeight: 100, cols: 4, speed: 38},
        enemy_idle_SE:  { url: '../texture/player/player_idle_se.webp',  type: 'spritesheet', frames: 16, anchorX: 0.56, anchorY: 0.87, frameWidth: 54, frameHeight: 100, cols: 4, speed: 35},
        enemy_idle_NE:  { url: '../texture/player/player_idle_ne.webp',  type: 'spritesheet', frames: 16, anchorX: 0.56, anchorY: 0.87, frameWidth: 47.5, frameHeight: 100, cols: 4, speed: 34},
    },

    environment: {
        tree_yollow: {url: '../texture/trees/1.png', type: 'static', anchorX: 0.43, anchorY: 0.88},
        tree_blue: {url: '../texture/trees/2.png', type: 'static', anchorX: 0.40, anchorY: 0.88},
        tree_pine: {url: '../texture/trees/1_half.png', type: 'static', anchorX: 0.48, anchorY: 0.73},
        stone_large: {url: '../texture/stones/1.png', type: 'static', anchorX: 0.5, anchorY: 0.7}
    },

    ui: {
        userpanel: {url: '../texture/ui/battle/user.png', type: 'static', anchorX: 0.5, anchorY: 1},
        state: {url: '../texture/ui/battle/state2.png', type: 'static', anchorX: 0.5, anchorY: 1},
        gunpanel: {url: '../texture/ui/battle/gunpanel.png', type: 'static', anchorX: 0.5, anchorY: 1},
        cells: {url: '../texture/ui/battle/cells.png', type: 'static', anchorX: 0.5, anchorY: 1},
        cells2: {url: '../texture/ui/battle/cells2.png', type: 'static', anchorX: 0.5, anchorY: 1},
        cells3: {url: '../texture/ui/battle/cells3.png', type: 'static', anchorX: 0.5, anchorY: 1},
        cells4: {url: '../texture/ui/battle/cells4.png', type: 'static', anchorX: 0.5, anchorY: 1},
        cells5: {url: '../texture/ui/battle/cells5.png', type: 'static', anchorX: 0.5, anchorY: 1},
        cells6: {url: '../texture/ui/battle/cells6.png', type: 'static', anchorX: 0.5, anchorY: 1},
        state_panel_btn: {url: '../texture/ui/battle/state-panel-btn.png', type: 'spritesheet', frames: 10, anchorX: 0.5, anchorY: 1}
    },

    shadow: {
        tree_yollow_shadow: {url: '../texture/trees/1_shadow.png', type: 'static', anchorX: 0.43, anchorY: 0.88},
        tree_blue_shadow: {url: '../texture/trees/2_shadow.png', type: 'static', anchorX: 0.40, anchorY: 0.88},
        tree_pine_shadow: {url: '../texture/trees/1_half_shadow.png', type: 'static', anchorX: 0.48, anchorY: 0.73},
        stone_large_shadow: {url: '../texture/stones/1_shadow.png', type: 'static', anchorX: 0.5, anchorY: 0.7},
        wall_single_shadow: {url : '../texture/wall/wall_single_shadow.png', type: 'autotiling', anchorX: 0.5, anchorY: 0.85},
        wall_end_right_shadow: {url : '../texture/wall/wall_end_right_shadow.png', type: 'autotiling', anchorX: 0.43, anchorY: 0.9},
        wall_end_left_shadow: {url : '../texture/wall/wall_end_left_shadow.png', type: 'autotiling', anchorX: 0.55, anchorY: 0.9},
        wall_end_dialeft_shadow: {url : '../texture/wall/wall_end_dialeft_shadow.png', type: 'autotiling', anchorX: 0.48, anchorY: 0.85},
        wall_end_dialeft2_shadow: {url : '../texture/wall/wall_end_dialeft2_shadow.png', type: 'autotiling', anchorX: 0.47, anchorY: 0.75},
        wall_end_diaright_shadow: {url : '../texture/wall/wall_end_diaright_shadow.png', type: 'autotiling', anchorX: 0.55, anchorY: 0.8},
        wall_end_diaright2_shadow: {url : '../texture/wall/wall_end_diaright2_shadow.png', type: 'autotiling', anchorX: 0.45, anchorY: 0.7},
        wall_horizontal_shadow: {url : '../texture/wall/wall_horizontal_shadow.png', type: 'autotiling', anchorX: 0.5, anchorY: 0.9},
        wall_horizontal2_shadow: {url : '../texture/wall/wall_horizontal2_shadow.png', type: 'autotiling', anchorX: 0.6, anchorY: 0.88},
        wall_horizontal3_shadow: {url : '../texture/wall/wall_horizontal3_shadow.png', type: 'autotiling', anchorX: 0.5, anchorY: 0.9},
        wall_horizontal4_shadow: {url : '../texture/wall/wall_horizontal4_shadow.png', type: 'autotiling', anchorX: 0.5, anchorY: 0.9},
        wall_horizontal_window_shadow: {url : '../texture/wall/wall_horizontal_window_shadow.png', type: 'autotiling', anchorX: 0.55, anchorY: 0.9},
        wall_diagonal_1_shadow: {url : '../texture/wall/wall_diagonal_1_shadow.png', type: 'autotiling', anchorX: 0.55, anchorY: 0.85},
        wall_diagonal_1_window_shadow: {url : '../texture/wall/wall_diagonal_1_window_shadow.png', type: 'autotiling', anchorX: 0.55, anchorY: 0.85},
        wall_diagonal_2_shadow: {url : '../texture/wall/wall_diagonal_2_shadow.png', type: 'autotiling', anchorX: 0.45, anchorY: 0.8},
        wall_diagonal_2_window_shadow: {url : '../texture/wall/wall_diagonal_2_window_shadow.png', type: 'autotiling', anchorX: 0.47, anchorY: 0.85},
        wall_diagonal_3_shadow: {url : '../texture/wall/wall_diagonal_3_shadow.png', type: 'autotiling', anchorX: 0.55, anchorY: 0.85},
        wall_diagonal_4_shadow: {url : '../texture/wall/wall_diagonal_4_shadow.png', type: 'autotiling', anchorX: 0.45, anchorY: 0.8},
        wall_corner_2_shadow: {url : '../texture/wall/wall_corner_2_shadow.png', type: 'autotiling', anchorX: 0.5, anchorY: 0.9},
        wall_corner_3_shadow: {url : '../texture/wall/wall_corner_3_shadow.png', type: 'autotiling', anchorX: 0.5, anchorY: 0.8},
        wall_corner_4_shadow: {url : '../texture/wall/wall_corner_4_shadow.png', type: 'autotiling', anchorX: 0.55, anchorY: 0.9},
        wall_corner_5_shadow: {url : '../texture/wall/wall_corner_5_shadow.png', type: 'autotiling', anchorX: 0.5, anchorY: 0.85},
        wall_corner_6_shadow: {url : '../texture/wall/wall_corner_6_shadow.png', type: 'autotiling', anchorX: 0.5, anchorY: 0.85},
        wall_corner_7_shadow: {url : '../texture/wall/wall_corner_7_shadow.png', type: 'autotiling', anchorX: 0.5, anchorY: 0.85},

        player_idle_E_shadow: { url: '../texture/player/player_idle_e_shadow.webp',  type: 'spritesheet', frames: 16, anchorX: 0.56, anchorY: 0.87, frameWidth: 48.5, frameHeight: 100, cols: 4, speed: 38},
        player_idle_SE_shadow:  { url: '../texture/player/player_idle_se_shadow.webp',  type: 'spritesheet', frames: 16, anchorX: 0.56, anchorY: 0.87, frameWidth: 54, frameHeight: 100, cols: 4, speed: 35},
        player_idle_NE_shadow:  { url: '../texture/player/player_idle_ne_shadow.webp',  type: 'spritesheet', frames: 16, anchorX: 0.56, anchorY: 0.87, frameWidth: 47.5, frameHeight: 100, cols: 4, speed: 34},

        enemy_idle_E_shadow: { url: '../texture/player/player_idle_e_shadow.webp',  type: 'spritesheet', frames: 16, anchorX: 0.56, anchorY: 0.87, frameWidth: 48.5, frameHeight: 100, cols: 4, speed: 38},
        enemy_idle_SE_shadow:  { url: '../texture/player/player_idle_se_shadow.webp',  type: 'spritesheet', frames: 16, anchorX: 0.56, anchorY: 0.87, frameWidth: 54, frameHeight: 100, cols: 4, speed: 35},
        enemy_idle_NE_shadow:  { url: '../texture/player/player_idle_ne_shadow.webp',  type: 'spritesheet', frames: 16, anchorX: 0.56, anchorY: 0.87, frameWidth: 47.5, frameHeight: 100, cols: 4, speed: 34},

        player_run_E_shadow:  { url: '../texture/player/player_run_e_shadow.webp',  type: 'spritesheet', frames: 24, anchorX: 0.56, anchorY: 0.87, frameWidth: 61.166666, frameHeight: 100, cols: 6, speed: 32},
        player_run_NE_shadow:  { url: '../texture/player/player_run_ne_shadow.webp',  type: 'spritesheet', frames: 25, anchorX: 0.56, anchorY: 0.87, frameWidth: 53.6, frameHeight: 100, cols: 5, speed: 35},
        player_run_SE_shadow:  { url: '../texture/player/player_run_se_shadow.webp',  type: 'spritesheet', frames: 36, anchorX: 0.56, anchorY: 0.87, frameWidth: 49.1, frameHeight: 100, cols: 6, speed: 32},
        player_idle_laser_E_shadow:  { url: '../texture/player/player_idle_laser_e_shadow.png',  type: 'static', anchorX: 0.40, anchorY: 0.87},
        player_idle_laser_SE_shadow:  { url: '../texture/player/player_idle_laser_se_shadow.png',  type: 'static', anchorX: 0.40, anchorY: 0.87},
        player_idle_laser_NE_shadow:  { url: '../texture/player/player_idle_laser_ne_shadow.png',  type: 'static', anchorX: 0.40, anchorY: 0.87},
        player_crawl_E_shadow: { url: '../texture/player/player_crawl_e_shadow.png',  type: 'static', anchorX: 0.5, anchorY: 0.87},
        player_crawl_SE_shadow: { url: '../texture/player/player_crawl_se_shadow.png',  type: 'static', anchorX: 0.45, anchorY: 0.84},
        player_crawl_NE_shadow: { url: '../texture/player/player_crawl_ne_shadow.png',  type: 'static', anchorX: 0.45, anchorY: 0.84},
        player_cover_E_shadow: { url: '../texture/player/player_cover_e_shadow.png',  type: 'static', anchorX: 0.5, anchorY: 0.87},
        player_cover_SE_shadow: { url: '../texture/player/player_cover_se_shadow.png',  type: 'static', anchorX: 0.45, anchorY: 0.84},
        player_cover_NE_shadow: { url: '../texture/player/player_cover_ne_shadow.png',  type: 'static', anchorX: 0.45, anchorY: 0.84},
        player_crawl_laser_E_shadow:  { url: '../texture/player/player_crawl_laser_e_shadow.png',  type: 'static', anchorX: 0.35, anchorY: 0.87},
        player_crawl_laser_SE_shadow:  { url: '../texture/player/player_crawl_laser_se_shadow.png',  type: 'static', anchorX: 0.40, anchorY: 0.87},
        player_crawl_laser_NE_shadow:  { url: '../texture/player/player_crawl_laser_ne_shadow.png',  type: 'static', anchorX: 0.40, anchorY: 0.87},
    },

    guns: {
        pm: { url: '../texture/weapon/pm.png', type: 'static'},
        lasergun: { url: '../texture/weapon/lasergun.png', type: 'static'}
    },

    vfx: {
        //fx_blood_spurt: { url: '../texture/vfx/blood.webp',    type: 'spritesheet', frames: 4 },
        //fx_muzzle_flash: { url: '../texture/vfx/flash.webp',    type: 'spritesheet', frames: 3 }
    }
};
