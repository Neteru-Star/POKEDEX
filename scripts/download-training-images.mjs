#!/usr/bin/env node
// Uso: node scripts/download-training-images.mjs [--skip-model]
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// IDs de los Pokémon a reconocer. Para agregar uno, añadirlo aquí y volver a correr el script.
const TARGET_IDS = [1, 4, 7];

const UNKNOWN_COUNT = 15;
const UNKNOWN_LABEL = 'desconocido';
const GEN1_MAX = 151;

const RANDOM_SEED = 151;

const API = 'https://pokeapi.co/api/v2';
const MOBILENET_URL = 'https://tfhub.dev/google/imagenet/mobilenet_v2_100_224/classification/2';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TRAINING_DIR = join(ROOT, 'src', 'assets', 'training');
const MODEL_DIR = join(ROOT, 'src', 'assets', 'models', 'mobilenet');

const skipModel = process.argv.includes('--skip-model');

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.json();
}

async function fetchWithRetry(url, retries = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (attempt >= retries) throw new Error(`${url}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

function collectSprites(node, path = []) {
  const out = [];
  if (!node || typeof node !== 'object') return out;
  for (const [key, value] of Object.entries(node)) {
    const nextPath = [...path, key];
    if (typeof value === 'string') {
      if (!/\.(png|svg)$/i.test(value)) continue;
      if (nextPath.includes('animated') || nextPath.includes('showdown')) continue;
      if (/_(gray|transparent)$/.test(key)) continue;
      const ext = value.toLowerCase().endsWith('.svg') ? 'svg' : 'png';
      out.push({ url: value, file: `${nextPath.join('_').replace(/[^a-z0-9_-]/gi, '-')}.${ext}` });
    } else if (value && typeof value === 'object') {
      out.push(...collectSprites(value, nextPath));
    }
  }
  const seen = new Set();
  return out.filter(({ url }) => (seen.has(url) ? false : (seen.add(url), true)));
}

function idFromUrl(url) {
  return Number(/\/(\d+)\/?$/.exec(url)[1]);
}

function seededRandom(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function evolutionRelatives() {
  const relatives = new Set();
  for (const id of TARGET_IDS) {
    const species = await fetchJson(`${API}/pokemon-species/${id}`);
    const chain = await fetchJson(species.evolution_chain.url);
    const walk = (node) => {
      relatives.add(idFromUrl(node.species.url));
      node.evolves_to.forEach(walk);
    };
    walk(chain.chain);
  }
  TARGET_IDS.forEach((id) => relatives.delete(id));
  return [...relatives].sort((a, b) => a - b);
}

async function pickUnknownIds() {
  const relatives = await evolutionRelatives();
  const rand = seededRandom(RANDOM_SEED);
  const pool = Array.from({ length: GEN1_MAX }, (_, i) => i + 1).filter(
    (id) => !TARGET_IDS.includes(id) && !relatives.includes(id),
  );
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const random = pool.slice(0, UNKNOWN_COUNT).sort((a, b) => a - b);
  return { relatives, random };
}

async function downloadAll(items, dir) {
  await mkdir(dir, { recursive: true });
  const files = [];
  const queue = [...items];
  const workers = Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const { url, file } = queue.shift();
      try {
        await writeFile(join(dir, file), await fetchWithRetry(url));
        files.push(file);
      } catch (err) {
        console.warn(`  ! No se pudo descargar ${err.message}`);
      }
    }
  });
  await Promise.all(workers);
  return files.sort();
}

async function downloadTargets() {
  const classes = [];
  for (const id of TARGET_IDS) {
    const pokemon = await fetchJson(`${API}/pokemon/${id}`);
    const sprites = collectSprites(pokemon.sprites);
    const dir = join(TRAINING_DIR, pokemon.name);
    console.log(`${pokemon.name} (#${id}): ${sprites.length} variantes`);
    const files = await downloadAll(sprites, dir);
    classes.push({ label: pokemon.name, pokemonId: id, files });
  }
  return classes;
}

function negativeItems(pokemon) {
  const s = pokemon.sprites;
  const pick = [
    ['official', s.other?.['official-artwork']?.front_default],
    ['home', s.other?.home?.front_default],
    ['official-shiny', s.other?.['official-artwork']?.front_shiny],
    ['home-shiny', s.other?.home?.front_shiny],
    ['dream', s.other?.dream_world?.front_default],
    ['front', s.front_default],
    ['front-shiny', s.front_shiny],
  ];
  return pick
    .filter(([, url]) => url)
    .map(([kind, url]) => ({ url, file: `${pokemon.name}_${kind}.${url.endsWith('.svg') ? 'svg' : 'png'}` }));
}

async function downloadNegatives() {
  const { relatives, random } = await pickUnknownIds();
  const classes = [];
  for (const id of relatives) {
    const pokemon = await fetchJson(`${API}/pokemon/${id}`);
    const files = await downloadAll(negativeItems(pokemon), join(TRAINING_DIR, pokemon.name));
    console.log(`${pokemon.name} (#${id}, negativo): ${files.length} imágenes`);
    classes.push({ label: pokemon.name, pokemonId: null, files });
  }
  const items = [];
  for (const id of random) {
    items.push(...negativeItems(await fetchJson(`${API}/pokemon/${id}`)));
  }
  const files = await downloadAll(items, join(TRAINING_DIR, UNKNOWN_LABEL));
  console.log(`${UNKNOWN_LABEL}: ${random.length} Pokémon aleatorios (${random.join(', ')}) -> ${files.length} imágenes`);
  classes.push({ label: UNKNOWN_LABEL, pokemonId: null, files });
  return classes;
}

async function downloadModel() {
  if (existsSync(join(MODEL_DIR, 'model.json'))) {
    const shards = (await readdir(MODEL_DIR)).filter((f) => f.endsWith('.bin'));
    if (shards.length) {
      console.log('MobileNet ya descargado, se omite.');
      return;
    }
  }
  await mkdir(MODEL_DIR, { recursive: true });
  console.log('Descargando MobileNet v2 (~14 MB)...');
  const modelJson = await fetchWithRetry(`${MOBILENET_URL}/model.json?tfjs-format=file`);
  await writeFile(join(MODEL_DIR, 'model.json'), modelJson);
  const manifest = JSON.parse(modelJson.toString('utf8'));
  const paths = manifest.weightsManifest.flatMap((group) => group.paths);
  for (const p of paths) {
    await writeFile(join(MODEL_DIR, p), await fetchWithRetry(`${MOBILENET_URL}/${p}?tfjs-format=file`));
  }
  console.log(`MobileNet guardado en ${MODEL_DIR} (${paths.length} shards)`);
}

async function main() {
  await rm(TRAINING_DIR, { recursive: true, force: true });
  await mkdir(TRAINING_DIR, { recursive: true });
  const targets = await downloadTargets();
  const negatives = await downloadNegatives();
  const manifest = {
    generatedAt: new Date().toISOString(),
    unknownLabel: UNKNOWN_LABEL,
    classes: [...targets, ...negatives],
  };
  await writeFile(join(TRAINING_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Manifest escrito con ${manifest.classes.length} clases.`);
  if (!skipModel) await downloadModel();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
