export const MODEL_INPUT_SIZE = 224;

const BACKGROUNDS = ['#ffffff', '#f2f2f2', '#d9d9d9', '#fdf6e3', '#e8f0fe', '#202124', '#3a3a3a', '#c9e4ca', '#ffe0b2'];

export type Random = () => number;

export function seededRandom(seed: number): Random {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function range(rand: Random, min: number, max: number): number {
  return min + rand() * (max - min);
}

export function createCanvas(size = MODEL_INPUT_SIZE): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function sourceSize(source: CanvasImageSource): { width: number; height: number } {
  if (source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight };
  }
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth || source.width, height: source.naturalHeight || source.height };
  }
  const s = source as HTMLCanvasElement;
  return { width: s.width, height: s.height };
}

export function toSquareCanvas(source: CanvasImageSource, background = '#ffffff'): HTMLCanvasElement {
  const canvas = createCanvas();
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  const { width, height } = sourceSize(source);
  const side = Math.min(width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, (width - side) / 2, (height - side) / 2, side, side, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  return canvas;
}

export function centerCrop(source: HTMLCanvasElement, fraction: number): HTMLCanvasElement {
  const canvas = createCanvas();
  const side = source.width * fraction;
  const offset = (source.width - side) / 2;
  canvas.getContext('2d')!.drawImage(source, offset, offset, side, side, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  return canvas;
}

export function renderOriginal(img: HTMLImageElement): HTMLCanvasElement {
  return renderVariant(img, { background: '#ffffff', rotation: 0, scale: 0.9, dx: 0, dy: 0, brightness: 1, contrast: 1, noise: 0 });
}

export function renderAugmented(img: HTMLImageElement, rand: Random): HTMLCanvasElement {
  return renderVariant(img, {
    background: BACKGROUNDS[Math.floor(rand() * BACKGROUNDS.length)],
    rotation: range(rand, -12, 12) * (Math.PI / 180),
    scale: range(rand, 0.6, 1.15), // >1 equivale a un recorte (zoom)
    dx: range(rand, -0.08, 0.08),
    dy: range(rand, -0.08, 0.08),
    brightness: range(rand, 0.7, 1.3),
    contrast: range(rand, 0.65, 1.25),
    noise: range(rand, 0, 18),
  });
}

interface VariantParams {
  background: string;
  rotation: number;
  scale: number;
  dx: number;
  dy: number;
  brightness: number;
  contrast: number;
  noise: number;
}

function renderVariant(img: HTMLImageElement, p: VariantParams): HTMLCanvasElement {
  const size = MODEL_INPUT_SIZE;
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = p.background;
  ctx.fillRect(0, 0, size, size);

  const { width, height } = sourceSize(img);
  const fit = (size * p.scale) / Math.max(width, height);
  ctx.save();
  ctx.translate(size / 2 + p.dx * size, size / 2 + p.dy * size);
  ctx.rotate(p.rotation);
  ctx.imageSmoothingEnabled = fit < 2.5;
  ctx.drawImage(img, (-width * fit) / 2, (-height * fit) / 2, width * fit, height * fit);
  ctx.restore();

  if (p.brightness !== 1 || p.contrast !== 1 || p.noise > 0) {
    // a mano porque ctx.filter no funciona en todos los WKWebView
    const data = ctx.getImageData(0, 0, size, size);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      const n = p.noise ? (Math.random() - 0.5) * p.noise : 0;
      for (let c = 0; c < 3; c++) {
        const v = ((px[i + c] * p.brightness - 128) * p.contrast + 128) + n;
        px[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
    ctx.putImageData(data, 0, 0);
  }
  return canvas;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar la imagen ${src}`));
    img.src = src;
  });
}
