export interface TrainingManifest {
  generatedAt: string;
  unknownLabel: string;
  classes: TrainingClass[];
}

export interface TrainingClass {
  label: string;
  pokemonId: number | null;
  files: string[];
}

export type RecognitionStatus = 'idle' | 'loading-model' | 'training' | 'ready' | 'error';

export interface RecognitionResult {
  pokemon: string;
  pokemonId: number | null;
  confianza: number;
  reconocido: boolean;
  scores: Record<string, number>;
}

export type RecognizableImage = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;
