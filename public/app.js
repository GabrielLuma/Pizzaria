import { menu, restaurant, pizzaSizes, pizzaEdges } from './menu.js';
import { changeQuantity, buildSummary, cartLines, cartTotal, money, isPizza } from './order.js';

let cart = {};
let category = 'tradicionais';
let summary = '';
const $ = selector => document.querySelector(selector);
const dialog = $('#cart-dialog');
const escape = value => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function renderMenu() {
  const search = normalize($('#search').value.trim());
  const items = menu.filter(item => item.category === category && normalize(`${item.name} ${item.description}`).includes(search));
  $('#result-count').textContent = `${items.length} opções para explorar`;
  $('#menu-grid').innerHTML = items.length ? items.map((item, i) => `<article class="menu-card"><div class="card-top"><span class="item-number">${String(i + 1).padStart(2, '0')}</span><span class="item-kind">${isPizza(item) ? 'PIZZA' : 'DA NOSSA COZINHA'}</span></div><h3>${escape(item.name)}</h3><p>${escape(item.description)}</p>${isPizza(item) ? `<label class="size-label">Tamanho<select data-size="${item.id}" aria-label="Tamanho de ${escape(item.name)}">${pizzaSizes.map(size => `<option value="${size.id}">${size.name} · ${size.diameter} cm · ${money(size.price + (item.surcharge || 0))}</option>`).join('')}</select></label><label class="size-label">Borda<select data-edge="${item.id}" aria-label="Borda de ${escape(item.name)}">${pizzaEdges.map(edge => `<option value="${edge.id}">${edge.name}${edge.price ? ' · + ' + money(edge.price) : ''}</option>`).join('')}</select></label>` : ''}<div class="card-bottom"><span>${isPizza(item) ? money(pizzaSizes[0].price + (item.surcharge || 0)) : money(item.price)}</span><button data-add="${item.id}" aria-label="Adicionar ${escape(item.name)} à seleção">+</button></div></article>`).join('') : '<p class="empty">Nenhuma opção encontrada nessa categoria. Tente outro nome ou ingrediente.</p>';
}
function renderCart() {
  const items = cartLines(cart);
  $('#cart-count').textContent = Object.values(cart).reduce((a, b) => a + b, 0);
  const total = cartTotal(cart);
  $('#cart-items').innerHTML = items.length ? items.map(line => `<div class="cart-item"><div><strong>${escape(line.item.name)}</strong><small>${line.size ? escape(line.size.name) + ' · ' + line.size.diameter + ' cm · ' + escape(line.edge.name) + ' · ' : ''}${money(line.price)} por unidade</small></div><div class="quantity"><button data-quantity="${line.key}" data-delta="-1" aria-label="Diminuir ${escape(line.item.name)}">−</button><span>${line.quantity}</span><button data-quantity="${line.key}" data-delta="1" aria-label="Aumentar ${escape(line.item.name)}">+</button></div></div>`).join('') + `<div class="cart-total"><strong>${total.estimated ? 'Total mínimo estimado' : 'Total dos itens'}</strong><strong>${money(total.cents)}</strong></div>${total.estimated ? '<p class="cart-info">Os valores das pizzas são mínimos. O preço final depende da confirmação dos sabores e adicionais.</p>' : ''}` : '<p class="empty">Sua seleção está vazia. Escolha seus itens no cardápio.</p>';
  $('#review-button').disabled = !items.length;
  $('#summary-panel').hidden = true;
  summary = '';
}
let toastTimer;
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 2500);
}
document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => {
  category = button.dataset.category;
  document.querySelectorAll('[data-category]').forEach(tab => { tab.classList.toggle('active', tab === button); tab.setAttribute('aria-pressed', String(tab === button)); });
  renderMenu();
}));
$('#search').addEventListener('input', renderMenu);
$('#menu-grid').addEventListener('change', event => {
  if (!event.target.matches('[data-size], [data-edge]')) return;
  const card = event.target.closest('.menu-card');
  const item = menu.find(item => item.id === card.querySelector('[data-add]').dataset.add);
  const size = pizzaSizes.find(size => size.id === card.querySelector('[data-size]').value);
  const edge = pizzaEdges.find(edge => edge.id === card.querySelector('[data-edge]').value);
  card.querySelector('.card-bottom > span').textContent = money(size.price + edge.price + (item.surcharge || 0));
});
$('#menu-grid').addEventListener('click', event => {
  const button = event.target.closest('[data-add]');
  if (!button) return;
  const item = menu.find(item => item.id === button.dataset.add);
  const size = isPizza(item) ? document.querySelector(`[data-size="${item.id}"]`).value : null;
  const edge = size ? document.querySelector(`[data-edge="${item.id}"]`).value : null;
  const key = size ? `${item.id}:${size}:${edge}` : item.id;
  cart = changeQuantity(cart, key, 1);
  renderCart();
  toast('Item adicionado à sua seleção');
});
$('#cart-items').addEventListener('click', event => {
  const button = event.target.closest('[data-quantity]');
  if (!button) return;
  cart = changeQuantity(cart, button.dataset.quantity, Number(button.dataset.delta));
  renderMenu(); renderCart();
});
$('#open-cart').addEventListener('click', () => { renderCart(); dialog.showModal(); });
$('#close-cart').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
$('#order-form').addEventListener('input', () => { $('#summary-panel').hidden = true; summary = ''; });
$('#order-form').addEventListener('submit', event => {
  event.preventDefault();
  const fields = new FormData(event.target);
  try {
    summary = buildSummary(cart, { name: fields.get('name'), notes: fields.get('notes') });
    $('#summary-text').textContent = summary;
    $('#summary-panel').hidden = false;
    $('#feedback').textContent = '';
    const link = $('#whatsapp-link');
    link.hidden = !restaurant.whatsappConfirmed;
    if (restaurant.whatsappConfirmed) link.href = `https://wa.me/${restaurant.whatsapp}?text=${encodeURIComponent(summary)}`;
    $('#whatsapp-status').textContent = restaurant.whatsappConfirmed ? 'Confira os itens e envie a solicitação para a pizzaria.' : 'O envio ficará disponível após a confirmação do número de atendimento. Por enquanto, você pode copiar o resumo ou usar o site atual de pedidos.';
    $('#summary-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) { $('#feedback').textContent = error.message; }
});
$('#copy-summary').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(summary); $('#feedback').textContent = 'Resumo copiado. Envie-o na conversa com a pizzaria.'; }
  catch { $('#feedback').textContent = 'Não foi possível copiar automaticamente. Selecione e copie o resumo acima.'; }
});
renderMenu(); renderCart();
