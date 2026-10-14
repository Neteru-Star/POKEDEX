export interface NamedAPIResource {
  name: string;
  url: string;
}

export interface PokemonListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: NamedAPIResource[];
}

export interface PokemonTypeSlot {
  slot: number;
  type: NamedAPIResource;
}

export interface PokemonStat {
  base_stat: number;
  effort: number;
  stat: NamedAPIResource;
}

export interface PokemonMoveVersionDetail {
  level_learned_at: number;
  move_learn_method: NamedAPIResource;
  version_group: NamedAPIResource;
}

export interface PokemonMoveSlot {
  move: NamedAPIResource;
  version_group_details: PokemonMoveVersionDetail[];
}

export interface OfficialArtworkSprites {
  front_default: string | null;
  front_shiny: string | null;
}

export interface PokemonSprites {
  front_default: string | null;
  back_default: string | null;
  front_shiny: string | null;
  back_shiny: string | null;
  other?: {
    'official-artwork'?: OfficialArtworkSprites;
    home?: { front_default: string | null; front_shiny: string | null };
    dream_world?: { front_default: string | null };
  };
}

export interface Pokemon {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: PokemonTypeSlot[];
  stats: PokemonStat[];
  moves: PokemonMoveSlot[];
  sprites: PokemonSprites;
  species: NamedAPIResource;
}

export interface FlavorTextEntry {
  flavor_text: string;
  language: NamedAPIResource;
  version: NamedAPIResource;
}

export interface LocalizedName {
  name: string;
  language: NamedAPIResource;
}

export interface Genus {
  genus: string;
  language: NamedAPIResource;
}

export interface PokemonSpecies {
  id: number;
  name: string;
  names: LocalizedName[];
  genera: Genus[];
  flavor_text_entries: FlavorTextEntry[];
}

export interface Move {
  id: number;
  name: string;
  names: LocalizedName[];
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  type: NamedAPIResource;
  damage_class: NamedAPIResource;
}

export interface TypePokemonSlot {
  slot: number;
  pokemon: NamedAPIResource;
}

export interface PokemonTypeResponse {
  id: number;
  name: string;
  pokemon: TypePokemonSlot[];
}
