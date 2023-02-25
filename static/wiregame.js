// get canvas
const canvas = document.getElementById("canvas"),
      ctx = canvas.getContext("2d");

// make sure the canvas is always sized correctly
const onResize = () => {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
};

window.addEventListener("resize", onResize);
onResize();

// tile states
const WIRE = 0,
      ELECTRON_HEAD = 1,
      ELECTRON_TAIL = 2,
      SWITCH = 3,
      ACTIVE_SWITCH = 4,
      CROSSOVER = 5,
      CROSSOVER_CHARGED_X = 6,
      CROSSOVER_CHARGED_Y = 7,
      CROSSOVER_CHARGED_XY = 8,
      DELETE = 9;

// the board is restricted to 65k x 65k
const getKey = (x, y) => {
    if(x < -32768 || x > 32767 || y < -32768 || y > 32767) throw new Error("Coordinates out of bounds");
    x += 32768;
    y += 32768;
    return (x & 0xffff) << 16 | y & 0xffff;
};

const getCoords = key => [(key >>> 16) - 32768, (key & 0xffff) - 32768];

const initMap = () => {
    const data = document.getElementById("map-data").dataset.circuit,
          map = new Map();
    if(data) {
        for(const cell of data.split(';')) {
            const [x, y, type] = cell.split(',');
            map.set(getKey(Number(x), Number(y)), Number(type));
        }
        return map;    
    }
    return new Map();
};

const serializeMap = () => {
    const lines = [];
    for(const [key, type] of game.cells) {
        const [x, y] = getCoords(key);
        lines.push(`${x},${y},${type}`);
    }
    return lines.join(';');
};

// game state
const game = {
    cells: initMap(),
    camera: {x: 0, y: 0, zoomLevel: 0, scale: 1},
    selectedType: WIRE,
    delay: 100,
    running: true
};

// keep track of performance states
const perf = {
    stepTime: 0,
    stepTimeCount: 0,
    drawTime: 0,
    drawTimeCount: 0
};

const screenToWorld = (sx, sy) => [(sx - game.camera.x) / game.camera.scale, (sy - game.camera.y) / game.camera.scale];

const BG_COLOR = "#242424";
const CELL_COLORS = {
    [WIRE]: "#9e9e9e",
    [ELECTRON_HEAD]: "#ffff00",
    [ELECTRON_TAIL]: "#cece4f",
    [SWITCH]: "#3ec742",
    [ACTIVE_SWITCH]: "#62ff57",
    [CROSSOVER]: "#3e85c7",
    [CROSSOVER_CHARGED_X]: "#ff0000",
    [CROSSOVER_CHARGED_Y]: "#0000ff",
    [CROSSOVER_CHARGED_XY]: "#ff00ff",
    [DELETE]: "#000000"
};

const CELL_SIZE = 32;

const draw = () => {

    const start = performance.now();

    // draw background
    ctx.resetTransform();
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.transform(game.camera.scale, 0, 0, game.camera.scale, game.camera.x, game.camera.y);

    // draw cells
    for(const [key, type] of game.cells) {
        const [x, y] = getCoords(key);
        ctx.fillStyle = CELL_COLORS[type];
        ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }

    // draw gridlines
    if(game.camera.scale > 0.1) {
        ctx.strokeStyle = "#ffffff";
        ctx.globalAlpha = 0.1;

        // get screen coords of top left / bottom right points
        const [topX, topY] = screenToWorld(0, 0);
        const [bottomX, bottomY] = screenToWorld(window.innerWidth, window.innerHeight);
        
        for(let x = Math.ceil(topX / CELL_SIZE); x <= Math.floor(bottomX / CELL_SIZE); x++) {
            ctx.beginPath();
            ctx.moveTo(x * CELL_SIZE, topY);
            ctx.lineTo(x * CELL_SIZE, bottomY);
            ctx.closePath();
            ctx.stroke();
        }

        for(let y = Math.ceil(topY / CELL_SIZE); y <= Math.floor(bottomY / CELL_SIZE); y++) {
            ctx.beginPath();
            ctx.moveTo(topX, y * CELL_SIZE);
            ctx.lineTo(bottomX, y * CELL_SIZE);
            ctx.closePath();
            ctx.stroke();
        }
    }

    ctx.globalAlpha = 1.0;
    perf.drawTime += performance.now() - start;
    perf.drawTimeCount++;
    requestAnimationFrame(draw);

};

const isCharged = (x, y, dx, dy) => {
    const neighbor = game.cells.get(getKey(x + dx, y + dy));
    return neighbor == ELECTRON_HEAD || neighbor == ACTIVE_SWITCH || neighbor == CROSSOVER_CHARGED_XY || neighbor == CROSSOVER_CHARGED_X && dy == 0 || neighbor == CROSSOVER_CHARGED_Y && dx == 0;
};

const step = () => {

    const start = performance.now();

    const updates = [];
    for(const [key, type] of game.cells) {
        
        const [x, y] = getCoords(key);
        
        if(type == WIRE) {
            for(let dx = -1; dx <= 1; dx++) {
                for(let dy = -1; dy <= 1; dy++) {
                    if(dx == 0 && dy == 0) continue;
                    if(isCharged(x, y, dx, dy)) {
                        updates.push([key, ELECTRON_HEAD]);
                        break; 
                    }
                }
            }
        } else if(type == ELECTRON_HEAD) {
            updates.push([key, ELECTRON_TAIL]);
        } else if(type == CROSSOVER_CHARGED_X || type == CROSSOVER_CHARGED_Y || type == CROSSOVER_CHARGED_XY) {
            updates.push([key, CROSSOVER]);
        } else if(type == ELECTRON_TAIL) {
            updates.push([key, WIRE]);
        } else if(type == SWITCH) {
            let numElectrons = 0;
            for(let dx = -1; dx <= 1; dx++) {
                for(let dy = -1; dy <= 1; dy++) {
                    if(dx == 0 && dy == 0) continue;
                    if(isCharged(x, y, dx, dy)) {
                        numElectrons++;
                    }
                }
            }
            if(numElectrons == 2) {
                updates.push([key, ACTIVE_SWITCH]);
            }
        } else if(type == ACTIVE_SWITCH) {
            updates.push([key, SWITCH]);
        } else if(type == CROSSOVER) {
            const horizontal = isCharged(x, y, -1, 0) || isCharged(x, y, 1, 0),
                  vertical = isCharged(x, y, 0, -1) || isCharged(x, y, 0, 1);
            if(horizontal && vertical)
                updates.push([key, CROSSOVER_CHARGED_XY]);
            else if(horizontal)
                updates.push([key, CROSSOVER_CHARGED_X]);
            else if(vertical)
                updates.push([key, CROSSOVER_CHARGED_Y]);
        }

    }

    for(const update of updates) {
        game.cells.set(update[0], update[1]);
    }

    perf.stepTime += performance.now() - start;
    perf.stepTimeCount++;

};

const run = () => {
    if(game.running) {
        step();
    }
    setTimeout(run, game.delay);
};

// add pan/zoom events
let ctrlDown = false
    middleMouseDown = false,
    mouseDown = false;

let lastTileX, lastTileY;
const handleMouseEvent = event => {
    const [x, y]  = screenToWorld(event.clientX, event.clientY);
    const tileX = Math.floor(x / CELL_SIZE),
          tileY = Math.floor(y / CELL_SIZE);
    if(tileX != lastTileX && tileY != lastTileY) {
        const key = getKey(tileX, tileY);
        if(game.selectedType == DELETE) {
            game.cells.delete(key);
        } else {
            game.cells.set(key, game.selectedType);
        }
    }
};

canvas.addEventListener("mousedown", event => {

    mouseDown = true;
    if(event.button == 1) {
        middleMouseDown = true;
        return;
    }

    if(!ctrlDown) {
        handleMouseEvent(event);   
    }

});

window.addEventListener("mousemove", event => {
    if(mouseDown) {
        if(ctrlDown || middleMouseDown) {
            game.camera.x += event.movementX;
            game.camera.y += event.movementY;
        } else {
            handleMouseEvent(event);
        }
        event.preventDefault();
    }
});

window.addEventListener("mouseup", event => {
    mouseDown = false;
    if(event.button == 1) {
        middleMouseDown = false;
    }
});

const updateScale = (x, y, newScale) => {
    
    const deltaScale = game.camera.scale - newScale;
    const [worldX, worldY] = screenToWorld(x, y);
    game.camera.scale = newScale;

    // when the user zooms in, we want to zoom towards wherever the cursor currently is
    // we can define this in mathematical terms:
    // 
    //    - let M be the transform matrix before zooming in, and M' be the transform matrix after zooming in
    //    - let P be the point of the cursor, in world coordinates
    //    - M * P = M' * P
    //
    // we have three degrees of freedom when constructing the transform: camera X, camera Y, and scale
    // we're adjusting scale, so we need to also adjust camera X and camera Y to make this happen
    // from here, the derivation is simple; we can do things component-wise
    // 
    //    - let C be the camera position and S be the scale  
    //    - Px * S + Cx = Px * S' + Cx'
    //        -> Cx' = Px * S + Cx - Px * S'
    //        -> Cx' = Px(S - S') + Cx
    //    - Py * S + Cy = Py * S' + Cy'
    //        -> Cy' = Py * S + Cy - Py * S'
    //        -> Cy' = Py(S - S') + Cy

    game.camera.x += worldX * deltaScale;
    game.camera.y += worldY * deltaScale;

};

window.addEventListener("wheel", event => {
    game.camera.zoomLevel -= event.deltaY / 100;
    updateScale(event.clientX, event.clientY, Math.pow(1.3, game.camera.zoomLevel));
    event.preventDefault();
}, {passive: false});

// add ui
const CELL_NAMES = {
    [WIRE]: "Wire",
    [ELECTRON_HEAD]: "Electron",
    [ELECTRON_TAIL]: "Electron Tail",
    [SWITCH]: "Switch",
    [ACTIVE_SWITCH]: "Active Switch",
    [CROSSOVER]: "Cross-over",
    [CROSSOVER_CHARGED_X]: "Charged cross-over (horizontal)",
    [CROSSOVER_CHARGED_Y]: "Charged cross-over (vertical)",
    [CROSSOVER_CHARGED_XY]: "Charged cross-over (both)",
    [DELETE]: "Delete"
};

const DEFAULT_TYPES = [WIRE, ELECTRON_HEAD, SWITCH, CROSSOVER, DELETE];

const CELL_KEYBINDS = {
    [WIRE]: {key: "W", code: "KeyW"},
    [SWITCH]: {key: "S", code: "KeyS"},
    [DELETE]: {key: "D", code: "KeyD"},
    [ELECTRON_HEAD]: {key: "E", code: "KeyE"},
    [CROSSOVER]: {key: "F", code: "KeyF"}
};

let selectedTypeDiv = null;
const typeDivs = {};
const selectType = type => {
    game.selectedType = type;
    selectedTypeDiv?.classList.remove("active");
    typeDivs[type].classList.add("active");
    selectedTypeDiv = typeDivs[type];
};

const paletteElem = document.getElementById("palette"),
      showAllElem = document.getElementById("show-all");

for(const type in CELL_COLORS) {

    const div = document.createElement("div");
    paletteElem.insertBefore(div, showAllElem);
    div.addEventListener("click", () => selectType(type));
    typeDivs[type] = div;

    if(!DEFAULT_TYPES.includes(Number(type))) {
        div.classList.add("hidden");
    }

    const button = document.createElement("button");
    button.classList.add("cell-type-button");
    button.style.backgroundColor = CELL_COLORS[type];

    if(CELL_KEYBINDS[type])
        div.append(button, " ", `${CELL_NAMES[type]} (${CELL_KEYBINDS[type].key})`);
    else
        div.append(button, " ", `${CELL_NAMES[type]}`);

}   

showAllElem.addEventListener("click", () => {
    if(paletteElem.classList.toggle("show-hidden"))
        showAllElem.textContent = "Show less...";
    else
        showAllElem.textContent = "Show all...";
});

window.addEventListener("keydown", event => {
    
    for(const type in CELL_KEYBINDS) {
        if(CELL_KEYBINDS[type].code == event.code) {
            selectType(type);
            return;
        }
    }

    if(event.key === " ") {
        game.running = !game.running;
        updatePlayButton();
    } else if(event.code === "KeyT") {
        step();
    } else if(event.key === "Control") {
        ctrlDown = true;
    }

});

window.addEventListener("keyup", event => {
    if(event.key === "Control") {
        ctrlDown = false;
    }
})

const playButton = document.getElementById("toggle-running");
const updatePlayButton = () => {
    if(game.running) {
        playButton.textContent = "pause";
    } else {
        playButton.textContent = "play_arrow";
    } 
};

playButton.addEventListener("click", event => {
    game.running = !game.running;
    updatePlayButton();
});

document.getElementById("step").addEventListener("click", step);

document.getElementById("rate").addEventListener("input", event => {
    game.delay = 1000 / event.target.value;
    document.getElementById("rate-display").textContent = `${event.target.value} / second`;
});

const about = document.getElementById("about");
const toggleAbout = () => {
    about.classList.toggle("shown");
    localStorage.setItem("aboutAcknowledged", 1);
};
document.getElementById("close-about").addEventListener("click", toggleAbout);
document.getElementById("show-about").addEventListener("click", toggleAbout);

if(!localStorage.getItem("aboutAcknowledged")) {
    about.classList.add("shown");
}

const share = document.getElementById("share");
const toggleShare = () => share.classList.toggle("shown");
document.getElementById("close-share").addEventListener("click", toggleShare);
document.getElementById("show-share").addEventListener("click", toggleShare);
document.getElementById("share-button").addEventListener("click", event => {
    event.preventDefault();
    fetch("/circuit", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            title: document.getElementById("title").value,
            data: serializeMap()
        })
    }).then(resp => resp.json()).then(id => window.location.href = `/?id=${id}`);
});

window.addEventListener("blur", () => {
    ctrlDown = false;
    middleMouseDown = false;
    mouseDown = false;
});

// START GAME
run();
draw();

// periodically update performance states
setInterval(() => {
    document.getElementById("perf-stats").textContent = `draw: ${Number(perf.drawTime / perf.drawTimeCount).toFixed(1)}ms, step: ${Number(perf.stepTime / perf.stepTimeCount).toFixed(1)}ms`;
    perf.drawTime = 0;
    perf.drawTimeCount = 0;
    perf.stepTime = 0;
    perf.stepTimeCount = 0;
}, 1000);