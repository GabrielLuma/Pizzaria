import { menu, pizzaSizes, pizzaEdges } from './menu.js';
export const money = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export const isPizza = item => ['tradicionais', 'especiais', 'doces'].includes(item.category);
export function cartLines(cart) {
  return Object.entries(cart).map(([key, quantity]) => {
    const [id, sizeId, edgeId, extra] = key.split(':');
    const item = menu.find(item => item.id === id);
    const size = pizzaSizes.find(size => size.id === sizeId);
    const edge = pizzaEdges.find(edge => edge.id === edgeId);
    if (!item || !Number.isInteger(quantity) || quantity < 1 || quantity > 20 || extra !== undefined || (isPizza(item) ? !size || !edge : Boolean(sizeId || edgeId))) throw new Error('Item ou tamanho inválido');
    return { key, quantity, item, size, edge, price: size ? size.price + edge.price + (item.surcharge || 0) : item.price, estimated: false };
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
export function buildSummary(cart, customer) {
  const lines = cartLines(cart);
  if (!lines.length) throw new Error('Escolha pelo menos um item.');
  if (!customer.name.trim()) throw new Error('Informe seu nome.');
  const total = cartTotal(cart);
  return [
    `${total.estimated ? 'CONSULTA DE ORÇAMENTO' : 'SOLICITAÇÃO DE PEDIDO'} — Pizzaria Luna Luna`,
    `Cliente: ${customer.name.trim()}`, 'Modalidade: retirada', 'Pagamento: na retirada', '',
    ...lines.map(line => `${line.quantity} × ${line.item.name}${line.size ? ` — ${line.size.name} (${line.size.diameter} cm), ${line.edge.name}${line.item.surcharge ? ', adicional especial ' + money(line.item.surcharge) : ''}` : ''}: ${line.estimated ? 'a partir de ' : ''}${money(line.quantity * line.price)}`),
    '', `${total.estimated ? 'Total mínimo estimado' : 'Total dos itens'}: ${money(total.cents)}`,
    ...(total.estimated ? ['Pizzas: valores a partir de. Adicionais e regras de sabores precisam ser confirmados pela pizzaria.'] : []),
    ...(customer.notes.trim() ? [`Observações: ${customer.notes.trim()}`] : []),
    '', 'Aguarde a confirmação de disponibilidade e aceite da pizzaria. Esta mensagem não confirma o pedido.',
  ].join('\n');
}
