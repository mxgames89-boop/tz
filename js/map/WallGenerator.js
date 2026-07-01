import { GAME_CONFIG } from '../config.js';

export class WallGenerator {
    constructor(grid) {
        this.BITMASK_TO_TEXTURE = {
            0: 'wall_single',
            1: 'wall_end_right',
            2: 'wall_end_dialeft',
            4: 'wall_end_diaright2',
            8: 'wall_end_left',
            16: 'wall_end_diaright',
            32: 'wall_end_dialeft2',
            9:  'wall_horizontal',
            18: 'wall_diagonal_1',
            36: 'wall_diagonal_2',
            3: 'wall_corner_5',
            6: 'wall_corner_7',
            12: 'wall_corner_2',
            24: 'wall_corner_6',
            48: 'wall_corner_7',
            33: 'wall_corner_5',
            5: 'wall_corner_5',
            10: 'wall_corner_6',
            20: 'wall_corner_7',
            40: 'wall_corner_4',
            17: 'wall_corner_2',
            34: 'wall_corner_3',
            7: 'wall_corner_2',
            14: 'wall_corner_6',
            28: 'wall_corner_7',
            56: 'wall_corner_5',
            49: 'wall_corner_6',
            35: 'wall_corner_3',
            21: 'wall_corner_2',
            42: 'wall_corner_5',
            25: 'wall_corner_2',
            19: 'wall_diagonal_3',
            22: 'wall_diagonal_3',
            26: 'wall_diagonal_3',
            50: 'wall_diagonal_3',
            37: 'wall_diagonal_4',
            38: 'wall_diagonal_4',
            44: 'wall_diagonal_4',
            52: 'wall_diagonal_4',
            30: 'wall_diagonal_3',
            60: 'wall_diagonal_4',
            57: 'wall_corner_5',
            39: 'wall_diagonal_3',
            45: 'wall_corner_6',
            54: 'wall_corner_5',
        };

        this.DIRECTION_BITS = [1, 2, 4, 8, 16, 32];
        this.maxHp = GAME_CONFIG.objectmap.wall.maxHp;
        this.hp = GAME_CONFIG.objectmap.wall.hp;
        this.passability = GAME_CONFIG.objectmap.wall.passability;
        this.grid = grid;
    }

    /**
     * Получить случайное направление на гексагональной сетке
     */
    _getRandomDirection(r) {
        const hexdirect = this.grid.getHexNeighbors(r);
        return hexdirect[Math.floor(Math.random() * hexdirect.length)];
    }

    /**
     * ПОДХОД 1: Генерация длинных заборов / линейных руин (Алгоритм "Пьяница")
     * @param {number} startQ, startR - Начальная точка забора
     * @param {number} length - Максимальная длина забора
     * @param {number} straightness - Шанс (0-1) продолжить движение прямо (чтобы забор не петлял)
     */
    generateFence(length = 5, straightness = 0.7, game){

        const hexLookup = new Map(game.grid.hexes.map(hex => [`${hex.q},${hex.r}`, hex]));
        const blockedSet = new Set(game.nonspawn.map(hex => `${hex.q},${hex.r}`));

        // 2. Выбираем случайную СУЩЕСТВУЮЩУЮ точку на вашей карте для старта забора
        const validStartHexes = game.grid.hexes.filter(h => !blockedSet.has(`${h.q},${h.r}`));
        if (validStartHexes.length === 0) return;

        const startHex = validStartHexes[Math.floor(Math.random() * validStartHexes.length)];

        let fenceHexes;
        const uniqueWallsMap = new Map();

        let current = { q: startHex.q, r: startHex.r};

        let lastDirIndex = Math.floor(Math.random() * 6);

        for (let i = 0; i < length; i++) {

            const key = `${current.q},${current.r}`;

            if(hexLookup.has(key) && !blockedSet.has(key)){
                const realHex = hexLookup.get(key);

                if(realHex){
                    uniqueWallsMap.set(key, {
                        type: 'wall',
                        hp: this.hp,
                        maxHp: this.maxHp,
                        q: current.q,
                        r: current.r,
                        x: realHex.x,
                        y: realHex.y,
                        update : false,
                        'passability': this.passability
                    });
                }
            }

            const neighbors = this.grid.getHexNeighbors(current.q, current.r);

            if (Math.random() > straightness) {
                lastDirIndex = Math.floor(Math.random() * 6);
            }

            const nextStep = neighbors[lastDirIndex];
               
            current.q = nextStep.q;
            current.r = nextStep.r;
        }

        fenceHexes = Array.from(uniqueWallsMap.values());
        fenceHexes.forEach(wall => game.nonspawn.push({q: wall.q, r: wall.r}));
        return fenceHexes;
    }

    /**
     * ПОДХОД 2: Генерация заброшенных построек / кучных руин (Клеточный автомат)
     * @param {number} centerQ, centerR - Центр будущего здания
     * @param {number} size - Примерный радиус постройки в гексах
     * @param {number} destruction - Шанс "разрушения" (0-1). 0 — идеальная коробка, 0.7 — почти стерта
     */
    generateRuinedHouse(radius = 2, destruction = 0.4, game) {

        const hexLookup = new Map(game.grid.hexes.map(hex => [`${hex.q},${hex.r}`, hex]));
        const blockedSet = new Set(game.nonspawn.map(hex => `${hex.q},${hex.r}`));

        // 2. Выбираем случайную СУЩЕСТВУЮЩУЮ точку на вашей карте для старта забора
        const validStartHexes = game.grid.hexes.filter(h => !blockedSet.has(`${h.q},${h.r}`));
        if (validStartHexes.length === 0) return;

        const startHex = validStartHexes[Math.floor(Math.random() * validStartHexes.length)];

        const centerKey = `${startHex.q},${startHex.r}`;
        
        // 1. Собираем ВСЕ гексы, которые входят в этот радиус от центра
        // Для этого используем волновой обход (BFS) по смещенной сетке
        const visited = new Set([centerKey]);
        let currentWave = [{ q: startHex.q, r: startHex.r, dist: 0 }];
        const allHouseHexes = [];

        while (currentWave.length > 0) {
            const current = currentWave.shift();
            allHouseHexes.push(current);

            if (current.dist < radius) {
                // Получаем точных соседей с учетом четности ряда!
                const neighbors = this.grid.getHexNeighbors(current.q, current.r);

                neighbors.forEach(neighbor => {
                    const nKey = `${neighbor.q},${neighbor.r}`;
                    if (!visited.has(nKey)) {
                        visited.add(nKey);
                        currentWave.push({ 
                            q: neighbor.q, 
                            r: neighbor.r, 
                            dist: current.dist + 1 
                        });
                    }
                });
            }
        }

        let finalWallHexes;
        const uniqueWallsMap = new Map();

        // 2. Теперь выделяем из этой кучи гексов только «внешние стены» (периметр)
        allHouseHexes.forEach(hex => {
            // Нам нужны только те гексы, которые находятся на самом краю радиуса (внешний контур дома)
            if (hex.dist === radius) {
                
                // 3. Применяем ваш фактор разрушения: случайные секции стен «выпадают»
                if (Math.random() > destruction) {

                    const key = `${hex.q},${hex.r}`;

                    if(hexLookup.has(key) && !blockedSet.has(key)){
                        const realHex = hexLookup.get(key);

                        if (realHex) {
                            uniqueWallsMap.set(key, {
                                type: 'wall',
                                hp: this.hp,
                                maxHp: this.maxHp,
                                q: hex.q,
                                r: hex.r,
                                x: realHex.x,
                                y: realHex.y,
                                update : false,
                                'passability': this.passability
                            });
                        }
                    }
                }
            }
        });

        finalWallHexes = Array.from(uniqueWallsMap.values());
        finalWallHexes.forEach(wall => game.nonspawn.push({q: wall.q, r: wall.r}));

        return finalWallHexes;
    }

    getHexBitmask(q, r, wallsSet) {
        let mask = 0;
        const directionBits = [1, 2, 4, 8, 16, 32];
        
        const neighbors = this.grid.getHexNeighbors(q, r);

        for (let i = 0; i < 6; i++) {
            const neighbor = neighbors[i];
            const neighborKey = `${neighbor.q},${neighbor.r}`;

            if (wallsSet.has(neighborKey)) {
                mask += directionBits[i];
            }
        }

        return mask;
    }
}
