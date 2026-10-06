import { menu, pizzaSizes, pizzaEdges, pizzaRules } from './menu.js';
export const money = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export const isPizza = item => ['tradicionais', 'especiais', 'doces'].includes(item.category);
export const sizeName = size => size.name.replace(' + Guaraná Kuat', '');
const invalid = () => { throw new Error('Item inválido ou escolha inválida'); };

export function createPizzaDraft(sizeId) {
  if (!pizzaSizes.some(size => size.id === sizeId)) invalid();
  return { sizeId, edgeId: null, flavorIds: [], drinkId: null, sauceQuantity: null };
}
export function toggleFlavor(draft, flavorId) {
  const item = menu.find(item => item.id === flavorId);
  const size = pizzaSizes.find(size => size.id === draft.sizeId);
  if (!item || !isPizza(item) || !size) invalid();
  if (draft.flavorIds.includes(flavorId)) return { ...draft, flavorIds: draft.flavorIds.filter(id => id !== flavorId) };
  if (draft.flavorIds.length >= size.maxFlavors) throw new Error(`Esta pizza permite até ${size.maxFlavors} ${size.maxFlavors === 1 ? 'sabor' : 'sabores'}. Retire um sabor para trocar.`);
  return { ...draft, flavorIds: [...draft.flavorIds, flavorId] };
}
export function canProceed(draft, step) {
  if (!draft) return false;
  const size = pizzaSizes.find(size => size.id === draft.sizeId);
  if (!size) return false;
  if (step === 2) return pizzaEdges.some(edge => edge.id === draft.edgeId);
  if (step === 3) return draft.flavorIds.length > 0 && draft.flavorIds.length <= size.maxFlavors;
  if (step === 4) return draft.drinkId === 'none' || (draft.drinkId === 'kuat' && size.combo) || menu.some(item => item.id === draft.drinkId && item.category === 'bebidas');
  if (step === 5) return Number.isInteger(draft.sauceQuantity) && draft.sauceQuantity >= 0 && draft.sauceQuantity <= 10;
  return false;
}
export function quotePizza(draft) {
  const size = pizzaSizes.find(size => size.id === draft.sizeId);
  const edge = pizzaEdges.find(edge => edge.id === draft.edgeId);
  const flavors = draft.flavorIds.map(id => menu.find(item => item.id === id));
  if (!size || draft.flavorIds.length > size.maxFlavors || new Set(draft.flavorIds).size !== draft.flavorIds.length || flavors.some(item => !item || !isPizza(item))) invalid();
  if (draft.edgeId !== null && !edge) invalid();
  if (draft.drinkId !== null && !canProceed(draft, 4)) invalid();
  if (draft.sauceQuantity !== null && !canProceed(draft, 5)) invalid();
  const specialCount = flavors.filter(item => item.surcharge).length;
  let surcharge = 0;
  let estimated = false;
  if (specialCount) {
    if (flavors.length === 1 || pizzaRules.specialSurchargeMode === 'per-pizza') surcharge = 500;
    else if (pizzaRules.specialSurchargeMode === 'per-flavor') surcharge = specialCount * 500;
    else if (pizzaRules.specialSurchargeMode === 'proportional') surcharge = Math.round(500 * specialCount / flavors.length);
    else estimated = true;
  }
  const drink = menu.find(item => item.id === draft.drinkId && item.category === 'bebidas');
  const sauce = menu.find(item => item.id === 'molhos0');
  return {
    size, edge, flavors, drink, sauce, surcharge, estimated,
    price: size.price + (edge?.price || 0) + surcharge + (drink?.price || 0) + (draft.sauceQuantity || 0) * sauce.price,
    drinkLabel: draft.drinkId === 'none' ? (size.combo ? 'Guaraná Kuat incluso · sem refri adicional' : 'Sem refrigerante') : draft.drinkId === 'kuat' ? 'Guaraná Kuat incluso' : drink ? `${size.combo ? 'Guaraná Kuat incluso + ' : ''}${drink.name}` : 'A escolher',
  };
}
export function pizzaKey(draft) {
  if (![2, 3, 4, 5].every(step => canProceed(draft, step))) throw new Error('Complete a borda, os sabores, o refrigerante e os molhos.');
  quotePizza(draft);
  return ['pizza', draft.sizeId, draft.edgeId, [...draft.flavorIds].sort().join(','), draft.drinkId, draft.sauceQuantity].join(':');
}
export function cartLines(cart) {
  return Object.entries(cart).map(([key, quantity]) => {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) invalid();
    const parts = key.split(':');
    if (parts[0] === 'pizza') {
      if (parts.length !== 6 || !/^\d+$/.test(parts[5])) invalid();
      const draft = { sizeId: parts[1], edgeId: parts[2], flavorIds: parts[3].split(','), drinkId: parts[4], sauceQuantity: Number(parts[5]) };
      if (![2, 3, 4, 5].every(step => canProceed(draft, step))) invalid();
      const quote = quotePizza(draft);
      return { key, quantity, ...quote, sauceQuantity: draft.sauceQuantity, item: { name: `Pizza ${sizeName(quote.size)}` } };
    }
    const [id, sizeId, edgeId, extra] = parts;
    const item = menu.find(item => item.id === id);
    const size = pizzaSizes.find(size => size.id === sizeId);
    const edge = pizzaEdges.find(edge => edge.id === edgeId);
    if (!item || extra !== undefined || (isPizza(item) ? !size || !edge : parts.length !== 1)) invalid();
    return { key, quantity, item, size, edge, flavors: size ? [item] : [], price: size ? size.price + edge.price + (item.surcharge || 0) : item.price, estimated: false };
  });
}
export function changeQuantity(cart, key, delta) {
  cartLines({ [key]: 1 });
  if (!Number.isInteger(delta)) throw new Error('Quantidade inválida');
  const next = { ...cart };
  const quantity = Math.max(0, Math.min(20, (next[key] || 0) + delta));
  if (quantity) next[key] = quantity;
  else delete next[key];
  return next;
}
export function cartTotal(cart) {
  const lines = cartLines(cart);
  return { cents: lines.reduce((total, line) => total + line.quantity * line.price, 0), estimated: lines.some(line => line.estimated) };
}
export function lineDetails(line) {
  if (!line.size) return [];
  if (!line.key.startsWith('pizza:')) return [`${line.size.name} (${line.size.diameter} cm), ${line.edge.name}${line.item.surcharge ? ', adicional especial ' + money(line.item.surcharge) : ''}`];
  return [
    `${line.size.diameter} cm · ${line.edge.name}`,
    `Sabores: ${line.flavors.map(item => item.name).join(' / ')}`,
    `Refrigerante: ${line.drinkLabel}`,
    `Molhos: ${line.sauceQuantity ? `${line.sauceQuantity} × ${line.sauce.name}` : 'Sem molho'}`,
    ...(line.surcharge ? [`Adicional especial: ${money(line.surcharge)}`] : []),
    ...(line.estimated ? ['Adicional de sabores especiais combinados: a confirmar'] : []),
  ];
}
export function buildSummary(cart, customer) {
  const lines = cartLines(cart);
  if (!lines.length) throw new Error('Escolha pelo menos um item.');
  if (!customer.name.trim()) throw new Error('Informe seu nome.');
  const total = cartTotal(cart);
  const delivery = customer.fulfillment === 'delivery';
  const address = (customer.address || '').trim();
  if (delivery && !address) throw new Error('Informe o endereço para consultar a entrega.');
  return [
    `${total.estimated || delivery ? 'SOLICITAÇÃO A CONFIRMAR' : 'SOLICITAÇÃO DE PEDIDO'} — Pizzaria Luna Luna`,
    `Cliente: ${customer.name.trim()}`, '',
    ...lines.flatMap(line => [`${line.quantity} × ${line.item.name}${!line.key.startsWith('pizza:') && line.size ? ' — ' + lineDetails(line)[0] : ''}: ${money(line.quantity * line.price)}${line.estimated ? ' + adicional a confirmar' : ''}`, ...(line.key.startsWith('pizza:') ? lineDetails(line).map(detail => '  ' + detail) : []), '']),
    `${total.estimated ? 'Subtotal conhecido' : 'Total dos itens'}: ${money(total.cents)}`,
    ...(total.estimated ? ['O adicional dos sabores especiais combinados não está incluído: confirmar com a pizzaria antes de fechar o valor.'] : []),
    ...(customer.notes?.trim() ? [`Observações: ${customer.notes.trim()}`] : []),
    '', `Modalidade: ${delivery ? 'entrega a confirmar' : 'retirada'}`,
    `Pagamento: na ${delivery ? 'entrega' : 'retirada'}`,
    ...(delivery ? [`Endereço solicitado: ${address}`, 'Área atendida e taxa de entrega: confirmar com a pizzaria. Taxa não incluída no total dos itens.'] : []),
    '', 'Aguarde a confirmação de disponibilidade e aceite da pizzaria. Esta mensagem não confirma o pedido.',
  ].join('\n');
}
