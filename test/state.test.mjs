import test from 'node:test';
import assert from 'node:assert/strict';
import { createPizzaDraft, pizzaKey } from '../public/order.js';
import { loadOrderState, saveOrderState } from '../public/state.js';

const KEY = 'luna-order-v1';
const TTL = 24 * 60 * 60 * 1000;

function memoryStorage() {
  const data = new Map();
  return {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

function sampleState() {
  const draft = { ...createPizzaDraft('grande'), edgeId: 'sem', flavorIds: ['t0', 'e0'], drinkId: 'none', sauceQuantity: 0 };
  return { cart: { [pizzaKey(draft)]: 2, bebidas0: 1 }, draft, step: 5, category: 'especiais' };
}

function writeEnvelope(storage, state = sampleState(), extra = {}) {
  storage.setItem(KEY, JSON.stringify({ version: 1, savedAt: Date.now(), ...state, ...extra }));
}

test('restaura carrinho válido e montagem, incluindo pizza combinada e quantidades', () => {
  const storage = memoryStorage();
  const state = sampleState();
  assert.equal(loadOrderState(storage), null);
  assert.equal(saveOrderState(state, storage), true);
  assert.deepEqual(loadOrderState(storage), state);
  state.draft.flavorIds.push('t1');
  assert.deepEqual(loadOrderState(storage).draft.flavorIds, ['t0', 'e0']);
  const saved = JSON.parse(storage.getItem(KEY));
  assert.equal(saved.version, 1);
  assert.ok(Number.isSafeInteger(saved.savedAt));
});

test('aceita montagem parcial nas etapas corretas e carrinho sem pizza em edição', () => {
  const storage = memoryStorage();
  for (const state of [
    { ...sampleState(), category: 'todos' },
    { cart: {}, draft: null, step: 1, category: 'tradicionais' },
    { cart: { lanches0: 1 }, draft: createPizzaDraft('broto'), step: 2, category: 'doces' },
    { cart: {}, draft: { ...createPizzaDraft('media'), edgeId: 'cheddar' }, step: 3, category: 'especiais' },
    { cart: {}, draft: { ...createPizzaDraft('pequena'), edgeId: 'sem', flavorIds: ['t0'] }, step: 4, category: 'tradicionais' },
  ]) {
    assert.equal(saveOrderState(state, storage), true);
    assert.deepEqual(loadOrderState(storage), state);
  }
});

test('expira em 24 horas e rejeita versão, timestamp ou JSON inválidos', () => {
  const storage = memoryStorage();
  writeEnvelope(storage, sampleState(), { savedAt: Date.now() - TTL + 60_000 });
  assert.ok(loadOrderState(storage));
  for (const extra of [
    { savedAt: Date.now() - TTL },
    { savedAt: Date.now() - TTL - 1 },
    { savedAt: Date.now() + 60_000 },
    { savedAt: 'ontem' },
    { version: 2 },
  ]) {
    writeEnvelope(storage, sampleState(), extra);
    assert.equal(loadOrderState(storage), null);
  }
  for (const raw of ['{broken', 'null', '[]']) {
    storage.setItem(KEY, raw);
    assert.equal(loadOrderState(storage), null);
  }
});

test('rejeita carrinhos adulterados, limites inválidos e IDs que não existem', () => {
  const storage = memoryStorage();
  const good = sampleState();
  for (const state of [
    { ...good, cart: [] },
    { ...good, cart: null },
    ...[0, -1, 21, 1.5, '1'].map(quantity => ({ ...good, cart: { bebidas0: quantity } })),
    { ...good, cart: { inexistente: 1 } },
    { ...good, cart: { 'pizza:broto:sem:t0,t1:none:0': 1 } },
    { ...good, draft: { ...good.draft, sizeId: 'inexistente' } },
    { ...good, draft: { ...good.draft, edgeId: 'inexistente' } },
    { ...good, draft: { ...good.draft, flavorIds: ['bebidas0'] } },
    { ...good, draft: { ...good.draft, flavorIds: ['t0', 't0'] } },
    { ...good, draft: { ...good.draft, drinkId: 'lanches0' } },
    { ...good, draft: { ...good.draft, sauceQuantity: 11 } },
    { ...good, draft: { ...good.draft, flavorIds: 't0' } },
    { ...good, category: 'lanches' },
    ...[0, 6, 1.5].map(step => ({ ...good, step })),
  ]) {
    writeEnvelope(storage, state);
    assert.equal(loadOrderState(storage), null);
    assert.equal(saveOrderState(state, storage), false);
  }
});

test('não restaura etapas avançadas sem completar as escolhas anteriores', () => {
  const storage = memoryStorage();
  for (const state of [
    { cart: {}, draft: null, step: 2, category: 'tradicionais' },
    { cart: {}, draft: createPizzaDraft('broto'), step: 3, category: 'tradicionais' },
    { cart: {}, draft: { ...createPizzaDraft('broto'), edgeId: 'sem' }, step: 4, category: 'tradicionais' },
    { cart: {}, draft: { ...createPizzaDraft('broto'), edgeId: 'sem', flavorIds: ['t0'] }, step: 5, category: 'tradicionais' },
  ]) {
    writeEnvelope(storage, state);
    assert.equal(loadOrderState(storage), null);
    assert.equal(saveOrderState(state, storage), false);
  }
});

test('storage bloqueado ou sem espaço não interrompe o pedido', () => {
  const unavailable = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceededError'); } };
  assert.equal(loadOrderState(unavailable), null);
  assert.equal(saveOrderState(sampleState(), unavailable), false);
  assert.equal(loadOrderState(null), null);
  assert.equal(saveOrderState(sampleState(), null), false);
  assert.equal(loadOrderState(), null);
  assert.equal(saveOrderState(sampleState()), false);
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
    assert.equal(loadOrderState(), null);
    assert.equal(saveOrderState(sampleState()), false);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});

test('salva somente escolhas e quantidades, sem dados pessoais ou observações', () => {
  const storage = memoryStorage();
  const good = sampleState();
  const sensitive = { name: 'Maria Cliente', address: 'Rua particular 123', notes: 'Observações privadas', phone: '47999999999' };
  const input = { ...good, ...sensitive, customer: sensitive, draft: { ...good.draft, ...sensitive, customer: sensitive } };
  assert.equal(saveOrderState(input, storage), true);
  const saved = storage.getItem(KEY);
  for (const value of Object.values(sensitive)) assert.ok(!saved.includes(value));
  assert.deepEqual(loadOrderState(storage), good);
  writeEnvelope(storage, input);
  assert.deepEqual(loadOrderState(storage), good);
});
