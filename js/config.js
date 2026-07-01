export const GAME_CONFIG = {
    // 1. НАСТРОЙКИ ХОЛСТА И КАМЕРЫ
    canvas:{
        width: 1200,
        height: 800,
        fps: 60,
        cameraDragSensitivity: 1.0, 
        cameraMargin: 250,
        zoomSensitivity: 0.05,
        minZoom: 0.5 
    },

    // 2. ГЕОМЕТРИЯ ГЕКСАГОНАЛЬНОЙ СЕТКИ (Изометрия odd-r)
    grid:{
        radius: 30,          // Радиус гексагона (this.R из ваших прошлых вопросов)
        isoYScale: 0.6,      // Коэффициент изометрического сжатия по вертикали
        rows: 30,        // Размер карты в гексах по горизонтали
        cols: 30,       // Размер карты в гексах по вертикали
    },

    // 3. БАЛАНС ПОШАГОВОЙ СИСТЕМЫ (WeGo / Фазы)
    turn:{
        maxTicks: 10500,       // Количество дискретных тиков симуляции в одном ходу
        tickDuration: 50,    // Длительность одного тика в миллисекундах (50мс * 100 тиков = 5 секунд на ход)
        planningTimeLimit: 120 // Ограничение по времени на фазу планирования (0 — без лимита для синглплеера)
    },

    // 4. ПРАВИЛА И ХАРАКТЕРИСТИКИ СУЩЕСТВЕНОСТЕЙ (Баланс юнитов)
    entities:{
        player: {
            maxHp: 800,
            maxAp: 350, // Максимум Очков Действия (Action Points)
            CostAP: {'idle':2, 'run':1},  // Сколько AP стоит шаг на 1 гекс
            stamina: 100, // Стамина
            mana: 100, // Мана
            frameSpeed: 30,
            weapons: ['pm', 'lasergun']
        },
        enemy: {
            maxHp: 400,
            maxAp: 200, // Максимум Очков Действия (Action Points)
            CostAP: {'idle':2, 'run':1},  // Сколько AP стоит шаг на 1 гекс
            stamina: 100, // Стамина
            mana: 100, // Мана
            frameSpeed: 30, // Скорость покадровой анимации
            weapons: ['pm', 'lasergun']
        },
        mutant: {
            maxHp: 60,
            maxAp: 80,
            moveCostAP: 8,
            shootCostAP: 30,
            viewRadius: 8
        }
    },

    // 5. Характеристики оружия
    weapons: {
        pm: {
            category: 'pistol',
            name: "Пистолет Макарова",
            apCost: 8,                 // Выстрел стоит 30 ОД (из 100 возможных за раунд)
            baseDamage: 30,            // Средний урон при попадании
            accuracy: 0.85,            // Базовая точность (85% шанса попасть)
            clip_size: 12,             // Размер обоймы
            modes: [1,3],              // Режимы стрельбы
            spread: 10,                // Разброс пули
            optimalRange: 8,           // До 5 гексов урон и точность стопроцентные
            maxRange: 12,              // Дальше 12 гексов пуля физически не долетит
            damageDropPerHex: 2,       // Снижение урона на гекс
            critChance: 0.15,          // Шанс крита
            critMultiplier: 1.5,       // Модификатор урона
            projectileType: "bullet",  // Тип эффекта: обычная пуля
            projectileSpeed: 100,       // Скорость полета (пикселей за кадр)
            projectileColor: "#FFF" // Цвет снаряда
        },
        lasergun: {
            category: 'laser',
            name: "Лазерная винтовка",
            apCost: 25,                 // Выстрел стоит 30 ОД (из 100 возможных за раунд)
            baseDamage: 100,            // Средний урон при попадании
            accuracy: 0.8,            // Базовая точность (85% шанса попасть)
            clip_size: 12,             // Размер обоймы
            modes: [1,3],              // Режимы стрельбы
            spread: 30,                // Разброс пули
            optimalRange: 20,           // До 5 гексов урон и точность стопроцентные
            maxRange: 30,              // Дальше 12 гексов пуля физически не долетит
            damageDropPerHex: 7,       // Снижение урона на гекс
            critChance: 0.10,          // Шанс крита
            critMultiplier: 2.5,       // Модификатор урона
            projectileType: "laser",  // Тип эффекта: обычная пуля
            projectileSpeed: 100,       // Скорость полета (пикселей за кадр)
            projectileColor: "#ef0732" // Цвет снаряда
        }
    },

    // 6. Характеристики объектов на карте
    objectmap:{
        wall:{
            maxHp: 800,
            hp: 800,
            passability: 100
        },
        window:{
            maxHp: 800,
            hp: 800,
            passability: 30
        },
        trees:{
            maxHp: 400,
            hp: 400,
            passability: 15
        },
        stone:{
            maxHp: 250,
            hp: 250,
            passability: 10
        }
    },

    // 7. Характеристики карты
    settingsmaps:{
        sands:{
            rows: 50,
            cols: 50,
            treestype: ['tree_yollow', 'tree_blue'],
            trees: 0.04,
            stones: 0.01,
            stonetype: ['stone_large'],
            fenceCount: 7, // Сколько заборов спавнить на карте
            fencemin: 4, // Минимальная длина забора
            fencemax: 7, // Максимальная длина забора
            fenceStraightness: 0.75, // Прямота забора (шанс идти прямо)
            houseCount: 3, // Сколько разрушенных зданий генерировать
            houseRadius: 4, // Радиус комнат здания в гексах
            houseDestruction: 0.35 // Шанс выпадения/разрушения секции стены (35%)
        }
    },

    // 8. ЦВЕТОВАЯ ПАЛИТРА ИНТЕРФЕЙСА (Для быстрой смены стиля UI)
    colors:{
        gridOutline: 'rgba(0, 0, 0, 0.01)',
        moveRangeHighlight: 'rgba(0, 0, 0, 0.35)',
        attackRangeHighlight: 'rgba(255, 0, 0, 0.25)',
        selectedHexHighlight: 'rgba(121, 193, 45, 0.35)',
        hoverHexHighlight: 'rgba(121, 193, 45, 0)',
        pathHighlight: 'rgba(0, 150, 255, 0.4)',
        textPlayer: '#f5e5d3',
        textEnemy: '#ff3333'
    }
};
