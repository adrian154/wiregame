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
      ACTIVE_SWITCH = 4;

// the board is restricted to 65k x 65k
const getKey = (x, y) => {
    if(x < 0 || y < 0 || x > 0xffff || y > 0xffff) {
        throw new Error("Coordinates out of bounds");
    }
    return (x & 0xffff) << 16 | y & 0xffff;
};

const getCoords = key => [key >>> 16, key & 0xffff];

// game state
const game = {
    cells: new Map(),
    camera: {x: 0, y: 0, zoomLevel: 0, scale: 1}
};

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

    requestAnimationFrame(draw);

};

const step = () => {

};

// add pan/zoom events
const mouse = {down: false, dragging: false};

// (x, y) is in screen coords
const handleClick = (x, y) => {

    // determine the world coordinates
    const worldX = (x - game.camera.x) / game.camera.scale,
          worldY = (y - game.camera.y) / game.camera.scale;

    game.cells.set(getKey(Math.floor(worldX / CELL_SIZE), Math.floor(worldY / CELL_SIZE)), WIRE);

};

canvas.addEventListener("mousedown", event => {
    mouse.down = true;
});

window.addEventListener("mousemove", event => {
    if(mouse.down) {
        mouse.dragging = true;
        game.camera.x += event.movementX;
        game.camera.y += event.movementY;
    }
});

window.addEventListener("mouseup", event => {
    mouse.down = false;
    if(mouse.dragging) {
        mouse.dragging = false;
    } else {
        handleClick(event.offsetX, event.offsetY);
    }
});

const updateScale = (x, y, newScale) => {
    
    const deltaScale = game.camera.scale - newScale;
    const worldX = (x - game.camera.x) / game.camera.scale,
          worldY = (y - game.camera.y) / game.camera.scale;

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

draw();