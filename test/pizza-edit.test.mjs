import test from 'node:test';
import assert from 'node:assert/strict';
import { createPizzaDraft, pizzaKey, quotePizza } from '../public/order.js';
import { resizePizzaDraft, pizzaDraftFromKey } from '../public/pizza-edit.js';

function completeDraft() {
  return { sizeId: 'grande', edgeId: 'catupiry', flavorIds: ['e1', 't0', 'e0', 'd0'], drinkId: 'bebidas2', sauceQuantity: 2 };
}

test('reduzir tamanho conserva os primeiros sabores e informa apenas os excedentes removidos', () => {
  const original = completeDraft();
  const medium = resizePizzaDraft(original, 'media');
  assert.deepEqual(medium.draft.flavorIds, ['e1', 't0']);
  assert.deepEqual(medium.removedFlavors, ['e0', 'd0']);
  assert.equal(medium.draft.sizeId, 'media');
  assert.equal(medium.draft.edgeId, 'catupiry');
  assert.equal(medium.draft.drinkId, 'bebidas2');
  assert.equal(medium.draft.sauceQuantity, 2);
  assert.equal(quotePizza(medium.draft).price, 11600);
  const small = resizePizzaDraft(original, 'pequena');
  assert.deepEqual(small.draft.flavorIds, ['e1', 't0']);
  assert.deepEqual(small.removedFlavors, ['e0', 'd0']);
  const broto = resizePizzaDraft(original, 'broto');
  assert.deepEqual(broto.draft.flavorIds, ['e1']);
  assert.deepEqual(broto.removedFlavors, ['t0', 'e0', 'd0']);
});

test('escolher o mesmo tamanho mantém todas as escolhas e gera uma lista independente', () => {
  const original = completeDraft();
  const result = resizePizzaDraft(original, 'grande');
  assert.deepEqual(result.draft, original);
  assert.deepEqual(result.removedFlavors, []);
  assert.notEqual(result.draft, original);
  assert.notEqual(result.draft.flavorIds, original.flavorIds);
});

test('redimensionar não altera a montagem original, inclusive quando ela está congelada', () => {
  const original = completeDraft();
  Object.freeze(original.flavorIds);
  Object.freeze(original);
  const result = resizePizzaDraft(original, 'broto');
  result.draft.flavorIds.push('t1');
  result.removedFlavors.pop();
  assert.deepEqual(original, completeDraft());
});

test('aumentar tamanho preserva sabores e aceita montagem parcial válida', () => {
  const original = { ...createPizzaDraft('broto'), edgeId: 'cheddar', flavorIds: ['t0'] };
  const result = resizePizzaDraft(original, 'extra');
  assert.deepEqual(result.draft, { ...original, sizeId: 'extra' });
  assert.deepEqual(result.removedFlavors, []);
  assert.notEqual(result.draft.flavorIds, original.flavorIds);
  const empty = resizePizzaDraft(createPizzaDraft('broto'), 'media');
  assert.deepEqual(empty.draft, createPizzaDraft('media'));
});

test('Kuat incluso vira sem refri ao sair do combo, mantendo bebidas adicionais escolhidas', () => {
  const combo = { ...completeDraft(), drinkId: 'kuat' };
  assert.equal(resizePizzaDraft(combo, 'media').draft.drinkId, 'none');
  assert.equal(resizePizzaDraft(combo, 'gigante').draft.drinkId, 'kuat');
  assert.equal(resizePizzaDraft(combo, 'grande').draft.drinkId, 'kuat');
  assert.equal(resizePizzaDraft(completeDraft(), 'broto').draft.drinkId, 'bebidas2');
  const noDrink = { ...createPizzaDraft('broto'), edgeId: 'sem', flavorIds: ['t0'], drinkId: 'none', sauceQuantity: 0 };
  assert.equal(resizePizzaDraft(noDrink, 'grande').draft.drinkId, 'none');
});

test('redimensionar rejeita tamanho desconhecido e montagem originalmente inválida', () => {
  assert.throws(() => resizePizzaDraft(completeDraft(), 'inexistente'), /inválido/);
  for (const change of [
    { sizeId: 'inexistente' },
    { flavorIds: ['t0', 't0'] },
    { flavorIds: ['bebidas0'] },
    { edgeId: 'inexistente' },
    { drinkId: 'lanches0' },
    { sauceQuantity: 11 },
  ]) assert.throws(() => resizePizzaDraft({ ...completeDraft(), ...change }, 'media'));
});

test('decodifica chave da pizza montada preservando borda, sabores, bebida e molhos', () => {
  const original = completeDraft();
  const key = pizzaKey(original);
  const restored = pizzaDraftFromKey(key);
  assert.deepEqual(restored, { ...original, flavorIds: [...original.flavorIds].sort() });
  assert.equal(pizzaKey(restored), key);
  assert.equal(quotePizza(restored).price, quotePizza(original).price);
  const combo = { ...original, drinkId: 'kuat', sauceQuantity: 0 };
  assert.deepEqual(pizzaDraftFromKey(pizzaKey(combo)), { ...combo, flavorIds: [...combo.flavorIds].sort() });
});

test('decodificação rejeita lanches, pizza legacy e chaves adulteradas ou incompletas', () => {
  for (const key of [
    null, 1, {}, '', 'lanches0', 'bebidas0', 't0:grande:sem',
    'pizza:broto:sem:t0,t1:none:0',
    'pizza:grande:sem:t0,t0:none:0',
    'pizza:media:sem:bebidas0:none:0',
    'pizza:media:sem:t0:kuat:0',
    'pizza:media:sem:t0:lanches0:0',
    'pizza:grande:sem:t0:none:11',
    'pizza:grande:sem:t0:none:-1',
    'pizza:grande:sem:t0:none:0:extra',
    'pizza:grande:sem:t0:none',
  ]) assert.throws(() => pizzaDraftFromKey(key));
});
