import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonFab,
  IonIcon,
  IonSearchbar,
  IonSkeletonText,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { scan, refresh, cloudOfflineOutline } from 'ionicons/icons';

import { PokemonCardComponent } from '../../components/pokemon-card/pokemon-card.component';
import { PokemonListItem } from '../../models/pokemon.models';
import { PokemonService } from '../../services/pokemon.service';
import { TYPE_INFO } from '../../utils/pokemon-format';

interface TypeFilter {
  key: string;
  label: string;
  color: string;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrl: 'home.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IonContent,
    IonSearchbar,
    IonSkeletonText,
    IonButton,
    IonIcon,
    IonFab,
    PokemonCardComponent,
  ],
})
export class HomePage {
  private readonly pokemonService = inject(PokemonService);

  protected readonly pokemon = signal<PokemonListItem[]>([]);
  protected readonly typesById = signal<Map<number, string[]>>(new Map());
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly query = signal('');
  protected readonly selectedType = signal<string | null>(null);
  protected readonly skeletons = Array.from({ length: 10 }, (_, i) => i);

  protected readonly typeFilters = computed<TypeFilter[]>(() => {
    const present = new Set([...this.typesById().values()].flat());
    return Object.entries(TYPE_INFO)
      .filter(([key]) => present.has(key))
      .map(([key, info]) => ({ key, ...info }));
  });

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase().replace(/^#/, '');
    const type = this.selectedType();
    const types = this.typesById();
    const asNumber = /^\d+$/.test(q) ? Number(q) : null;
    return this.pokemon().filter(
      (p) =>
        (!q || p.name.toLowerCase().includes(q) || (asNumber !== null && p.id === asNumber)) &&
        (!type || (types.get(p.id) ?? []).includes(type)),
    );
  });

  constructor() {
    addIcons({ scan, refresh, cloudOfflineOutline });
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.pokemon.set(await this.pokemonService.getList());
      this.pokemonService
        .getTypesById()
        .then((types) => this.typesById.set(types))
        .catch(() => undefined);
    } catch {
      this.error.set('No se pudo cargar la Pokédex. Revisa tu conexión a internet.');
    } finally {
      this.loading.set(false);
    }
  }

  protected onSearch(event: CustomEvent<{ value?: string | null }>): void {
    this.query.set(event.detail.value ?? '');
  }

  protected toggleType(type: string | null): void {
    this.selectedType.set(this.selectedType() === type ? null : type);
  }

  protected typesOf(id: number): string[] {
    return this.typesById().get(id) ?? [];
  }
}
