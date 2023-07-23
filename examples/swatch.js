const swatch;
const depth;

let mainSwatch = swatch[0];
let canvas = output[0];  // TODO: switch to html canvas
console.log(depth)
const depthValue = parseInt(depth[0].characters) 
console.log(depthValue) 
const colors = mainSwatch.children.map(c => c.fills[0])
function slice(c, x, y, size) {
  if (size > 10 && Math.random() <= size / c.width * depthValue) {
    const s2 = size / 2
    slice(c, x, y, s2)
    slice(c, x + 52, y, s2)
    slice(c, x, y + s2, s2)
    slice(c, x + 52, y + 52, s2)
  } else {
    const rect = figma.createRectangle()
    rect.x = x
    rect.y = y
    rect.resize(size, size)
    rect.strokes = [{type: "SOLID", color: {r: 1, g: 1, b: 1}}]
    rect.fills = [colors[Math.floor(Math.random() * colors.length)]]
    c.appendChild(rect)
  }
}
slice(canvas, 0, 0, canvas.width)

const output = canvas.getHtml()
