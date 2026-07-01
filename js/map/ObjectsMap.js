import { WallGenerator } from './WallGenerator.js';
import { GAME_CONFIG } from '../config.js';

export class ObjectsMap {
    constructor(game){
        this.objects = [];
        this.game = game;
        this.map = this.game.map;
    }

    generateObject(){

        this.generateWall();

        this.game.grid.hexes.forEach(hex =>{
            this.generateTrees(hex);
            this.generateStones(hex);
        });
    }

    generateTrees(hex){
        const rand = Math.random();

        const mapSet = GAME_CONFIG.settingsmaps[this.map];
        const treesSet = GAME_CONFIG.objectmap.trees;

        let dist;
        let hp;
        let texture;
        
        if(Math.random() < 0.2){
            hp = treesSet.maxHp / 2;
            texture = 'tree_pine';
        } 
        else{
            hp = treesSet.hp;
            texture = mapSet.treestype[Math.floor(Math.random() * mapSet.treestype.length)];
        } 

        const isBlocked = this.game.nonspawn.some(non => non.q === hex.q && non.r === hex.r);

        this.game.nonspawn.forEach(spawn => {
            dist = this.getHexDistance(hex.q, hex.r, spawn.q, spawn.r);
        });

        if(!isBlocked && rand < mapSet.trees && dist > 2){
            this.objects.push({'type' : 'trees', 'q': hex.q, 'r': hex.r, 'x' : hex.x, 'y' : hex.y, 'hp': hp, 'maxHp': treesSet.maxHp, 'passability': treesSet.passability, 'texture' : texture, 'update' : false});
            this.game.nonspawn.push({'q': hex.q, 'r': hex.r});
        }
    }

    generateStones(hex){
        const rand = Math.random();

        const mapSet = GAME_CONFIG.settingsmaps[this.map];
        const stoneSet = GAME_CONFIG.objectmap.stone;

        let dist;
        let hp;
        
        if(Math.random() < 0.2) hp = stoneSet.maxHp / 2;
        else hp = stoneSet.hp;

        const isBlocked = this.game.nonspawn.some(non => non.q === hex.q && non.r === hex.r);

        this.game.nonspawn.forEach(spawn => {
            dist = this.getHexDistance(hex.q, hex.r, spawn.q, spawn.r);
        });

        if(!isBlocked && rand < mapSet.stones && dist > 2){
            this.objects.push({'type' : 'stone', 'q': hex.q, 'r': hex.r, 'x' : hex.x, 'y' : hex.y, 'hp': hp, 'maxHp': stoneSet.maxHp, 'passability': stoneSet.passability, 'texture' : mapSet.stonetype[Math.floor(Math.random() * mapSet.stonetype.length)], 'update' : false});
            this.game.nonspawn.push({'q': hex.q, 'r': hex.r});
        }
    }

    generateWall(){
        const newWall = [];
        const wallGen = new WallGenerator(this.game.grid);
        const wall_horizontal = ['wall_horizontal', 'wall_horizontal3', 'wall_horizontal4', 'wall_horizontal_window'];
        const wall_diagonal = ['wall_diagonal_1', 'wall_diagonal_1_window'];
        const wall_diagonal2 = ['wall_diagonal_2', 'wall_diagonal_2_window'];
        const mapSet = GAME_CONFIG.settingsmaps[this.map];

        let randomWall;

        // Сгенерируем заборы в разных частях карты
        for(let i = 0; i < mapSet.fenceCount; i++){            
            let fence = wallGen.generateFence((Math.floor(Math.random() * (mapSet.fencemax - mapSet.fencemin + 1)) + mapSet.fencemin), mapSet.fenceStraightness, this.game);
            newWall.push(...fence);
        }

        // Сгенерируем разрушенный дом
        for(let i = 0; i < mapSet.houseCount; i++){
            let ruinedHouse = wallGen.generateRuinedHouse(mapSet.houseRadius, mapSet.houseDestruction, this.game);
            newWall.push(...ruinedHouse);
        }

        //Присваиваем стенам маску и прочее
        let walls = newWall.filter(item => item.type === 'wall');
        const wallsSet = new Set(walls.map(w => `${w.q},${w.r}`));
        walls.sort((a, b) => a.y - b.y);

        walls.forEach(wall => {
            const mask = wallGen.getHexBitmask(wall.q, wall.r, wallsSet);

            wall.texture = wallGen.BITMASK_TO_TEXTURE[mask] || 'wall_single';

            if(mask === 9){
                randomWall = wall_horizontal[Math.floor(Math.random() * wall_horizontal.length)];
                if(randomWall === 'wall_horizontal_window'){
                    wall.type = 'window';
                    wall.passability = GAME_CONFIG.objectmap.window.passability;
                } 
                else{
                    if(Math.random() < 0.2) wall.hp = wall.maxHp / 2;
                    if(wall.hp <= (wall.maxHp / 2)) randomWall = 'wall_horizontal2';
                }
                wall.texture = randomWall;
            }

            if(mask === 18){
                randomWall = wall_diagonal[Math.floor(Math.random() * wall_diagonal.length)];
                if(randomWall === 'wall_diagonal_1_window'){
                    wall.type = 'window';
                    wall.passability = GAME_CONFIG.objectmap.window.passability;
                } 
                else{
                    if(Math.random() < 0.2) wall.hp = wall.maxHp / 2;
                    if(wall.hp <= (wall.maxHp / 2)) randomWall = 'wall_diagonal_3';
                }
                wall.texture = randomWall;
            }

            if(mask === 36){
                randomWall = wall_diagonal2[Math.floor(Math.random() * wall_diagonal2.length)];
                if(randomWall === 'wall_diagonal_2_window'){
                    wall.type = 'window';
                    wall.passability = GAME_CONFIG.objectmap.window.passability;
                } 
                else{
                    if(Math.random() < 0.2) wall.hp = wall.maxHp / 2;
                    if(wall.hp <= (wall.maxHp / 2)) randomWall = 'wall_diagonal_4';
                }
                wall.texture = randomWall;
            }
        });

        this.objects.push(...walls);
    }

    update(){
        const realObstacle = this.objects.find(o => o.update === true);
        if(realObstacle){
            if(realObstacle.hp <= (realObstacle.maxHp / 2)){
                if(realObstacle.texture == 'wall_horizontal' || realObstacle.texture == 'wall_horizontal3' || realObstacle.texture == 'wall_horizontal4') realObstacle.texture = 'wall_horizontal2';
                if(realObstacle.texture == 'wall_diagonal_1') realObstacle.texture = 'wall_diagonal_3';
                if(realObstacle.texture == 'wall_diagonal_2') realObstacle.texture = 'wall_diagonal_4';
                if(realObstacle.texture == 'tree_yollow' || realObstacle.texture == 'tree_blue') realObstacle.texture = 'tree_pine';
            } 
        }
    }

    offsetToCube(q, r) {
        const x = q - (r - (r & 1)) / 2;
        const z = r;
        const y = -x - z;
        return { x, y, z };
    }

    getHexDistance(q1, r1, q2, r2) {
        const a = this.offsetToCube(q1, r1);
        const b = this.offsetToCube(q2, r2);
        return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));
    }
}
