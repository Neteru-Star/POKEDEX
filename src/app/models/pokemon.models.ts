export interface PokemonListItem {
  id: number;
  name: string;
  image: string;
}

export interface PokemonMoveInfo {
  name: string;
  type: string;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
}

export interface PokemonStatInfo {
  key: string;
  label: string;
  value: number;
}

export interface PokemonSummary {
  id: number;
  name: string;
  image: string;
  sprite: string;
  types: string[];
  description: string;
  genus: string;
}

export interface PokemonDetail extends PokemonSummary {
  height: number;
  weight: number;
  stats: PokemonStatInfo[];
  moves: PokemonMoveInfo[];
}
