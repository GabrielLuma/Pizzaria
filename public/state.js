import { cartLines, quotePizza, canProceed } from './order.js';

const STORAGE_KEY = 'luna-order-v1';
const VERSION = 1;
const TTL = 24 * 60 * 60 * 1000;
const CATEGORIES = ['todos', 'tradicionais', 'especiais', 'doces'];
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function defaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function orderState(value) {
  if (!isRecord(value) || !isRecord(value.cart) || !Number.isInteger(value.step) || value.step < 1 || value.step > 5 || !CATEGORIES.includes(value.category)) return null;

  const cart = Object.fromEntries(Object.entries(value.cart));
  cartLines(cart);

  let draft = null;
  if (value.draft !== null) {
    if (!isRecord(value.draft) || !Array.isArray(value.draft.flavorIds)) return null;
    const source = value.draft;
    draft = {
      sizeId: source.sizeId,
      edgeId: source.edgeId,
      flavorIds: [...source.flavorIds],
      drinkId: source.drinkId,
      sauceQuantity: source.sauceQuantity,
    };
    quotePizza(draft);
    for (let step = 2; step < value.step; step++) {
      if (!canProceed(draft, step)) return null;
    }
  } else if (value.step !== 1) {
    return null;
  }

  return { cart, draft, step: value.step, category: value.category };
}

export function loadOrderState(storage = defaultStorage()) {
  try {
    if (!storage) return null;
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    const age = Date.now() - saved.savedAt;
    if (saved.version !== VERSION || !Number.isSafeInteger(saved.savedAt) || age < 0 || age >= TTL) return null;
    return orderState(saved);
  } catch {
    return null;
  }
}

export function saveOrderState(value, storage = defaultStorage()) {
  try {
    if (!storage) return false;
    const state = orderState(value);
    if (!state) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, savedAt: Date.now(), ...state }));
    return true;
  } catch {
    return false;
  }
}
