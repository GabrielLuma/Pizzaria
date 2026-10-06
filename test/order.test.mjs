import test from 'node:test';
import assert from 'node:assert/strict';
import { menu, restaurant, pizzaSizes, pizzaEdges } from '../public/menu.js';
import { changeQuantity, buildSummary, cartTotal, cartLines } from '../public/order.js';

test('cardápio mantém os preços e tamanhos transcritos dos prints', () => {
  assert.equal(new Set(menu.map(item => item.id)).size, menu.length);
  assert.equal(menu.length, 114);
  assert.deepEqual(pizzaSizes.map(s => s.price), [2600, 5300, 6500, 9900, 12000, 13500]);
  assert.deepEqual(menu.filter(i => i.category === 'chinesa').map(i => i.price), [8000, 6000, 7000, 7000, 7000]);
  assert.equal(menu.find(i => i.name === 'X-Burguer').price, 1800);
  assert.equal(menu.find(i => i.name === 'Porção Mista').price, 19000);
  assert.equal(restaurant.whatsappConfirmed, true);
});
test('tamanhos do mesmo sabor são itens independentes e quantidades têm limites', () => {
  const before = { 't0:broto:sem': 1 };
  assert.deepEqual(changeQuantity(before, 't0:grande:sem', 1), { 't0:broto:sem': 1, 't0:grande:sem': 1 });
  assert.deepEqual(before, { 't0:broto:sem': 1 });
  assert.deepEqual(changeQuantity(before, 't0:broto:sem', -1), {});
  assert.deepEqual(changeQuantity({ 't0:broto:sem': 20 }, 't0:broto:sem', 1), { 't0:broto:sem': 20 });
  for (const key of ['t0', 't0:inexistente', 'inexistente', 'bebidas0:broto']) assert.throws(() => changeQuantity({}, key, 1), /inválido/);
  assert.throws(() => cartLines({ bebidas0: -1 }), /inválido/);
});
test('total soma pizza, bebida e molho usando centavos', () => {
  const cart = { 't0:media:sem': 2, bebidas0: 1, molhos0: 1 };
  assert.deepEqual(cartTotal(cart), { cents: 13900, estimated: false });
  const text = buildSummary(cart, { name: ' Maria ', notes: 'Sem cebola' });
  assert.match(text, /Cliente: Maria/);
  assert.match(text, /2 × Alho e Óleo — Média \(30 cm\)/);
  assert.match(text, /Total dos itens: R\$\s139,00/);
  assert.match(text, /Sem cebola/);
  assert.match(text, /não confirma o pedido/);
});
test('pedido somente com itens de valor fechado exibe total exato dos itens', () => {
  assert.deepEqual(cartTotal({ lanches0: 2, bebidas0: 1 }), { cents: 4100, estimated: false });
  const text = buildSummary({ lanches0: 2, bebidas0: 1 }, { name: 'Maria', notes: '' });
  assert.match(text, /SOLICITAÇÃO DE PEDIDO/);
  assert.match(text, /Total dos itens: R\$\s41,00/);
  assert.doesNotMatch(text, /estimado|a partir de/);
});
test('combo mantém Kuat no nome e não duplica cobrança de bebida', () => {
  const text = buildSummary({ 't0:grande:sem': 1 }, { name: 'Maria', notes: '' });
  assert.match(text, /Grande \+ Guaraná Kuat \(35 cm\)/);
  assert.equal(cartTotal({ 't0:grande:sem': 1 }).cents, 9900);
});
test('consulta vazia ou sem nome é rejeitada', () => {
  assert.throws(() => buildSummary({}, { name: 'Maria', notes: '' }), /pelo menos um/);
  assert.throws(() => buildSummary({ lanches0: 1 }, { name: '  ', notes: '' }), /seu nome/);
});

test('sabores especiais e bordas somam seus adicionais uma vez por pizza', () => {
  assert.deepEqual(pizzaEdges.map(edge => edge.price), [0, 2000, 2000, 2500, 2500]);
  assert.equal(cartTotal({ 'e0:grande:catupiry': 2 }).cents, 24800);
  assert.equal(cartTotal({ 'd0:media:chocolate': 1 }).cents, 9000);
  assert.equal(cartTotal({ 't0:media:cheddar': 1 }).cents, 8500);
  const text = buildSummary({ 'e0:grande:catupiry': 1 }, { name: 'Maria', notes: '' });
  assert.match(text, /Borda de Catupiry/);
  assert.match(text, /adicional especial R\$\s5,00/);
  assert.match(text, /Total dos itens: R\$\s124,00/);
  assert.throws(() => cartLines({ 'e0:grande:inexistente': 1 }), /inválido/);
});
