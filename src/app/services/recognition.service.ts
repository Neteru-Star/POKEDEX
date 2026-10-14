import { HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import '@tensorflow/tfjs-backend-cpu';
import '@tensorflow/tfjs-backend-webgl';
import * as tf from '@tensorflow/tfjs-core';
import * as knnClassifier from '@tensorflow-models/knn-classifier';
import * as mobilenet from '@tensorflow-models/mobilenet';
import { firstValueFrom } from 'rxjs';

import {
  RecognitionResult,
  RecognitionStatus,
  RecognizableImage,
  TrainingManifest,
} from '../models/recognition.models';
import { readDataset, writeDataset } from '../utils/embedding-cache';
import {
  centerCrop,
  loadImage,
  renderAugmented,
  renderOriginal,
  seededRandom,
  toSquareCanvas,
} from '../utils/image-augmentation';
import { formatName } from '../utils/pokemon-format';

export const RECOGNITION_THRESHOLD = new InjectionToken<number>('RECOGNITION_THRESHOLD', {
  providedIn: 'root',
  factory: () => 0.7,
});

const TRAINING_BASE = 'assets/training';
const MODEL_URL = 'assets/models/mobilenet/model.json';
const EXAMPLES_PER_CLASS = 200;
const HIGH_RES_SHARE = 0.6;
const HIGH_RES_MIN_SIZE = 200;
const K = 10;
const PREDICT_CROPS = [1, 0.8];
// subir si cambia el aumento de datos (invalida la caché de IndexedDB)
const PIPELINE_VERSION = 2;

export const NOT_RECOGNIZED = 'No reconocido';

@Injectable({ providedIn: 'root' })
export class RecognitionService {
  private readonly http = inject(HttpClient);

  readonly threshold = signal(inject(RECOGNITION_THRESHOLD));
  readonly status = signal<RecognitionStatus>('idle');
  readonly progress = signal(0);
  readonly error = signal<string | null>(null);
  readonly ready = computed(() => this.status() === 'ready');

  private model: mobilenet.MobileNet | null = null;
  private readonly classifier = knnClassifier.create();
  private manifest: TrainingManifest | null = null;
  private initPromise: Promise<void> | null = null;

  init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.doInit().catch((err: unknown) => {
        console.error(err);
        this.status.set('error');
        this.error.set('No se pudo preparar el modelo de reconocimiento.');
        this.initPromise = null; // Permite reintentar.
      });
    }
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    this.error.set(null);
    this.status.set('loading-model');
    await tf.ready();
    this.model ??= await mobilenet.load({ version: 2, alpha: 1.0, modelUrl: MODEL_URL, inputRange: [0, 1] });

    this.status.set('training');
    this.progress.set(0);
    this.manifest = await firstValueFrom(this.http.get<TrainingManifest>(`${TRAINING_BASE}/manifest.json`));
    await this.train(this.manifest);
    this.progress.set(1);
    this.status.set('ready');
  }

  private async train(manifest: TrainingManifest): Promise<void> {
    const cacheKey = `${manifest.generatedAt}|v${PIPELINE_VERSION}|n${EXAMPLES_PER_CLASS}`;
    const cached = await readDataset(cacheKey);
    if (cached) {
      this.setDataset(cached.classes, cached.dimension);
      return;
    }

    const total = manifest.classes.reduce((sum, c) => sum + c.files.length, 0);
    const rand = seededRandom(42);
    const embeddings: Record<string, number[][]> = {};
    let done = 0;
    let dimension = 0;

    for (const cls of manifest.classes) {
      embeddings[cls.label] = [];
      const images = await Promise.all(
        cls.files.map((file) => loadImage(`${TRAINING_BASE}/${cls.label}/${file}`).catch(() => null)),
      );
      const loaded = images.filter((img): img is HTMLImageElement => img !== null);
      const isHighRes = (img: HTMLImageElement) =>
        Math.max(img.naturalWidth, img.naturalHeight) >= HIGH_RES_MIN_SIZE;
      const highRes = loaded.filter(isHighRes).length;
      const lowRes = loaded.length - highRes;
      const share = highRes && lowRes ? HIGH_RES_SHARE : 1;
      const perHighRes = Math.max(1, Math.round((EXAMPLES_PER_CLASS * share) / Math.max(highRes, 1)));
      const perLowRes = Math.max(1, Math.round((EXAMPLES_PER_CLASS * (1 - share || 1)) / Math.max(lowRes, 1)));

      for (const img of images) {
        if (img) {
          const count = isHighRes(img) ? perHighRes : perLowRes;
          const variants = [renderOriginal(img)];
          for (let i = 1; i < count; i++) {
            variants.push(renderAugmented(img, rand));
          }
          for (const canvas of variants) {
            const vector = this.embed(canvas);
            dimension = vector.length;
            embeddings[cls.label].push(vector);
          }
        }
        done++;
        this.progress.set(done / total);
        await new Promise((resolve) => setTimeout(resolve));
      }
    }

    const classes: Record<string, Float32Array> = {};
    for (const [label, vectors] of Object.entries(embeddings)) {
      if (vectors.length) {
        classes[label] = Float32Array.from(vectors.flat());
      }
    }
    this.setDataset(classes, dimension);
    await writeDataset({ key: cacheKey, dimension, classes });
  }

  private setDataset(classes: Record<string, Float32Array>, dimension: number): void {
    this.classifier.clearAllClasses();
    const dataset: Record<string, tf.Tensor2D> = {};
    for (const [label, data] of Object.entries(classes)) {
      dataset[label] = tf.tensor2d(data, [data.length / dimension, dimension]);
    }
    this.classifier.setClassifierDataset(dataset);
  }

  private embed(canvas: HTMLCanvasElement): number[] {
    const model = this.model!;
    const values = tf.tidy(() => {
      const activation = model.infer(canvas, true) as tf.Tensor;
      return tf.div(activation, tf.norm(activation)).dataSync();
    });
    return Array.from(values);
  }

  async predict(image: RecognizableImage): Promise<RecognitionResult> {
    await this.init();
    if (!this.ready() || !this.model || !this.manifest) {
      throw new Error('El modelo de reconocimiento no está disponible.');
    }
    const square = toSquareCanvas(image);
    const scores: Record<string, number> = {};
    for (const crop of PREDICT_CROPS) {
      const input = crop === 1 ? square : centerCrop(square, crop);
      const activation = tf.tidy(() => this.model!.infer(input, true) as tf.Tensor);
      try {
        const { confidences } = await this.classifier.predictClass(activation, K);
        for (const [label, value] of Object.entries(confidences)) {
          scores[label] = (scores[label] ?? 0) + value / PREDICT_CROPS.length;
        }
      } finally {
        activation.dispose();
      }
    }

    const [label, confianza] = Object.entries(scores).reduce((best, entry) => (entry[1] > best[1] ? entry : best));
    const cls = this.manifest.classes.find((c) => c.label === label);
    const reconocido =
      !!cls && cls.pokemonId !== null && label !== this.manifest.unknownLabel && confianza >= this.threshold();
    return {
      pokemon: reconocido ? formatName(label) : NOT_RECOGNIZED,
      pokemonId: reconocido ? cls!.pokemonId : null,
      confianza,
      reconocido,
      scores,
    };
  }
}
