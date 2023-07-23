import SVGRenderingContext2D from "canvas-to-svg";

var time = Date.now(),
  velocity = 0.1,
  velocityTarget = 0.1,
  width = 800,
  height = 600,
  lastX,
  lastY,
  bg = "#000",
  color = "#fff";

const context = new SVGRenderingContext2D(width, height);

var MAX_OFFSET = 400;
var SPACING = 4;
var POINTS = MAX_OFFSET / SPACING;
var PEAK = MAX_OFFSET * 0.25;
var POINTS_PER_LAP = 6;
var SHADOW_STRENGTH = 12;

step();

function step() {
  time += velocity;
  velocity += (velocityTarget - velocity) * 0.3;

  clear();
  render();
}

function clear() {
  context.fillStyle = bg;
  context.fillRect(0, 0, width, height);
}

function render() {
  var x,
    y,
    cx = width / 2,
    cy = height / 2;

  context.globalCompositeOperation = "lighter";
  context.strokeStyle = color;
  context.shadowColor = color;
  context.lineWidth = 2;
  context.beginPath();

  for (var i = POINTS; i > 0; i--) {
    var value = i * SPACING + (time % SPACING);

    var ax = Math.sin(value / POINTS_PER_LAP) * Math.PI,
      ay = Math.cos(value / POINTS_PER_LAP) * Math.PI;

    (x = ax * value), (y = ay * value * 0.35);

    var o = 1 - Math.min(value, PEAK) / PEAK;

    y -= Math.pow(o, 2) * 200;
    y += (200 * value) / MAX_OFFSET;
    y += (x / cx) * width * 0.1;

    context.globalAlpha = 1 - value / MAX_OFFSET;
    context.shadowBlur = SHADOW_STRENGTH * o;

    context.lineTo(cx + x, cy + y);
    context.stroke();

    context.beginPath();
    context.moveTo(cx + x, cy + y);
  }

  context.lineTo(cx, cy - 200);
  context.lineTo(cx, 0);
  context.stroke();
}

function testfunc(a) {
  return a*2;
}

const output = context.getSvg()
