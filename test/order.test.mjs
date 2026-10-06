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

test('limites de sabores são 1, 2, 2, 4, 4 e 4', async () => {
  const { createPizzaDraft, toggleFlavor } = await import('../public/order.js');
  assert.deepEqual(pizzaSizes.map(size => size.maxFlavors), [1, 2, 2, 4, 4, 4]);
  for (const size of pizzaSizes) {
    let draft = createPizzaDraft(size.id);
    for (let i = 0; i < size.maxFlavors; i++) draft = toggleFlavor(draft, `t${i}`);
    assert.throws(() => toggleFlavor(draft, 't10'), /permite até/);
    assert.equal(toggleFlavor(draft, 't0').flavorIds.length, size.maxFlavors - 1);
  }
});
test('etapas exigem borda, sabores, opção de refrigerante e opção de molho', async () => {
  const { createPizzaDraft, canProceed, pizzaKey } = await import('../public/order.js');
  let draft = createPizzaDraft('broto');
  for (const step of [2, 3, 4, 5]) assert.equal(canProceed(draft, step), false);
  assert.throws(() => pizzaKey(draft), /Complete/);
  draft = { ...draft, edgeId: 'sem', flavorIds: ['t0'], drinkId: 'none', sauceQuantity: 0 };
  for (const step of [2, 3, 4, 5]) assert.equal(canProceed(draft, step), true);
  assert.equal(cartTotal({ [pizzaKey(draft)]: 1 }).cents, 2600);
});
test('quatro sabores, dois especiais, borda, refri adicional e molhos somam corretamente', async () => {
  const { pizzaKey, quotePizza } = await import('../public/order.js');
  const draft = { sizeId: 'grande', edgeId: 'catupiry', flavorIds: ['e0', 't0', 'e1', 'd0'], drinkId: 'bebidas2', sauceQuantity: 2 };
  const quote = quotePizza(draft);
  assert.equal(quote.price, 15500);
  assert.equal(quote.surcharge, 1000);
  assert.equal(quote.estimated, false);
  const key = pizzaKey(draft);
  assert.equal(pizzaKey({ ...draft, flavorIds: [...draft.flavorIds].reverse() }), key);
  assert.deepEqual(cartTotal({ [key]: 2 }), { cents: 31000, estimated: false });
  const text = buildSummary({ [key]: 1 }, { name: 'Cliente', notes: 'Bem assada', fulfillment: 'delivery', address: 'Rua das Flores, 100, Centro, Indaial' });
  for (const expected of ['Coração com Cebola', 'Coração', 'Alho e Óleo', 'Banana Nevada', 'Guaraná Kuat incluso + Coca-Cola 2 L', '2 × Maionese Caseira', '155,00', 'Bem assada', 'Rua das Flores, 100', 'Taxa não incluída']) assert.ok(text.includes(expected), expected);
  assert.match(text, /Pagamento: na entrega/);
});
test('sem refri adicional mantém Kuat incluso e o preço do combo', async () => {
  const { pizzaKey, quotePizza } = await import('../public/order.js');
  const draft = { sizeId: 'grande', edgeId: 'sem', flavorIds: ['t0', 't1'], drinkId: 'none', sauceQuantity: 0 };
  assert.equal(quotePizza(draft).price, 9900);
  const text = buildSummary({ [pizzaKey(draft)]: 1 }, { name: 'Cliente', notes: '' });
  assert.match(text, /Guaraná Kuat incluso · sem refri adicional/);
  assert.match(text, /Sem molho/);
});
test('chaves manipuladas não ultrapassam limites ou aceitam itens errados como sabor', async () => {
  const { pizzaKey } = await import('../public/order.js');
  const good = { sizeId: 'media', edgeId: 'sem', flavorIds: ['t0'], drinkId: 'none', sauceQuantity: 0 };
  for (const change of [{ flavorIds: ['t0', 't0'] }, { flavorIds: ['t0', 't1', 't2'] }, { flavorIds: ['bebidas0'] }, { drinkId: 'lanches0' }, { sauceQuantity: 11 }, { edgeId: 'inexistente' }]) assert.throws(() => pizzaKey({ ...good, ...change }));
  assert.throws(() => cartLines({ 'pizza:broto:sem:t0,t1:none:0': 1 }));
  assert.throws(() => cartLines({ 'pizza:grande:sem:t0:none:0:extra': 1 }));
});
test('entrega exige endereço e retirada não inclui endereço residual', () => {
  assert.throws(() => buildSummary({ lanches0: 1 }, { name: 'Cliente', notes: '', fulfillment: 'delivery', address: ' ' }), /endereço/);
  const text = buildSummary({ lanches0: 1 }, { name: 'Cliente', notes: '', fulfillment: 'pickup', address: 'Endereço anterior' });
  assert.match(text, /Modalidade: retirada/);
  assert.doesNotMatch(text, /Endereço anterior|Taxa/);
});
