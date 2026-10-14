import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { Camera, MediaTypeSelection } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  checkmarkCircle,
  helpCircleOutline,
  imagesOutline,
  refresh,
  videocamOffOutline,
} from 'ionicons/icons';

import { ArOverlayComponent } from '../../components/ar-overlay/ar-overlay.component';
import { PokemonSummary } from '../../models/pokemon.models';
import { RecognitionResult } from '../../models/recognition.models';
import { PokemonService } from '../../services/pokemon.service';
import { RecognitionService } from '../../services/recognition.service';
import { createCanvas, loadImage } from '../../utils/image-augmentation';

const GUIDE_RATIO = 0.75;

@Component({
  selector: 'app-scanner',
  templateUrl: 'scanner.page.html',
  styleUrl: 'scanner.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonContent,
    IonButton,
    IonIcon,
    IonSpinner,
    ArOverlayComponent,
  ],
})
export class ScannerPage {
  protected readonly recognition = inject(RecognitionService);
  private readonly pokemonService = inject(PokemonService);
  private readonly router = inject(Router);

  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private stream: MediaStream | null = null;

  protected readonly cameraActive = signal(false);
  protected readonly cameraError = signal<string | null>(null);
  protected readonly analyzing = signal(false);
  protected readonly result = signal<RecognitionResult | null>(null);
  protected readonly predictError = signal<string | null>(null);
  protected readonly arPokemon = signal<PokemonSummary | null>(null);
  protected readonly stillImage = signal<string | null>(null);

  protected readonly guideRatio = GUIDE_RATIO;
  protected readonly confidencePct = computed(() => Math.round((this.result()?.confianza ?? 0) * 100));
  protected readonly statusText = computed(() => {
    switch (this.recognition.status()) {
      case 'loading-model':
        return 'Cargando modelo…';
      case 'training':
        return `Preparando reconocimiento… ${Math.round(this.recognition.progress() * 100)}%`;
      case 'error':
        return this.recognition.error() ?? 'Error en el modelo';
      default:
        return '';
    }
  });

  constructor() {
    addIcons({ alertCircleOutline, checkmarkCircle, helpCircleOutline, imagesOutline, refresh, videocamOffOutline });
  }

  ionViewDidEnter(): void {
    void this.recognition.init();
    void this.startCamera();
  }

  ionViewWillLeave(): void {
    this.stopCamera();
  }

  protected async startCamera(): Promise<void> {
    this.cameraError.set(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraError.set('Este dispositivo no permite video en vivo. Usa la cámara o la galería.');
      return;
    }
    try {
      if (Capacitor.isNativePlatform()) {
        await Camera.requestPermissions({ permissions: ['camera'] });
      }
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const video = this.video().nativeElement;
      video.srcObject = this.stream;
      await video.play();
      this.cameraActive.set(true);
    } catch (err) {
      console.warn(err);
      this.cameraError.set('No se pudo acceder a la cámara. Revisa los permisos o usa la galería.');
      this.cameraActive.set(false);
    }
  }

  private stopCamera(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.cameraActive.set(false);
  }

  protected async capture(): Promise<void> {
    if (!this.cameraActive()) {
      try {
        const photo = await Camera.takePhoto({ webUseInput: true, correctOrientation: true });
        if (photo.webPath) {
          await this.analyzeUrl(photo.webPath);
        }
      } catch {
        // cancelado
      }
      return;
    }
    this.stillImage.set(null);
    await this.analyze(this.grabGuideFrame());
  }

  protected async pickFromGallery(): Promise<void> {
    try {
      const { results } = await Camera.chooseFromGallery({ mediaType: MediaTypeSelection.Photo });
      const path = results[0]?.webPath;
      if (path) {
        await this.analyzeUrl(path);
      }
    } catch {
      // cancelado
    }
  }

  protected reset(): void {
    this.result.set(null);
    this.arPokemon.set(null);
    this.predictError.set(null);
    this.stillImage.set(null);
  }

  private async analyzeUrl(url: string): Promise<void> {
    this.stillImage.set(url);
    await this.analyze(await loadImage(url));
  }

  private async analyze(image: HTMLImageElement | HTMLCanvasElement): Promise<void> {
    this.analyzing.set(true);
    this.predictError.set(null);
    this.result.set(null);
    this.arPokemon.set(null);
    try {
      const result = await this.recognition.predict(image);
      if (result.reconocido && result.pokemonId !== null) {
        this.arPokemon.set(await this.pokemonService.getSummary(result.pokemonId).catch(() => null));
      }
      this.result.set(result);
    } catch (err) {
      console.error(err);
      this.predictError.set('No se pudo analizar la imagen.');
    } finally {
      this.analyzing.set(false);
    }
  }

  protected openDetail(id: number): void {
    void this.router.navigate(['/pokemon', id]);
  }

  private grabGuideFrame(): HTMLCanvasElement {
    // el video usa object-fit: cover, hay que deshacer ese escalado
    const video = this.video().nativeElement;
    const { videoWidth: vw, videoHeight: vh, clientWidth: cw, clientHeight: ch } = video;
    const scale = Math.max(cw / vw, ch / vh);
    const side = Math.min((GUIDE_RATIO * Math.min(cw, ch)) / scale, vw, vh);
    const canvas = createCanvas(Math.round(side));
    canvas.getContext('2d')!.drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
    return canvas;
  }
}
