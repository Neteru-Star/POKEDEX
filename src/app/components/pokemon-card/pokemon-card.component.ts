import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PokemonListItem } from '../../models/pokemon.models';
import { TYPE_INFO, formatNumber } from '../../utils/pokemon-format';
import { TypeChipComponent } from '../type-chip/type-chip.component';

const PENDING_COLOR = '#8b93a5';

@Component({
  selector: 'app-pokemon-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TypeChipComponent],
  template: `
    <a class="card" [routerLink]="['/pokemon', pokemon().id]" [style.--card]="color()">
      <span class="number">{{ number() }}</span>
      <h3 class="name">{{ pokemon().name }}</h3>
      <div class="types">
        @for (t of types(); track t) {
          <app-type-chip [type]="t" variant="glass" [small]="true"></app-type-chip>
        }
      </div>
      <img [src]="pokemon().image" [alt]="pokemon().name" loading="lazy" width="96" height="96" />
    </a>
  `,
  styles: `
    :host {
      display: block;
    }
    .card {
      position: relative;
      display: block;
      height: 132px;
      padding: 14px;
      overflow: hidden;
      border-radius: var(--app-radius);
      color: #fff;
      text-decoration: none;
      background:
        radial-gradient(circle at 85% 20%, rgba(255, 255, 255, 0.25), transparent 55%),
        var(--card);
      box-shadow: 0 8px 20px color-mix(in srgb, var(--card) 35%, transparent);
      transition:
        transform 0.18s ease,
        background-color 0.4s ease;
    }
    .card::after {
      content: '';
      position: absolute;
      right: -22px;
      bottom: -22px;
      width: 112px;
      height: 112px;
      background: var(--pokeball) center / contain no-repeat;
      opacity: 0.18;
    }
    .card:active {
      transform: scale(0.96);
    }
    .number {
      position: absolute;
      top: 12px;
      right: 14px;
      font-size: 0.75rem;
      font-weight: 800;
      opacity: 0.6;
    }
    .name {
      margin: 2px 0 8px;
      font-size: 1rem;
      font-weight: 800;
      max-width: 70%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .types {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }
    img {
      position: absolute;
      right: 4px;
      bottom: 4px;
      z-index: 1;
      width: 84px;
      height: 84px;
      object-fit: contain;
      filter: drop-shadow(0 6px 8px rgba(0, 0, 0, 0.25));
    }
  `,
})
export class PokemonCardComponent {
  readonly pokemon = input.required<PokemonListItem>();
  readonly types = input<string[]>([]);

  protected readonly number = computed(() => formatNumber(this.pokemon().id));
  protected readonly color = computed(() => TYPE_INFO[this.types()[0]]?.color ?? PENDING_COLOR);
}
