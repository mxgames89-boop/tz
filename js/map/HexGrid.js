import { GAME_CONFIG } from '../config.js';

export class HexGrid {
    constructor(map, nonspawn){
        this.R = GAME_CONFIG.grid.radius;
        this.isoYScale = GAME_CONFIG.grid.isoYScale;
        this.rows = GAME_CONFIG.settingsmaps[map].rows || GAME_CONFIG.grid.rows;
        this.cols = GAME_CONFIG.settingsmaps[map].cols || GAME_CONFIG.grid.cols;
        this.width = Math.sqrt(3) * this.R;
        this.height = 2 * this.R;
        this.horizontalSpacing = this.width;
        this.verticalSpacing = 1.5 * this.R * this.isoYScale;
        this.hexes = [];
        this.plannedPath = [];
        this.highlights = [];
        this.nonspawn = nonspawn;
    }

    generateGrid() {
        for(let r = 0; r < this.rows; r++){
            for(let q = 0; q < this.cols; q++){
                let x = q * this.horizontalSpacing + (this.width / 2);
                let y = r * this.verticalSpacing + (this.R * this.isoYScale);
                if (r % 2 !== 0) x += this.width / 2;
                this.hexes.push({ q, r, x, y });
            }
        }
    }

    getHexNeighbors(q, r){
        // Проверяем ряд на четность (остаток от деления на 2)
        const isEven = (r % 2 === 0);

        if (isEven) {
            // Если РЯД ЧЕТНЫЙ (r = 0, 2, 4, 6...)
            return [
                { q: q + 1, r: r },     // 0: Право
                { q: q,     r: r + 1 }, // 1: Юго-право
                { q: q - 1, r: r + 1 }, // 2: Юго-лево
                { q: q - 1, r: r },     // 3: Лево
                { q: q - 1, r: r - 1 }, // 4: Северо-лево
                { q: q,     r: r - 1 }  // 5: Северо-право
            ];
        } else {
            // Если РЯД НЕЧЕТНЫЙ (r = 1, 3, 5, 7...) — диагональные соседи смещаются по оси Q вперед!
            return [
                { q: q + 1, r: r },     // 0: Право
                { q: q + 1, r: r + 1 }, // 1: Юго-право
                { q: q,     r: r + 1 }, // 2: Юго-лево
                { q: q - 1, r: r },     // 3: Лево
                { q: q,     r: r - 1 }, // 4: Северо-лево
                { q: q + 1, r: r - 1 }  // 5: Северо-право
            ];
        }
    }

    //Функция поиска кратчайшего пути с учетом заблокированных гексов
    getReachableZone(entity) {
        const reachable = new Map();
        const startKey = `${entity.plannedQ},${entity.plannedR}`;

        // 1. Собираем только статические преграды карты (стены, камни, деревья)
        const blockedSet = new Set(this.nonspawn.map(hex => `${hex.q},${hex.r}`));

        // 2. ДИНАМИЧЕСКИЙ БЛОК: Добавляем в преграды позиции ВСЕХ ОСТАЛЬНЫХ живых существ,
        // но строго пропускаем самого себя (свои plannedQ и plannedR), чтобы не блокировать свой старт!
        const entitiesArray = window.entities;
        if (entitiesArray) {
            entitiesArray.forEach(otherEntity => {
                if(otherEntity.type === 'player') return;
                blockedSet.add(`${otherEntity.q},${otherEntity.r}`);
            });
        }

        const validHexesSet = new Set(this.hexes.map(hex => `${hex.q},${hex.r}`));
        const queue = [{ q: entity.plannedQ, r: entity.plannedR, nextVirtualStep: entity.plannedStepsCount + 1}];

        // Начальная точка: потрачено 0 AP
        reachable.set(startKey, 0);

        while (queue.length > 0) {
            const current = queue.shift();
            const currentKey = `${current.q},${current.r}`;
            const currentCost = reachable.get(currentKey);

            const neighbors = this.getHexNeighbors(current.q, current.r);

            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.q},${neighbor.r}`;

                // Номер следующего шага по цепочке
                const thisStepCost = entity.getStepCostAP(current.nextVirtualStep);
                const newCost = currentCost + thisStepCost;

                if (newCost <= entity.currentAP && !blockedSet.has(neighborKey) && validHexesSet.has(neighborKey)) {
                    if (!reachable.has(neighborKey) || newCost < reachable.get(neighborKey)) {
                        reachable.set(neighborKey, newCost);
                        queue.push({ q: neighbor.q, r: neighbor.r, nextVirtualStep: current.nextVirtualStep + 1});
                    }
                }
            }
        }

        return reachable;
    }

    findSmartPath(entity, targetQ, targetR) {
        const targetKey = `${targetQ},${targetR}`;
        const startKey = `${entity.plannedQ},${entity.plannedR}`;

        if (startKey === targetKey) return [];

        // 1. Собираем только статические преграды карты
        const blockedSet = new Set(this.nonspawn.map(hex => `${hex.q},${hex.r}`));

        // 2. ДИНАМИЧЕСКИЙ БЛОК: Добавляем в преграды позиции других существ, игнорируя себя
        const entitiesArray = window.entities;
        if (entitiesArray) {
            entitiesArray.forEach(otherEntity => {
                if(otherEntity.type === 'player') return;
                blockedSet.add(`${otherEntity.q},${otherEntity.r}`);
            });
        }

        const validHexesSet = new Set(this.hexes.map(hex => `${hex.q},${hex.r}`));

        // Если цель находится на глухой стене или за пределами карты — пути нет
        if (blockedSet.has(targetKey) || !validHexesSet.has(targetKey)) return [];

        const queue = [{ q: entity.plannedQ, r: entity.plannedR, nextVirtualStep: entity.plannedStepsCount + 1}];
        const cameFrom = new Map(); 
        const costSoFar = new Map();
        
        costSoFar.set(startKey, 0);
        let pathFound = false;

        while (queue.length > 0) {
            const current = queue.shift();
            const currentKey = `${current.q},${current.r}`;

            if (currentKey === targetKey) {
                pathFound = true;
                break;
            }

            const neighbors = this.getHexNeighbors(current.q, current.r);

            for (const neighbor of neighbors) {
                const nQ = Number(neighbor.q);
                const nR = Number(neighbor.r);

                const neighborKey = `${nQ},${nR}`;

                // 1. Проверяем только стены и границы карты
                if (blockedSet.has(neighborKey)) continue;

                const isHexOnMap = this.hexes.some(h => Number(h.q) === nQ && Number(h.r) === nR);
                if (!isHexOnMap) continue;

                // 2. Считаем просто шаги по сетке (каждый шаг весит 1 условную единицу)
                const newCost = costSoFar.get(currentKey) + 1;

                if (!costSoFar.has(neighborKey) || newCost < costSoFar.get(neighborKey)) {
                    costSoFar.set(neighborKey, newCost);
                    cameFrom.set(neighborKey, { q: current.q, r: current.r });
                    
                    // Пушим соседа дальше в очередь
                    queue.push({ q: nQ, r: nR, nextVirtualStep: current.nextVirtualStep + 1 });
                }
            }
        }

        if (!pathFound){
            console.log("Не получается найти путь");
            return [];
        } 

        const path = [];
        let currentKey = targetKey;

        while (currentKey !== startKey) {
            const [q, r] = currentKey.split(',').map(Number);
            path.unshift({ q, r }); 
            
            const prevStep = cameFrom.get(currentKey);
            currentKey = prevStep ? `${prevStep.q},${prevStep.r}` : startKey;
        }

        return path; 
    }


    //Проверяем полет пули
    traceShootRay(startQ, startR, endQ, endR) {
      const startCube = this.offsetToCube(startQ, startR);
      const endCube = this.offsetToCube(endQ, endR);

      const distance = this.getShootDistance(startQ, startR, endQ, endR);

      if (distance <= 0) return [];

      const result = [];

      for (let i = 1; i <= distance; i++) {
        const t = i / distance;
        const roundedCube = this.cubeRound(
          this.cubeLerp(startCube, endCube, t)
        );

        const hex = this.cubeToOffset(roundedCube);

        const last = result[result.length - 1];

        if (!last || last.q !== hex.q || last.r !== hex.r) {
          result.push({
            q: hex.q,
            r: hex.r
          });
        }
      }

      return result;
    }

    //Вспомогательный метод вычисления расстояния в гексах (для расчета падения урона)
    getHexDistance(q1, r1, q2, r2) {
        return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
    }

    //Проверяет расстояние от мыши до центров гексов. Радиус проверки ограничен размером ячейки.
    _getHexUnderMouse(mouseX, mouseY) {
        let closestHex = null;
        // Задаем максимальный радиус захвата, равный радиусу гекса из конфига
        let minDistance = GAME_CONFIG.grid.radius; 

        this.hexes.forEach(hex => {
            // Считаем дельту по осям X и Y
            const dx = mouseX - hex.x;
            // Корректируем Y: так как мир сплющен по isoYScale, 
            // мы делим расстояние на этот коэффициент, возвращаясь в круглую геометрию для точного расчета
            const dy = (mouseY - hex.y) / GAME_CONFIG.grid.isoYScale;

            // Расстояние по теореме Пифагора
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Если этот гекс ближе к мышке, чем предыдущие проверенные
            if (distance < minDistance) {
                minDistance = distance;
                closestHex = hex;
            }
        });

        return closestHex; // Возвращает объект гекса {q, r, x, y} или null
    }

    // Перевод odd-r offset координат в cube координаты.
    // У тебя именно odd-r, потому что нечётные строки r % 2 !== 0 сдвигаются вправо.
    offsetToCube(q, r) {
      const col = Number(q);
      const row = Number(r);

      const x = col - ((row - (row & 1)) / 2);
      const z = row;
      const y = -x - z;

      return { x, y, z };
    }

    cubeToOffset(cube) {
      const row = Number(cube.z);
      const col = Number(cube.x) + ((row - (row & 1)) / 2);

      return {
        q: col,
        r: row
      };
    }

    cubeLerp(a, b, t) {
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t
      };
    }

    cubeRound(cube) {
      let rx = Math.round(cube.x);
      let ry = Math.round(cube.y);
      let rz = Math.round(cube.z);

      const xDiff = Math.abs(rx - cube.x);
      const yDiff = Math.abs(ry - cube.y);
      const zDiff = Math.abs(rz - cube.z);

      if (xDiff > yDiff && xDiff > zDiff) {
        rx = -ry - rz;
      } else if (yDiff > zDiff) {
        ry = -rx - rz;
      } else {
        rz = -rx - ry;
      }

      return {
        x: rx,
        y: ry,
        z: rz
      };
    }

    // Универсальная дальность для стрельбы по hex-сетке.
    // Это НЕ пеший маршрут и НЕ поиск пути.
    // Это геометрическая дистанция между гексами.
    getShootDistance(q1, r1, q2, r2) {
      const a = this.offsetToCube(q1, r1);
      const b = this.offsetToCube(q2, r2);

      return Math.max(
        Math.abs(a.x - b.x),
        Math.abs(a.y - b.y),
        Math.abs(a.z - b.z)
      );
    }

    // Проверка: находится ли цель в дальности оружия.
    isInShootRange(q1, r1, q2, r2, range) {
      return this.getShootDistance(q1, r1, q2, r2) <= Number(range);
    }

    // Ограничивает луч пули по правильной дальности стрельбы.
    // Это нужно вместо bulletRay.length > weaponConfig.maxRange.
    limitBulletRayByShootRange(startQ, startR, bulletRay, maxRange) {
      const limitedRay = [];

      for (const hex of bulletRay) {
        const distance = this.getShootDistance(
          startQ,
          startR,
          hex.q,
          hex.r
        );

        if (distance > maxRange) {
          break;
        }

        limitedRay.push(hex);
      }

      return limitedRay;
    }
}