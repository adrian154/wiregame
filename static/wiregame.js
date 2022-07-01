// get canvas
const canvas = document.getElementById("canvas"),
      ctx = canvas.getContext("2d");

// make sure the canvas is always sized correctly
const onResize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
};

window.addEventListener("resize", onResize);
onResize();

// tile states
const WIRE = 0,
      ELECTRON_HEAD = 1,
      ELECTRON_TAIL = 2,
      SWITCH = 3,
      ACTIVE_SWITCH = 4,
      DELETE = 5;

// the board is restricted to 65k x 65k
const getKey = (x, y) => {
    x += 32768;
    y += 32768;
    return (x & 0xffff) << 16 | y & 0xffff;
};

const getCoords = key => [(key >>> 16) - 32768, (key & 0xffff) - 32768];

// game state
const game = {
    cells: new Map(),
    camera: {x: 0, y: 0, zoomLevel: 0, scale: 1},
    selectedType: WIRE
};

const screenToWorld = (sx, sy) => [(sx - game.camera.x) / game.camera.scale, (sy - game.camera.y) / game.camera.scale];

const BG_COLOR = "#242424";
const CELL_COLORS = {
    [WIRE]: "#9e9e9e",
    [ELECTRON_HEAD]: "#ffff00",
    [ELECTRON_TAIL]: "#cece4f",
    [SWITCH]: "#3ec742",
    [ACTIVE_SWITCH]: "#62ff57"
};

const CELL_SIZE = 32;

const draw = () => {

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

    ctx.globalAlpha = 1.0;
    requestAnimationFrame(draw);

};

const step = () => {

    const updates = [];
    for(const [key, type] of game.cells) {
        
        const [x, y] = getCoords(key);
        
        if(type == WIRE) {
            for(let dx = -1; dx <= 1; dx++) {
                for(let dy = -1; dy <= 1; dy++) {
                    if(dx == 0 && dy == 0) continue;
                    const neighbor = game.cells.get(getKey(x + dx, y + dy));
                    if(neighbor == ELECTRON_HEAD || neighbor == ACTIVE_SWITCH) {
                        updates.push([key, ELECTRON_HEAD]);
                        break;
                    }
                }
            }
        } else if(type == ELECTRON_HEAD) {
            updates.push([key, ELECTRON_TAIL]);
        } else if(type == ELECTRON_TAIL) {
            updates.push([key, WIRE]);
        } else if(type == SWITCH) {
            let numElectrons = 0;
            for(let dx = -1; dx <= 1; dx++) {
                for(let dy = -1; dy <= 1; dy++) {
                    if(dx == 0 && dy == 0) continue;
                    const neighbor = game.cells.get(getKey(x + dx, y + dy));
                    if(neighbor == ELECTRON_HEAD || neighbor == ACTIVE_SWITCH) {
                        numElectrons++;
                        if(numElectrons == 2) {
                            updates.push([key, ACTIVE_SWITCH]);
                            break;
                        }
                    }
                }
            }
        } else if(type == ACTIVE_SWITCH) {
            updates.push([key, SWITCH]);
        }

    }

    for(const update of updates) {
        game.cells.set(update[0], update[1]);
    }

    setTimeout(step, 100);

};

// add pan/zoom events
const mouse = {down: false, dragging: false};
const MIN_DELTA = 4;

// (x, y) is in screen coords
const handleClick = (x, y) => {
    const [worldX, worldY] = screenToWorld(x, y);
    const key = getKey(Math.floor(worldX / CELL_SIZE), Math.floor(worldY / CELL_SIZE));
    if(game.selectedType == DELETE) {
        game.cells.delete(key);
    } else {
        game.cells.set(key, game.selectedType);
    }
};

canvas.addEventListener("mousedown", event => {
    mouse.down = true;
    mouse.dragStartX = event.offsetX;
    mouse.dragStartY = event.offsetY;
});

window.addEventListener("mousemove", event => {
    if(mouse.down) {
        game.camera.x += event.movementX;
        game.camera.y += event.movementY;
    }
});

window.addEventListener("mouseup", event => {
    mouse.down = false;
    if(Math.abs(event.offsetX - mouse.dragStartX) < MIN_DELTA && Math.abs(event.offsetY - mouse.dragStartY) < MIN_DELTA) {
        handleClick(event.offsetX, event.offsetY);
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
    updateScale(event.offsetX, event.offsetY, Math.pow(1.3, game.camera.zoomLevel));
});

step();
draw();