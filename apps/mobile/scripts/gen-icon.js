const fs = require('fs');
const { deflateSync } = require('zlib');

function createPNG(width, height, drawFn) {
  function crc32(buf) {
    let c = 0xFFFFFFFF;
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let v = n;
      for (let k = 0; k < 8; k++) v = v & 1 ? 0xEDB88320 ^ (v >>> 1) : v >>> 1;
      table[n] = v;
    }
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  }

  const pixels = Buffer.alloc(width * height * 4);

  function setPixel(x, y, r, g, b, a) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const i = (y * width + x) * 4;
    const srcA = a / 255;
    const dstA = pixels[i+3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA > 0) {
      pixels[i]   = Math.round((r * srcA + pixels[i]   * dstA * (1-srcA)) / outA);
      pixels[i+1] = Math.round((g * srcA + pixels[i+1] * dstA * (1-srcA)) / outA);
      pixels[i+2] = Math.round((b * srcA + pixels[i+2] * dstA * (1-srcA)) / outA);
      pixels[i+3] = Math.round(outA * 255);
    }
  }

  function fillCircle(cx, cy, r, cr, cg, cb, ca) {
    for (let y = Math.floor(cy-r); y <= Math.ceil(cy+r); y++)
      for (let x = Math.floor(cx-r); x <= Math.ceil(cx+r); x++) {
        const d = Math.sqrt((x-cx)**2 + (y-cy)**2);
        if (d <= r) { const e = Math.min(1, r-d); setPixel(x, y, cr, cg, cb, Math.round(ca*e)); }
      }
  }

  function fillRect(x1, y1, w, h, r, g, b, a) {
    for (let y = Math.round(y1); y < Math.round(y1+h); y++)
      for (let x = Math.round(x1); x < Math.round(x1+w); x++)
        setPixel(x, y, r, g, b, a);
  }

  function fillRoundRect(x1, y1, w, h, rad, r, g, b, a) {
    for (let y = Math.round(y1); y < Math.round(y1+h); y++)
      for (let x = Math.round(x1); x < Math.round(x1+w); x++) {
        let ok = true;
        if (x < x1+rad && y < y1+rad) ok = Math.sqrt((x-x1-rad)**2+(y-y1-rad)**2) <= rad;
        else if (x > x1+w-rad && y < y1+rad) ok = Math.sqrt((x-x1-w+rad)**2+(y-y1-rad)**2) <= rad;
        else if (x < x1+rad && y > y1+h-rad) ok = Math.sqrt((x-x1-rad)**2+(y-y1-h+rad)**2) <= rad;
        else if (x > x1+w-rad && y > y1+h-rad) ok = Math.sqrt((x-x1-w+rad)**2+(y-y1-h+rad)**2) <= rad;
        if (ok) setPixel(x, y, r, g, b, a);
      }
  }

  drawFn({ setPixel, fillCircle, fillRect, fillRoundRect });

  const rowSize = 1 + width * 3;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0;
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const di = y * rowSize + 1 + x * 3;
      const a = pixels[si+3] / 255;
      raw[di]   = Math.round(pixels[si]*a + 245*(1-a));
      raw[di+1] = Math.round(pixels[si+1]*a + 241*(1-a));
      raw[di+2] = Math.round(pixels[si+2]*a + 232*(1-a));
    }
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, {level: 9})), chunk('IEND', Buffer.alloc(0))]);
}

function drawIcon(ctx, S) {
  const cx = S/2, cy = S/2;

  // Background gradient circle
  for (let r = S*0.48; r > 0; r -= 1) {
    const t = r / (S*0.48);
    ctx.fillCircle(cx, cy, r, Math.round(139*t+100*(1-t)), Math.round(46*t+30*(1-t)), Math.round(46*t+30*(1-t)), 255);
  }

  // Gold ring
  for (let r = S*0.43; r > S*0.40; r -= 0.5)
    ctx.fillCircle(cx, cy, r, 245, 217, 138, 55);

  // Ka'bah cube
  const k = S*0.21, kx = cx-k/2, ky = cy-k/2-S*0.02;
  ctx.fillRoundRect(kx+S*0.008, ky+S*0.008, k, k, S*0.025, 0, 0, 0, 50);
  ctx.fillRoundRect(kx, ky, k, k, S*0.025, 31, 27, 22, 255);
  // Kiswah gold band
  ctx.fillRect(kx+2, ky+k*0.33, k-4, k*0.09, 212, 164, 55, 255);
  ctx.fillRect(kx+2, ky+k*0.46, k-4, k*0.035, 212, 164, 55, 160);
  // Door hint
  ctx.fillRoundRect(cx-k*0.10, ky+k*0.55, k*0.20, k*0.38, S*0.01, 180, 140, 40, 120);

  // Crescent moon
  ctx.fillCircle(cx+S*0.14, cy-S*0.20, S*0.055, 245, 217, 138, 255);
  ctx.fillCircle(cx+S*0.16, cy-S*0.21, S*0.046, 130, 42, 42, 255);
  // Star
  ctx.fillCircle(cx+S*0.22, cy-S*0.17, S*0.014, 245, 217, 138, 255);

  // Mosque dome arch below
  for (let a = 0; a < Math.PI; a += 0.008) {
    const ax = cx + Math.cos(a) * S*0.17;
    const ay = cy + S*0.20 - Math.sin(a) * S*0.07;
    ctx.fillCircle(ax, ay, 1.5, 245, 217, 138, 100);
  }

  // 8 decorative dots
  for (let i = 0; i < 8; i++) {
    const a = (i/8) * Math.PI * 2 - Math.PI/8;
    ctx.fillCircle(cx+Math.cos(a)*S*0.35, cy+Math.sin(a)*S*0.35, S*0.010, 245, 217, 138, 80);
  }
}

// === Generate all icons ===
console.log('Generating icons...');

// App icon 1024x1024
const icon = createPNG(1024, 1024, (ctx) => drawIcon(ctx, 1024));
fs.writeFileSync('assets/icon.png', icon);
console.log('  icon.png:', icon.length, 'bytes');

// Adaptive icon foreground
const adaptive = createPNG(1024, 1024, (ctx) => drawIcon(ctx, 1024));
fs.writeFileSync('assets/adaptive-icon.png', adaptive);
console.log('  adaptive-icon.png:', adaptive.length, 'bytes');

// Splash screen
const splash = createPNG(1284, 2778, (ctx) => {
  // Cream background
  for (let y = 0; y < 2778; y++)
    for (let x = 0; x < 1284; x++)
      ctx.setPixel(x, y, 245, 241, 232, 255);
  // Icon centered, scaled
  const S = 500, cx = 642, cy = 1200;
  for (let r = S*0.48; r > 0; r -= 1) {
    const t = r / (S*0.48);
    ctx.fillCircle(cx, cy, r, Math.round(139*t+100*(1-t)), Math.round(46*t+30*(1-t)), Math.round(46*t+30*(1-t)), 255);
  }
  for (let r = S*0.43; r > S*0.40; r -= 0.5)
    ctx.fillCircle(cx, cy, r, 245, 217, 138, 55);
  const k = S*0.21, kx = cx-k/2, ky = cy-k/2-S*0.02;
  ctx.fillRoundRect(kx, ky, k, k, 12, 31, 27, 22, 255);
  ctx.fillRect(kx+2, ky+k*0.33, k-4, k*0.09, 212, 164, 55, 255);
  ctx.fillCircle(cx+S*0.14, cy-S*0.20, S*0.055, 245, 217, 138, 255);
  ctx.fillCircle(cx+S*0.16, cy-S*0.21, S*0.046, 139, 46, 46, 255);
  ctx.fillCircle(cx+S*0.22, cy-S*0.17, S*0.014, 245, 217, 138, 255);
});
fs.writeFileSync('assets/splash.png', splash);
console.log('  splash.png:', splash.length, 'bytes');

console.log('Done!');
