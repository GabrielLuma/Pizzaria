import { menu, restaurant, pizzaSizes, pizzaEdges } from './menu.js';
import { changeQuantity, buildSummary, cartLines, cartTotal, money, createPizzaDraft, toggleFlavor, canProceed, quotePizza, pizzaKey, sizeName, lineDetails } from './order.js';

let cart = {};
let section = 'pizzas';
let category = 'tradicionais';
let draft = null;
let step = 1;
let summary = '';
const $ = selector => document.querySelector(selector);
const dialog = $('#cart-dialog');
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const stepNames = ['Tamanho', 'Borda', 'Sabores', 'Refrigerante', 'Molhos'];
const optionCard = (name, description, value, group, checked) => `<label class="menu-card option-card"><input type="radio" name="${group}" value="${escape(value)}" data-choice="${group}" ${checked ? 'checked' : ''}><span><strong>${escape(name)}</strong><span>${escape(description)}</span></span></label>`;
function updateFlavorTabs() {
  document.querySelectorAll('[data-category]').forEach(tab => { tab.classList.toggle('active', tab.dataset.category === category); tab.setAttribute('aria-pressed', String(tab.dataset.category === category)); });
}
function focusStep() {
  const heading = $('#result-count');
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
  $('#pizza-builder').hidden ? heading.scrollIntoView({ block: 'start' }) : $('#pizza-builder').scrollIntoView({ block: 'start' });
}
function renderMenu() {
  const building = section === 'pizzas' && step > 1;
  $('#pizza-builder').hidden = !building;
  $('#builder-actions').hidden = !building;
  $('#search-label').hidden = section === 'pizzas' && step !== 3;
  $('#flavor-tabs').hidden = !building || step !== 3;
  $('#menu-grid').setAttribute('aria-label', section === 'pizzas' ? stepNames[step - 1] : 'Itens do cardápio');
  if (section !== 'pizzas') {
    const search = normalize($('#search').value.trim());
    const items = menu.filter(item => item.category === section && normalize(`${item.name} ${item.description}`).includes(search));
    $('#result-count').textContent = `${items.length} opções para explorar`;
    $('#menu-grid').innerHTML = items.length ? items.map((item, i) => `<article class="menu-card"><div class="card-top"><span class="item-number">${String(i + 1).padStart(2, '0')}</span><span class="item-kind">DA NOSSA COZINHA</span></div><h3>${escape(item.name)}</h3><p>${escape(item.description)}</p><div class="card-bottom"><span>${money(item.price)}</span><button data-add="${item.id}" aria-label="Adicionar ${escape(item.name)}">+</button></div></article>`).join('') : '<p class="empty">Nenhuma opção encontrada. Tente outro nome ou ingrediente.</p>';
    return;
  }
  if (step === 1) {
    $('#result-count').textContent = 'Passo 1 · Escolha o tamanho da sua pizza';
    $('#menu-grid').innerHTML = pizzaSizes.map((size, i) => `<article class="menu-card size-card"><div class="card-top"><span class="item-number">${String(i + 1).padStart(2, '0')}</span><span class="item-kind">${size.diameter} CM</span></div><h3>${escape(sizeName(size))}</h3><p>Até ${size.maxFlavors} ${size.maxFlavors === 1 ? 'sabor' : 'sabores'}${size.combo ? ' · Guaraná Kuat incluso no combo' : ''}. Depois, escolha a borda e os sabores.</p><div class="card-bottom"><span>A partir de ${money(size.price)}</span><button data-choose-size="${size.id}" aria-label="Escolher pizza ${escape(sizeName(size))}">Escolher →</button></div></article>`).join('');
    return;
  }
  const quote = quotePizza(draft);
  $('#pizza-progress').innerHTML = stepNames.map((name, i) => `<li class="${i + 1 === step ? 'current' : i + 1 < step ? 'complete' : ''}" ${i + 1 === step ? 'aria-current="step"' : ''}><span>${i + 1}</span>${i === 3 && quote.size.combo ? 'Refri adicional' : name}</li>`).join('');
  $('#builder-step-label').textContent = `PASSO ${step} · ${(step === 4 && quote.size.combo ? 'Refri adicional' : stepNames[step - 1]).toUpperCase()}`;
  $('#chosen-size').textContent = `${sizeName(quote.size)} · ${quote.size.diameter} cm`;
  $('#selected-flavors').hidden = step !== 3;
  $('#selected-flavors').innerHTML = draft.flavorIds.map(id => { const item = menu.find(item => item.id === id); return `<button data-remove-flavor="${id}" aria-label="Retirar ${escape(item.name)}">${escape(item.name)} ×</button>`; }).join('');
  const priceLabel = quote.estimated ? 'Subtotal conhecido' : 'Valor da seleção';
  $('#builder-price-label').textContent = priceLabel;
  $('#builder-price').textContent = money(quote.price);
  $('#builder-next').disabled = !canProceed(draft, step);
  $('#builder-next').textContent = step === 5 ? 'Adicionar ao pedido' : 'Continuar →';
  if (step === 2) {
    $('#builder-help').textContent = 'Escolha uma borda recheada ou a opção sem borda recheada.';
    $('#result-count').textContent = 'Borda da sua pizza';
    $('#menu-grid').innerHTML = pizzaEdges.map(edge => optionCard(edge.name, edge.price ? `+ ${money(edge.price)}` : 'Sem adicional', edge.id, 'edge', draft.edgeId === edge.id)).join('');
  } else if (step === 3) {
    $('#builder-help').textContent = `Selecione de 1 a ${quote.size.maxFlavors} ${quote.size.maxFlavors === 1 ? 'sabor' : 'sabores'}. Cada sabor especial acrescenta R$ 5,00. Você pode escolher menos que o limite.`;
    $('#result-count').textContent = `${draft.flavorIds.length} de ${quote.size.maxFlavors} sabores selecionados`;
    const search = normalize($('#search').value.trim());
    const items = menu.filter(item => item.category === category && normalize(`${item.name} ${item.description}`).includes(search));
    $('#menu-grid').innerHTML = items.length ? items.map(item => {
      const chosen = draft.flavorIds.includes(item.id);
      const atLimit = draft.flavorIds.length >= quote.size.maxFlavors;
      return `<article class="menu-card flavor-card ${chosen ? 'selected' : ''}"><h3>${escape(item.name)}</h3><p>${escape(item.description)}</p><div class="card-bottom"><span>${item.surcharge ? '+ ' + money(item.surcharge) : 'Sem adicional'}</span><button data-toggle-flavor="${item.id}" aria-pressed="${chosen}" ${atLimit && !chosen ? 'disabled' : ''} aria-label="${chosen ? 'Retirar' : 'Selecionar'} sabor ${escape(item.name)}">${chosen ? 'Selecionado ✓' : 'Selecionar'}</button></div></article>`;
    }).join('') : '<p class="empty">Nenhum sabor encontrado nesta categoria.</p>';
  } else if (step === 4) {
    $('#builder-help').textContent = quote.size.combo ? 'O Guaraná Kuat já está incluso no combo. Escolha um refri adicional ou continue sem refri adicional. O preço do combo permanece o mesmo.' : 'Escolha um refrigerante ou continue sem refrigerante.';
    $('#result-count').textContent = quote.size.combo ? 'Refri adicional' : 'Refrigerante para acompanhar';
    $('#menu-grid').innerHTML = optionCard(quote.size.combo ? 'Sem refri adicional' : 'Sem refrigerante', quote.size.combo ? 'Guaraná Kuat permanece incluso' : 'Sem adicional', 'none', 'drink', draft.drinkId === 'none')
      + menu.filter(item => item.category === 'bebidas').map(item => optionCard(item.name, `+ ${money(item.price)}`, item.id, 'drink', draft.drinkId === item.id)).join('');
  } else {
    const sauce = menu.find(item => item.id === 'molhos0');
    $('#builder-help').textContent = 'Finalize com molho ou escolha sem molho. Depois você poderá escrever observações e informar o endereço.';
    $('#result-count').textContent = 'Molhos para acompanhar';
    $('#menu-grid').innerHTML = optionCard('Sem molho', 'Sem adicional', 'none', 'sauce', draft.sauceQuantity === 0)
      + optionCard(sauce.name, `${money(sauce.price)} por unidade`, 'yes', 'sauce', draft.sauceQuantity > 0)
      + (draft.sauceQuantity > 0 ? `<label class="sauce-quantity">Quantidade de maionese<select id="sauce-quantity">${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}" ${draft.sauceQuantity === i + 1 ? 'selected' : ''}>${i + 1} ${i === 0 ? 'unidade' : 'unidades'} · ${money((i + 1) * sauce.price)}</option>`).join('')}</select></label>` : '');
  }
}
function invalidateSummary() {
  $('#summary-panel').hidden = true;
  $('#feedback').textContent = '';
  summary = '';
}
function renderCart() {
  const lines = cartLines(cart);
  const total = cartTotal(cart);
  $('#cart-count').textContent = Object.values(cart).reduce((a, b) => a + b, 0);
  $('#cart-items').innerHTML = lines.length ? lines.map((line, index) => `<div class="cart-item"><div><strong>${escape(line.item.name)}</strong>${lineDetails(line).map(detail => `<small>${escape(detail)}</small>`).join('')}<small>${money(line.price)} por unidade${line.estimated ? ' + adicional a confirmar' : ''}</small></div><div class="quantity"><button data-line="${index}" data-delta="-1" aria-label="Diminuir ${escape(line.item.name)}">−</button><span>${line.quantity}</span><button data-line="${index}" data-delta="1" aria-label="Aumentar ${escape(line.item.name)}">+</button></div></div>`).join('') + `<div class="cart-total"><strong>${total.estimated ? 'Subtotal conhecido' : 'Total dos itens'}</strong><strong>${money(total.cents)}</strong></div>` : '<p class="empty">Sua seleção está vazia. Monte sua pizza ou escolha outro item.</p>';
  $('#review-button').disabled = !lines.length;
  invalidateSummary();
}
let toastTimer;
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 2800);
}
document.querySelectorAll('[data-section]').forEach(button => button.addEventListener('click', () => {
  section = button.dataset.section;
  $('#search').value = '';
  document.querySelectorAll('[data-section]').forEach(tab => { tab.classList.toggle('active', tab === button); tab.setAttribute('aria-pressed', String(tab === button)); });
  renderMenu();
}));
document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => {
  category = button.dataset.category;
  $('#search').value = '';
  updateFlavorTabs(); renderMenu();
}));
$('#search').addEventListener('input', renderMenu);
$('#change-size').addEventListener('click', () => { draft = null; step = 1; $('#search').value = ''; renderMenu(); focusStep(); });
$('#builder-back').addEventListener('click', () => { step--; $('#search').value = ''; renderMenu(); focusStep(); });
$('#builder-next').addEventListener('click', () => {
  if (!canProceed(draft, step)) return;
  if (step < 5) { step++; $('#search').value = ''; renderMenu(); focusStep(); return; }
  cart = changeQuantity(cart, pizzaKey(draft), 1);
  draft = null; step = 1; category = 'tradicionais'; $('#search').value = '';
  updateFlavorTabs(); renderCart(); renderMenu(); focusStep();
  toast('Pizza completa adicionada ao pedido');
});
function changeFlavor(id) {
  try { draft = toggleFlavor(draft, id); renderMenu(); }
  catch (error) { toast(error.message); }
}
$('#selected-flavors').addEventListener('click', event => {
  const button = event.target.closest('[data-remove-flavor]');
  if (button) { changeFlavor(button.dataset.removeFlavor); $('#result-count').focus({ preventScroll: true }); }
});
$('#menu-grid').addEventListener('click', event => {
  const sizeButton = event.target.closest('[data-choose-size]');
  if (sizeButton) { draft = createPizzaDraft(sizeButton.dataset.chooseSize); step = 2; category = 'tradicionais'; updateFlavorTabs(); renderMenu(); focusStep(); return; }
  const flavorButton = event.target.closest('[data-toggle-flavor]');
  if (flavorButton) {
    const id = flavorButton.dataset.toggleFlavor;
    changeFlavor(id);
    document.querySelector(`[data-toggle-flavor="${id}"]`)?.focus({ preventScroll: true });
    return;
  }
  const addButton = event.target.closest('[data-add]');
  if (addButton) { cart = changeQuantity(cart, addButton.dataset.add, 1); renderCart(); toast('Item adicionado ao pedido'); }
});
$('#menu-grid').addEventListener('change', event => {
  const choice = event.target.dataset.choice;
  if (!choice && event.target.id !== 'sauce-quantity') return;
  if (choice === 'edge') draft = { ...draft, edgeId: event.target.value };
  if (choice === 'drink') draft = { ...draft, drinkId: event.target.value };
  if (choice === 'sauce') draft = { ...draft, sauceQuantity: event.target.value === 'none' ? 0 : draft.sauceQuantity || 1 };
  if (event.target.id === 'sauce-quantity') draft = { ...draft, sauceQuantity: Number(event.target.value) };
  const selector = choice ? `input[data-choice="${choice}"][value="${event.target.value}"]` : '#sauce-quantity';
  renderMenu(); $(selector)?.focus({ preventScroll: true });
});
$('#cart-items').addEventListener('click', event => {
  const button = event.target.closest('[data-line]');
  if (!button) return;
  const key = cartLines(cart)[Number(button.dataset.line)].key;
  cart = changeQuantity(cart, key, Number(button.dataset.delta));
  renderCart();
});
$('#open-cart').addEventListener('click', () => { renderCart(); dialog.showModal(); });
$('#close-cart').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
function updateDelivery() {
  const delivery = $('#order-form input[name="fulfillment"]:checked').value === 'delivery';
  $('#delivery-address').hidden = !delivery;
  $('#order-form textarea[name="address"]').required = delivery;
}
$('#order-form').addEventListener('input', () => { updateDelivery(); invalidateSummary(); });
$('#order-form').addEventListener('submit', event => {
  event.preventDefault();
  const fields = new FormData(event.target);
  try {
    summary = buildSummary(cart, { name: fields.get('name'), notes: fields.get('notes'), fulfillment: fields.get('fulfillment'), address: fields.get('address') });
    $('#summary-text').textContent = summary;
    $('#summary-panel').hidden = false;
    $('#feedback').textContent = '';
    const link = $('#whatsapp-link');
    link.hidden = !restaurant.whatsappConfirmed;
    if (restaurant.whatsappConfirmed) link.href = `https://wa.me/${restaurant.whatsapp}?text=${encodeURIComponent(summary)}`;
    $('#whatsapp-status').textContent = 'Confira o resumo e envie para a pizzaria. A entrega e o pedido dependem da confirmação do atendimento.';
    $('#summary-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) { $('#feedback').textContent = error.message; }
});
$('#copy-summary').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(summary); $('#feedback').textContent = 'Resumo copiado. Envie-o na conversa com a pizzaria.'; }
  catch { $('#feedback').textContent = 'Não foi possível copiar automaticamente. Selecione e copie o resumo acima.'; }
});
renderMenu(); renderCart(); updateDelivery();
