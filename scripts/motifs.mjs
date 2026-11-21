// Generates the cross-stitch (шевица) motifs used as CSS masks: a rhombus band
// and the eight-pointed star (осмолъчка). Each stitch is a square cell.
const cell = 2
function svg(w, h, cells) {
  const rects = cells.map(([x, y]) => `M${x * cell} ${y * cell}h${cell}v${cell}h-${cell}z`).join('')
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${w * cell}' height='${h * cell}' viewBox='0 0 ${w * cell} ${h * cell}'><path d='${rects}'/></svg>`
}
// Rhombus band tile: 12 wide x 9 tall. Outline rhombus with a centre stitch, plus side dots.
const band = []
for (let y = 0; y < 9; y++) for (let x = 0; x < 12; x++) {
  const dx = Math.abs(x - 4), dy = Math.abs(y - 4)
  if (dx + dy === 4 || (dx + dy === 0) || (dx + dy === 2 && (dx === 0 || dy === 0) && false)) band.push([x, y])
  if (x >= 9 && x <= 11 && y === 4 && x !== 10) band.push([x, y])
  if (x === 10 && (y === 3 || y === 5)) band.push([x, y])
}
// Eight-pointed star 11x11: union of a square and a diamond, hollow centre.
const star = []
for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {
  const inA = Math.abs(x) <= 3 && Math.abs(y) <= 3
  const inB = Math.abs(x) + Math.abs(y) <= 5
  const hole = Math.abs(x) + Math.abs(y) <= 1
  if ((inA || inB) && !hole) star.push([x + 5, y + 5])
}
const enc = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`
console.log('--motif-band: ' + enc(svg(12, 9, band)) + ';')
console.log('--motif-star: ' + enc(svg(11, 11, star)) + ';')
