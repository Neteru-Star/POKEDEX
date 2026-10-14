import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { close, bookOutline } from 'ionicons/icons';

import { PokemonSummary } from '../../models/pokemon.models';
import { TYPE_INFO, firstSentence, formatNumber } from '../../utils/pokemon-format';
import { TypeChipComponent } from '../type-chip/type-chip.component';

@Component({
  selector: 'app-ar-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonButton, IonIcon, TypeChipComponent],
  template: `
    <article class="card" [style.--accent]="accent()">
      <button class="close" type="button" aria-label="Cerrar y escanear otra vez" (click)="closed.emit()">
        <ion-icon name="close"></ion-icon>
      </button>
      <div class="header">
        <img class="sprite" [src]="pokemon().image" [alt]="pokemon().name" />
        <div>
          <span class="number">{{ number() }}</span>
          <h2>{{ pokemon().name }}</h2>
          <div class="types">
            @for (t of pokemon().types; track t) {
              <app-type-chip [type]="t" variant="glass" [small]="true"></app-type-chip>
            }
          </div>
        </div>
      </div>
      <p class="description">{{ sentence() }}</p>
      <div class="confidence">
        <div class="confidence-label"><span>Coincidencia</span><strong>{{ confidencePct() }}%</strong></div>
        <div class="confidence-bar"><i [style.width.%]="confidencePct()"></i></div>
      </div>
      <ion-button expand="block" shape="round" color="light" class="cta" (click)="viewDetail.emit(pokemon().id)">
        <ion-icon slot="start" name="book-outline"></ion-icon>
        Ver en Pokédex
      </ion-button>
    </article>
  `,
  styles: `
    :host {
      display: block;
    }
    .card {
      position: relative;
      overflow: hidden;
      padding: 18px;
      border-radius: 28px;
      color: #fff;
      background: linear-gradient(145deg, color-mix(in srgb, var(--accent) 80%, transparent), rgba(15, 15, 25, 0.82));
      border: 2px solid rgba(255, 255, 255, 0.55);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45), 0 0 24px color-mix(in srgb, var(--accent) 60%, transparent);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    .card::before {
      content: '';
      position: absolute;
      inset: -50%;
      background: linear-gradient(115deg, transparent 40%, rgba(255, 255, 255, 0.28) 50%, transparent 60%);
      animation: sheen 3.2s ease-in-out infinite;
      pointer-events: none;
    }
    .card::after {
      content: '';
      position: absolute;
      right: -40px;
      top: -40px;
      width: 160px;
      height: 160px;
      background: var(--pokeball) center / contain no-repeat;
      opacity: 0.12;
      pointer-events: none;
    }
    .close {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      background: rgba(0, 0, 0, 0.35);
      color: #fff;
      font-size: 20px;
      display: grid;
      place-items: center;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .sprite {
      width: 96px;
      height: 96px;
      object-fit: contain;
      filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.4));
      animation: float 2.4s ease-in-out infinite;
    }
    h2 {
      margin: 0 0 6px;
      font-weight: 800;
    }
    .number {
      font-size: 0.8rem;
      opacity: 0.8;
      font-weight: 700;
    }
    .types {
      display: flex;
      gap: 6px;
    }
    .description {
      margin: 12px 0;
      line-height: 1.4;
      font-size: 0.95rem;
    }
    .confidence {
      margin-bottom: 14px;
    }
    .confidence-label {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      margin-bottom: 6px;
    }
    .confidence-label span {
      opacity: 0.8;
    }
    .confidence-bar {
      height: 6px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.2);
      overflow: hidden;
    }
    .confidence-bar i {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: #fff;
      animation: grow 0.9s 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) both;
      transform-origin: left;
    }
    .cta {
      margin: 0;
      font-weight: 800;
      --color: #111;
    }
    .header, .description, .confidence, .cta, .close {
      position: relative;
      z-index: 1;
    }
    @keyframes sheen {
      0% { transform: translateX(-60%); }
      60%, 100% { transform: translateX(60%); }
    }
    @keyframes grow {
      from { transform: scaleX(0); }
    }
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }
  `,
})
export class ArOverlayComponent {
  readonly pokemon = input.required<PokemonSummary>();
  readonly confianza = input(0);

  readonly closed = output<void>();
  readonly viewDetail = output<number>();

  protected readonly number = computed(() => formatNumber(this.pokemon().id));
  protected readonly sentence = computed(() => firstSentence(this.pokemon().description));
  protected readonly confidencePct = computed(() => Math.round(this.confianza() * 100));
  protected readonly accent = computed(() => TYPE_INFO[this.pokemon().types[0]]?.color ?? '#e53935');

  constructor() {
    addIcons({ close, bookOutline });
  }
}
