const sharp = require("sharp");

// margin
const MARGIN = 10;

const PALETTE = {
    0: [0x9e, 0x9e, 0x9e],
    1: [0xff, 0xff, 0x00],
    2: [0xce, 0xce, 0x4f],
    3: [0x3e, 0xc7, 0x42],
    4: [0x62, 0xff, 0x57]
};

// generate a preview from a circuit
module.exports = (circuit, id) => {
    
    // parse data
    const cells = circuit.split(';').map(line => line.split(',').map(Number));
    
    // determine viewport boundaries
    const minX = cells.reduce((a, c) => Math.min(a, c[0]), Infinity),
          minY = cells.reduce((a, c) => Math.min(a, c[1]), Infinity),
          maxX = cells.reduce((a, c) => Math.max(a, c[0]), -Infinity),
          maxY = cells.reduce((a, c) => Math.max(a, c[1]), -Infinity);

    // generate image
    const width = maxX - minX + MARGIN * 2,
          height = maxY - minY + MARGIN * 2;
    const imgData = Buffer.alloc(width * height * 4);

    // draw cells
    for(const cell of cells) {
        
        // calculate viewport x/y
        const x = cell[0] - minX + MARGIN,
              y = cell[1] - minY + MARGIN;
        const idx = (y * width + x) * 4;

        const color = PALETTE[cell[2]] || [0xff, 0x00, 0xff]; // use magenta as color for unknown tiles
        imgData[idx] = color[0];
        imgData[idx + 1] = color[1];
        imgData[idx + 2] = color[2];
        imgData[idx + 3] = 255;

    }

    // export
    return sharp(imgData, {raw: {width, height, channels: 4}}).png().toFile(`previews/${id}.png`);

};