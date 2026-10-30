import type { AgentType } from '../sim/types';

export const COLORS = {
  background: '#f3ece2',
  floor: '#e6e2dc',
  gridLine: '#cfc8bf',
  wall: '#c9705a',
  wallTop: '#d98a72',
  door: '#b5835a',
  threshold: '#c9b79c',
  glass: '#bfe3f2',
  swing: '#ff8a2a',
  hover: '#23395b',
  editable: '#ffd166',
  editableEdge: '#ff9f1c',
  oneway: '#2fb36b',
  slab: '#d8cfc3',
  counter: '#d9a46c',
  sinkCounter: '#b9cfd8',
  steel: '#c3c9d1',
  mat: '#d96c5f',
  /** Muted shirts for diners so they never look like workers. */
  diners: ['#e9b8c4', '#f3dd8a', '#c8d7a4', '#d7c3a8', '#c9c2e6'],
  zones: {
    kitchen: '#f6c99b',
    washing: '#a9d6e5',
    dining: '#c7e3b0',
    entrance: '#ffe3a3',
    exit: '#f7c4b8',
    shoes: '#e8cfa9',
    wash: '#a9d6e5',
    basket: '#f2d3e3',
    hall: '#c7e3b0',
  } as Record<string, string>,
  shoeRack: '#b98b5e',
  slot: '#6b4a32',
  basket: '#d9b26f',
  /** Head covers (patkas / chunnis) in the basket. */
  cloth: ['#f2a65a', '#6c9bd2', '#e9b8c4', '#f3dd8a'],
  standMat: '#e8d9b5',
  rail: '#8a8f99',
  busiest: '#e5394b',
};

/** Shirt colour tells you what someone is doing. */
export const SHIRT: Record<AgentType, string> = {
  crate: '#f2a65a',
  tray: '#6cc4b8',
  empty: '#b7a6e0',
  elderly: '#9fb4c7',
  /** Visitors wear their own clothes: the renderer picks one of the muted diner colours per person. */
  sangat: '#e9b8c4',
};

export const SKIN = ['#f5d0b5', '#e0ac85', '#c68a62', '#8d5a3b'];
