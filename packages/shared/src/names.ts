// Adresten deterministik, okunabilir kullanıcı adı: "PlainBasaltLark" gibi (sıfat + renk + hayvan).
const ADJECTIVES = [
  "Plain", "Sleek", "Tidy", "Lively", "Sharp", "Civil", "Frank", "Lucky", "Merry", "Outer",
  "Witty", "Prime", "Serene", "Late", "Snug", "Free", "Cosmic", "Dusk", "Lucid", "Pure",
  "Modest", "Fond", "Minor", "Brave", "Calm", "Eager", "Gentle", "Quiet", "Swift", "Bold",
];
const COLORS = [
  "Basalt", "Plum", "Cherry", "Cobalt", "Navy", "Flint", "Mauve", "Maple", "Frost", "Moss",
  "Rose", "Slate", "Chalk", "Zinc", "Coral", "Linen", "Pink", "Hazel", "Violet", "Umber",
  "Sepia", "Pine", "Beige", "Orchid", "Amber", "Jade", "Ivory", "Copper", "Teal", "Onyx",
];
const ANIMALS = [
  "Lark", "Pike", "Yak", "Ibis", "Panther", "Moose", "Salmon", "Brook", "Condor", "Starling",
  "Tide", "Swan", "Ridge", "Lynx", "Crow", "Orca", "Bell", "Trail", "Canyon", "Meridian",
  "Walrus", "Wren", "Bear", "Prairie", "Otter", "Heron", "Fox", "Owl", "Falcon", "Badger",
];

export function nameFromAddress(address: string): string {
  const hex = address.toLowerCase().replace(/^0x/, "");
  const a = parseInt(hex.slice(0, 8), 16);
  const b = parseInt(hex.slice(8, 16), 16);
  const c = parseInt(hex.slice(16, 24), 16);
  return `${ADJECTIVES[a % ADJECTIVES.length]}${COLORS[b % COLORS.length]}${ANIMALS[c % ANIMALS.length]}`;
}

/// Adresten deterministik iki renk (avatar gradyanı için).
export function colorsFromAddress(address: string): [string, string] {
  const hex = address.toLowerCase().replace(/^0x/, "");
  const h1 = parseInt(hex.slice(24, 28), 16) % 360;
  const h2 = (h1 + 40 + (parseInt(hex.slice(28, 32), 16) % 120)) % 360;
  return [`hsl(${h1} 70% 55%)`, `hsl(${h2} 70% 45%)`];
}
