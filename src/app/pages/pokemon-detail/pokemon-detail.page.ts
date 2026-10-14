import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { refresh, resizeOutline, barbellOutline, cloudOfflineOutline } from 'ionicons/icons';

import { TypeChipComponent } from '../../components/type-chip/type-chip.component';
import { PokemonDetail } from '../../models/pokemon.models';
import { PokemonService } from '../../services/pokemon.service';
import { TYPE_INFO, formatNumber } from '../../utils/pokemon-format';

const MAX_STAT = 180;
const DEFAULT_COLOR = '#8b93a5';

type DetailTab = 'info' | 'stats' | 'moves';

@Component({
  selector: 'app-pokemon-detail',
  templateUrl: 'pokemon-detail.page.html',
  styleUrl: 'pokemon-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonContent,
    IonSkeletonText,
    IonButton,
    IonIcon,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    TypeChipComponent,
  ],
})
export class PokemonDetailPage {
  private readonly pokemonService = inject(PokemonService);

  readonly id = input.required<string>();

  protected readonly pokemon = signal<PokemonDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly tab = signal<DetailTab>('info');

  protected readonly number = computed(() => formatNumber(Number(this.id())));
  protected readonly color = computed(() => {
    const type = this.pokemon()?.types[0];
    return (type && TYPE_INFO[type]?.color) || DEFAULT_COLOR;
  });
  protected readonly totalStats = computed(() =>
    (this.pokemon()?.stats ?? []).reduce((sum, s) => sum + s.value, 0),
  );

  constructor() {
    addIcons({ refresh, resizeOutline, barbellOutline, cloudOfflineOutline });
    effect(() => {
      const id = this.id();
      untracked(() => void this.load(id));
    });
  }

  protected async load(id = this.id()): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.pokemon.set(await this.pokemonService.getDetail(id));
    } catch {
      this.error.set('No se pudo cargar este Pokémon.');
    } finally {
      this.loading.set(false);
    }
  }

  protected onTabChange(event: CustomEvent<{ value?: string | number }>): void {
    this.tab.set((event.detail.value as DetailTab | undefined) ?? 'info');
  }

  protected statPercent(value: number): number {
    return Math.min(100, (value / MAX_STAT) * 100);
  }

  protected typeColor(type: string): string {
    return TYPE_INFO[type]?.color ?? DEFAULT_COLOR;
  }
}
