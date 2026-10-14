import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  FlavorTextEntry,
  LocalizedName,
  Move,
  Pokemon,
  PokemonListResponse,
  PokemonMoveSlot,
  PokemonSpecies,
  PokemonTypeResponse,
} from '../models/pokeapi.models';
import {
  PokemonDetail,
  PokemonListItem,
  PokemonMoveInfo,
  PokemonSummary,
} from '../models/pokemon.models';
import {
  STAT_LABELS,
  TYPE_INFO,
  artworkUrl,
  cleanFlavorText,
  formatName,
  idFromUrl,
} from '../utils/pokemon-format';

const API = 'https://pokeapi.co/api/v2';
const GEN1_LIMIT = 151;
const MAX_MOVES = 15;
const PREFERRED_LANG = 'es';
const FALLBACK_LANG = 'en';

@Injectable({ providedIn: 'root' })
export class PokemonService {
  private readonly http = inject(HttpClient);

  private readonly cache = new Map<string, Promise<unknown>>();

  private get<T>(url: string): Promise<T> {
    const cached = this.cache.get(url);
    if (cached) {
      return cached as Promise<T>;
    }
    const request = firstValueFrom(this.http.get<T>(url));
    this.cache.set(url, request);
    request.catch(() => this.cache.delete(url));
    return request;
  }

  async getList(): Promise<PokemonListItem[]> {
    const response = await this.get<PokemonListResponse>(`${API}/pokemon?limit=${GEN1_LIMIT}`);
    return response.results.map((result) => {
      const id = idFromUrl(result.url);
      return { id, name: formatName(result.name), image: artworkUrl(id) };
    });
  }

  // la lista no trae tipos: 18 llamadas a /type salen más baratas que 151 a /pokemon
  async getTypesById(): Promise<Map<number, string[]>> {
    const responses = await Promise.all(
      Object.keys(TYPE_INFO).map((type) => this.get<PokemonTypeResponse>(`${API}/type/${type}`)),
    );
    const slots = new Map<number, { type: string; slot: number }[]>();
    for (const response of responses) {
      for (const entry of response.pokemon) {
        const id = idFromUrl(entry.pokemon.url);
        if (id <= GEN1_LIMIT) {
          slots.set(id, [...(slots.get(id) ?? []), { type: response.name, slot: entry.slot }]);
        }
      }
    }
    return new Map(
      [...slots].map(([id, list]) => [id, list.sort((a, b) => a.slot - b.slot).map((t) => t.type)]),
    );
  }

  getPokemon(idOrName: number | string): Promise<Pokemon> {
    return this.get<Pokemon>(`${API}/pokemon/${idOrName}`);
  }

  getSpecies(idOrName: number | string): Promise<PokemonSpecies> {
    return this.get<PokemonSpecies>(`${API}/pokemon-species/${idOrName}`);
  }

  getMove(nameOrId: string | number): Promise<Move> {
    return this.get<Move>(`${API}/move/${nameOrId}`);
  }

  async getSummary(idOrName: number | string): Promise<PokemonSummary> {
    const [pokemon, species] = await Promise.all([
      this.getPokemon(idOrName),
      this.getSpecies(idOrName),
    ]);
    return this.toSummary(pokemon, species);
  }

  async getDetail(idOrName: number | string): Promise<PokemonDetail> {
    const [pokemon, species] = await Promise.all([
      this.getPokemon(idOrName),
      this.getSpecies(idOrName),
    ]);
    const moves = await this.loadMoves(pokemon.moves);
    return {
      ...this.toSummary(pokemon, species),
      height: pokemon.height / 10,
      weight: pokemon.weight / 10,
      stats: pokemon.stats.map((s) => ({
        key: s.stat.name,
        label: STAT_LABELS[s.stat.name] ?? formatName(s.stat.name),
        value: s.base_stat,
      })),
      moves,
    };
  }

  private toSummary(pokemon: Pokemon, species: PokemonSpecies): PokemonSummary {
    const artwork = pokemon.sprites.other?.['official-artwork']?.front_default ?? artworkUrl(pokemon.id);
    return {
      id: pokemon.id,
      name: this.localizedName(species.names) ?? formatName(pokemon.name),
      image: artwork,
      sprite: pokemon.sprites.front_default ?? artwork,
      types: [...pokemon.types].sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
      description: this.description(species.flavor_text_entries),
      genus:
        species.genera.find((g) => g.language.name === PREFERRED_LANG)?.genus ??
        species.genera.find((g) => g.language.name === FALLBACK_LANG)?.genus ??
        '',
    };
  }

  private description(entries: FlavorTextEntry[]): string {
    const pick = (lang: string): FlavorTextEntry | undefined =>
      entries.filter((e) => e.language.name === lang).at(-1);
    const entry = pick(PREFERRED_LANG) ?? pick(FALLBACK_LANG);
    return entry ? cleanFlavorText(entry.flavor_text) : 'Sin descripción disponible.';
  }

  private localizedName(names: LocalizedName[]): string | undefined {
    return names.find((n) => n.language.name === PREFERRED_LANG)?.name;
  }

  private async loadMoves(slots: PokemonMoveSlot[]): Promise<PokemonMoveInfo[]> {
    const levelOf = (slot: PokemonMoveSlot): number => {
      const levels = slot.version_group_details
        .filter((d) => d.move_learn_method.name === 'level-up')
        .map((d) => d.level_learned_at);
      return levels.length ? Math.min(...levels) : Number.MAX_SAFE_INTEGER;
    };
    const selected = [...slots]
      .map((slot, index) => ({ slot, index, level: levelOf(slot) }))
      .sort((a, b) => a.level - b.level || a.index - b.index)
      .slice(0, MAX_MOVES);

    const moves = await Promise.all(
      selected.map(({ slot }) => this.getMove(idFromUrl(slot.move.url)).catch(() => null)),
    );
    return moves
      .filter((move): move is Move => move !== null)
      .map((move) => ({
        name: this.localizedName(move.names) ?? formatName(move.name),
        type: move.type.name,
        power: move.power,
        accuracy: move.accuracy,
        pp: move.pp,
      }));
  }
}
