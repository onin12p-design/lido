export type SlotType = 'morning' | 'afternoon' | 'full_day';
export type CustomerType = 'daily' | 'subscriber';

export interface Booking {
  id?: string;
  bedNumber: number;
  date: string; // YYYY-MM-DD
  slot: SlotType;
  customerName: string;
  customerType: CustomerType;
  notes?: string;
  createdAt?: string;
}

export interface BedConfig {
  number: number;
  row: number;
  col: number;
  platform: 'left' | 'right';
  gridSection: 'left' | 'right'; // Left grid vs right grid inside that platform
}

// Full bed layout structure to mirror the user's paper map exactly.
export const PEDANA_SINISTRA_LEFT = [
  [1, 2, 3, 4, 5],
  [11, 12, 13, 14, 15],
  [21, 22, 23, 24, 25],
  [31, 32, 33, 34, null] // null or placeholder for missing col 5 in row 4
];

export const PEDANA_SINISTRA_RIGHT = [
  [6, 7, 8, 9, 10],
  [16, 17, 18, 19, 20],
  [26, 27, 28, 29, 30]
];

export const PEDANA_DESTRA_LEFT = [
  [60, 61, 62, 63, 64],
  [71, 72, 73, 74, 75],
  [82, 83, 84, 85, 86],
  [93, 94, 95, 96, 97]
];

export const PEDANA_DESTRA_RIGHT = [
  [65, 66, 67, 68, 69, 70],
  [76, 77, 78, 79, 80, 81],
  [87, 88, 89, 90, 91, 92],
  [98, 99, 100, 101, 102, 103],
  [109, 108, 107, 106, 105, 104] // note reversed order 109 to 104
];

// Helper to check if a bed number exists
export const ALL_BED_NUMBERS: number[] = [
  ...PEDANA_SINISTRA_LEFT.flat().filter((x): x is number => x !== null),
  ...PEDANA_SINISTRA_RIGHT.flat(),
  ...PEDANA_DESTRA_LEFT.flat(),
  ...PEDANA_DESTRA_RIGHT.flat()
];
