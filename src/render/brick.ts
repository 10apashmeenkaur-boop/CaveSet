import { CanvasTexture, SRGBColorSpace } from 'three';

let cached: CanvasTexture | null = null;

/** Hand-drawn brick pattern for wall sides, generated once. */
export function brickTexture(): CanvasTexture {
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 154; // 1 × 1.2 tile face
  const g = c.getContext('2d')!;
  g.fillStyle = '#e7cdb8'; // mortar
  g.fillRect(0, 0, c.width, c.height);

  const rows = 7;
  const rowH = c.height / rows;
  const brickW = c.width / 2;
  const shades = ['#c9705a', '#c46a55', '#cf7a62', '#bf654f'];
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 ? brickW / 2 : 0;
    for (let i = -1; i < 3; i++) {
      g.fillStyle = shades[(r * 3 + i + 4) % shades.length];
      g.fillRect(i * brickW + offset + 2, r * rowH + 2, brickW - 4, rowH - 4);
    }
  }
  cached = new CanvasTexture(c);
  cached.colorSpace = SRGBColorSpace;
  return cached;
}
