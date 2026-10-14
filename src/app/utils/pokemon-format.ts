export const OFFICIAL_ARTWORK_URL =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';

export function artworkUrl(id: number): string {
  return `${OFFICIAL_ARTWORK_URL}/${id}.png`;
}

export function formatNumber(id: number): string {
  return `#${id.toString().padStart(3, '0')}`;
}

export function formatName(name: string): string {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function idFromUrl(url: string): number {
  const match = /\/(\d+)\/?$/.exec(url);
  return match ? Number(match[1]) : 0;
}

export function cleanFlavorText(text: string): string {
  return text
    .replace(/[\f\n\r\xad]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function firstSentence(text: string): string {
  const match = /^.*?[.!?](\s|$)/.exec(text);
  return (match ? match[0] : text).trim();
}

export const TYPE_INFO: Record<string, { label: string; color: string }> = {
  normal: { label: 'Normal', color: '#A8A77A' },
  fire: { label: 'Fuego', color: '#EE8130' },
  water: { label: 'Agua', color: '#6390F0' },
  electric: { label: 'Eléctrico', color: '#F7D02C' },
  grass: { label: 'Planta', color: '#7AC74C' },
  ice: { label: 'Hielo', color: '#96D9D6' },
  fighting: { label: 'Lucha', color: '#C22E28' },
  poison: { label: 'Veneno', color: '#A33EA1' },
  ground: { label: 'Tierra', color: '#E2BF65' },
  flying: { label: 'Volador', color: '#A98FF3' },
  psychic: { label: 'Psíquico', color: '#F95587' },
  bug: { label: 'Bicho', color: '#A6B91A' },
  rock: { label: 'Roca', color: '#B6A136' },
  ghost: { label: 'Fantasma', color: '#735797' },
  dragon: { label: 'Dragón', color: '#6F35FC' },
  dark: { label: 'Siniestro', color: '#705746' },
  steel: { label: 'Acero', color: '#B7B7CE' },
  fairy: { label: 'Hada', color: '#D685AD' },
};

export const STAT_LABELS: Record<string, string> = {
  hp: 'PS',
  attack: 'Ataque',
  defense: 'Defensa',
  'special-attack': 'At. Esp.',
  'special-defense': 'Def. Esp.',
  speed: 'Velocidad',
};
