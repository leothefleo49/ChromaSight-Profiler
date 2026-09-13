// Dependency-free PNG icon generator for Colorfle + ChromaSight.
// Usage: node scripts/generate-icons.mjs colorfle|chromasight [publicDir]
// Encodes PNGs directly with node's built-in zlib — no image libraries needed.
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const app = process.argv[2] || 'colorfle';
const outDir = path.resolve(process.argv[3] || 'public');
const SS = 3; // supersampling factor for smooth edges

// ---------- PNG encoding ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const encodePng = (width, height, rgba) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
};

// ---------- color helpers ----------
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// ---------- Colorfle art: the split pie wheel ----------
// Right half = solid purple target; left half = red/yellow/green weighted slices.
const drawColorfleSample = (u, v, size, fullBleed) => {
  // rounded-square background
  const radius = fullBleed ? 0 : size * 0.19;
  const margin = fullBleed ? 0 : 1;
  const inRounded = (x, y) => {
    if (radius <= 0) return true;
    const rx = Math.min(x, size - x), ry = Math.min(y, size - y);
    if (rx >= radius || ry >= radius) return true;
    const dx = radius - rx, dy = radius - ry;
    return dx * dx + dy * dy <= radius * radius;
  };
  if (!inRounded(u + margin, v + margin) || u < margin || v < margin || u > size - margin || v > size - margin) {
    return fullBleed ? [...hex('#12131C'), 255] : [18, 19, 28, 0];
  }

  const cx = size / 2, cy = size / 2;
  const R = size * 0.36; // pie radius
  const dx = u - cx, dy = v - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > R) return [...hex('#12131C'), 255];
  if (dist > R - size * 0.035) return [...hex('#3B4256'), 255]; // border ring

  const ang = (Math.atan2(dy, dx) * 180) / Math.PI; // -180..180, 0=right, -90=top
  if (ang > -90 && ang < 90) return [...hex('#9333EA'), 255]; // right half: target purple

  // left half: arc position from the top (0) through the left (90) to the bottom (180)
  const phi = ang <= -90 ? -ang - 90 : 270 - ang;
  if (phi < 90) return [...hex('#EF4444'), 255]; // 50% red
  if (phi < 153) return [...hex('#FACC15'), 255]; // 35% yellow
  return [...hex('#16A34A'), 255]; // 15% green
};

// ---------- ChromaSight art: additive RGB venn (color-vision motif) ----------
const drawChromaSample = (u, v, size, fullBleed) => {
  const radius = fullBleed ? 0 : size * 0.19;
  const margin = fullBleed ? 0 : 1;
  const inRounded = (x, y) => {
    if (radius <= 0) return true;
    const rx = Math.min(x, size - x), ry = Math.min(y, size - y);
    if (rx >= radius || ry >= radius) return true;
    const dx = radius - rx, dy = radius - ry;
    return dx * dx + dy * dy <= radius * radius;
  };
  if (!inRounded(u + margin, v + margin) || u < margin || v < margin || u > size - margin || v > size - margin) {
    return fullBleed ? [...hex('#090C15'), 255] : [9, 12, 21, 0];
  }

  const cx = size / 2, cy = size / 2;
  const R = size * 0.27;
  const off = size * 0.13;
  const centers = [
    [cx, cy - off, hex('#EF4444')], // top: red
    [cx - off * 0.87, cy + off * 0.5, hex('#10B981')], // bottom-left: green
    [cx + off * 0.87, cy + off * 0.5, hex('#3B82F6')] // bottom-right: blue
  ];
  let r = 0, g = 0, b = 0, n = 0;
  centers.forEach(([x, y, c]) => {
    const dx = u - x, dy = v - y;
    if (dx * dx + dy * dy <= R * R) {
      r += c[0]; g += c[1]; b += c[2]; n++;
    }
  });
  if (n === 0) return [...hex('#090C15'), 255];
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n), 255];
};

const render = (size, fullBleed) => {
  const rgba = Buffer.alloc(size * size * 4);
  const sampler = app === 'chromasight' ? drawChromaSample : drawColorfleSample;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const s = sampler(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS, size, fullBleed);
          r += s[0] * s[3]; g += s[1] * s[3]; b += s[2] * s[3]; a += s[3];
        }
      }
      const i = (y * size + x) * 4;
      if (a > 0) {
        rgba[i] = Math.round(r / a);
        rgba[i + 1] = Math.round(g / a);
        rgba[i + 2] = Math.round(b / a);
      }
      rgba[i + 3] = Math.round(a / (SS * SS));
    }
  }
  return encodePng(size, size, rgba);
};

fs.mkdirSync(path.join(outDir, 'icons'), { recursive: true });
const files = [
  ['icons/icon-192.png', render(192, false)],
  ['icons/icon-512.png', render(512, false)],
  ['icons/maskable-512.png', render(512, true)],
  ['icons/apple-touch-icon.png', render(180, true)]
];
files.forEach(([name, buf]) => {
  fs.writeFileSync(path.join(outDir, name), buf);
  console.log(`wrote ${path.join(outDir, name)} (${buf.length} bytes)`);
});
