import { menu, restaurant, pizzaSizes, pizzaEdges } from './menu.js';
import { changeQuantity, buildSummary, cartLines, cartTotal, money, createPizzaDraft, toggleFlavor, canProceed, quotePizza, pizzaKey, sizeName, lineDetails } from './order.js';
import { loadOrderState, saveOrderState } from './state.js';
import { resizePizzaDraft, pizzaDraftFromKey } from './pizza-edit.js';

const restored = loadOrderState();
let cart = restored?.cart || {};
let draft = restored?.draft || null;
let step = restored?.step || 1;
let category = restored?.category || 'todos';
let section = 'pizzas';
let summary = '';
let editingKey = null;
let suspended = null;
let undoRemoved = null;
let toastTimer;
const $ = selector => document.querySelector(selector);
const dialog = $('#cart-dialog');
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const steps = ['Tamanho', 'Borda', 'Sabores', 'Refri', 'Molhos'];
const titles = ['Qual vai ser o tamanho?', 'Uma borda para completar.', 'Escolha seus sabores.', 'Algo para acompanhar?', 'O último toque.'];
const nextLabels = ['Escolher borda', 'Escolher sabores', 'Escolher refrigerante', 'Escolher molhos', 'Adicionar ao pedido'];
const productById = new Map(menu.map(item => [item.id, item]));
function persist() {
  saveOrderState({ cart, draft: editingKey ? suspended?.draft || null : draft, step: editingKey ? suspended?.step || 1 : step, category: editingKey ? suspended?.category || 'todos' : category });
}
function toast(message, undo = false) {
  if (dialog.open) dialog.insertBefore($('#toast'), $('#cart-items'));
  else document.body.append($('#toast'));
  $('#toast-text').textContent = message;
  $('#undo-remove').hidden = !undo;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), undo ? 6500 : 3000);
}
function setMessage(message = '') {
  $('#builder-message').textContent = message;
  $('#builder-message').hidden = !message;
}
function invalidateSummary() {
  $('#summary-panel').hidden = true;
  $('#feedback').textContent = '';
  summary = '';
}
function canNavigate(target) {
  if (target === 1) return true;
  return Boolean(draft) && Array.from({ length: Math.max(0, target - 2) }, (_, i) => i + 2).every(previous => canProceed(draft, previous));
}
function focusStep() {
  $('#wizard-step-title').focus({ preventScroll: true });
  const top = $('#order-workspace').getBoundingClientRect().top;
  const headerHeight = $('.header').getBoundingClientRect().height;
  if (top < headerHeight - 5 || top > innerHeight * .4) {
    window.scrollTo({ top: window.scrollY + top - headerHeight - 15, behavior: 'instant' });
  }
}
function updateCategoryButtons() {
  document.querySelectorAll('[data-category]').forEach(button => {
    button.classList.toggle('active', button.dataset.category === category);
    button.setAttribute('aria-pressed', String(button.dataset.category === category));
  });
}
function updateSectionButtons() {
  document.querySelectorAll('[data-section]').forEach(button => {
    button.classList.toggle('active', button.dataset.section === section);
    button.setAttribute('aria-pressed', String(button.dataset.section === section));
  });
}
function updateProgress() {
  document.querySelectorAll('[data-go-step]').forEach(button => {
    const target = Number(button.dataset.goStep);
    const li = button.parentElement;
    li.classList.toggle('current', target === step);
    li.classList.toggle('complete', target < step);
    button.disabled = !canNavigate(target);
    if (target === step) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
}
function updateBuilder() {
  $('#cancel-edit').hidden = !editingKey;
  updateProgress();
  const selected = draft && quotePizza(draft);
  $('#chosen-size').textContent = selected ? sizeName(selected.size) : 'Vamos começar?';
  $('#summary-size').textContent = selected ? `Pizza ${sizeName(selected.size)}` : 'Uma pizza do seu jeito.';
  $('#summary-capacity').textContent = selected ? `${selected.size.diameter} cm · até ${selected.size.maxFlavors} ${selected.size.maxFlavors === 1 ? 'sabor' : 'sabores'}` : 'Escolha um tamanho para começar.';
  $('#builder-price').textContent = selected ? money(selected.price) : '—';
  $('#builder-price-label').textContent = editingKey ? 'Valor por pizza' : 'Valor da pizza';
  $('#builder-back').hidden = step === 1;
  $('#builder-next').disabled = step === 1 ? !draft : !canProceed(draft, step);
  $('#builder-next').innerHTML = `${step === 5 && editingKey ? 'Salvar alteração' : nextLabels[step - 1]} ${icon(step === 5 ? 'check' : 'arrow')}`;
  $('#builder-cart-link').hidden = !Object.keys(cart).length;
  $('#builder-cart-link').textContent = `Ver pedido · ${Object.values(cart).reduce((a, b) => a + b, 0)}`;
  $('#action-help').textContent = step === 1 ? draft ? 'Tamanho escolhido. Vamos para a borda.' : 'Selecione um tamanho para continuar.' : step === 3 ? !draft.flavorIds.length ? 'Escolha pelo menos um sabor.' : draft.flavorIds.length >= selected.size.maxFlavors ? 'Limite atingido. Retire um sabor para trocar.' : 'Você pode continuar com os sabores escolhidos.' : step === 5 ? 'Depois, preencha observações e entrega.' : 'Sua escolha pode ser alterada a qualquer momento.';
  if (!selected) {
    $('#draft-summary').innerHTML = '<p class="cart-info">Seu tamanho, sabores e acompanhamentos aparecerão aqui.</p>';
    $('#price-breakdown').innerHTML = '';
    return;
  }
  const summaryRow = (label, text, target, chosen = true) => `<div class="summary-row"><span>${label}</span><button data-summary-step="${target}" class="${chosen ? '' : 'not-chosen'}" ${!canNavigate(target) ? 'disabled' : ''}>${escape(text)}</button></div>`;
  $('#draft-summary').innerHTML = summaryRow('Tamanho', `${sizeName(selected.size)} · ${selected.size.diameter} cm`, 1)
    + summaryRow('Borda', selected.edge?.name.replace('Borda de ', '') || 'A escolher', 2, !!selected.edge)
    + summaryRow('Sabores', selected.flavors.length ? selected.flavors.map(item => item.name).join(' / ') : 'A escolher', 3, !!selected.flavors.length)
    + summaryRow(selected.size.combo ? 'Refri adicional' : 'Refrigerante', draft.drinkId === 'none' ? 'Sem adicional' : selected.drink?.name || 'Sem adicional', 4)
    + (selected.size.combo ? '<span class="included-tag">Guaraná Kuat incluso no combo</span>' : '')
    + summaryRow('Molhos', draft.sauceQuantity ? `${draft.sauceQuantity} × Maionese` : 'Sem molho', 5);
  const costRow = (label, cents) => `<div class="summary-row"><span>${label}</span><span>${money(cents)}</span></div>`;
  $('#price-breakdown').innerHTML = costRow('Pizza', selected.size.price)
    + (selected.edge?.price ? costRow('Borda recheada', selected.edge.price) : '')
    + (selected.surcharge ? costRow('Sabores especiais', selected.surcharge) : '')
    + (selected.drink ? costRow('Refrigerante adicional', selected.drink.price) : '')
    + (draft.sauceQuantity ? costRow('Molhos', draft.sauceQuantity * selected.sauce.price) : '');
  if (step === 3 && section === 'pizzas') updateFlavorSelection();
}
function updateFlavorSelection() {
  const max = pizzaSizes.find(size => size.id === draft.sizeId).maxFlavors;
  const count = draft.flavorIds.length;
  $('#result-count').textContent = `${count} de ${max} ${max === 1 ? 'sabor escolhido' : 'sabores escolhidos'}`;
  $('#selected-flavors').innerHTML = draft.flavorIds.map(id => `<button data-remove-flavor="${id}" aria-label="Retirar ${escape(productById.get(id).name)}">${escape(productById.get(id).name)} ${icon('close')}</button>`).join('')
    + Array.from({ length: max - count }, (_, i) => `<span class="flavor-slot">${count + i + 1}º sabor</span>`).join('');
  document.querySelectorAll('[data-toggle-flavor]').forEach(button => {
    const selected = draft.flavorIds.includes(button.dataset.toggleFlavor);
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.setAttribute('aria-label', `${selected ? 'Retirar' : 'Selecionar'} sabor ${productById.get(button.dataset.toggleFlavor).name}`);
    button.querySelector('use').setAttribute('href', `#i-${selected ? 'check' : 'plus'}`);
  });
}
function renderFlavorList() {
  const search = normalize($('#search').value.trim());
  const items = menu.filter(item => ['tradicionais', 'especiais', 'doces'].includes(item.category) && (search || category === 'todos' || item.category === category) && normalize(`${item.name} ${item.description}`).includes(search));
  $('#menu-grid').innerHTML = items.length ? items.map(item => `<button type="button" class="flavor-card" data-toggle-flavor="${item.id}" aria-pressed="false"><span class="flavor-text"><span class="flavor-title">${escape(item.name)}${item.surcharge ? '<span class="special-tag">+ R$ 5</span>' : ''}</span><span class="flavor-description">${escape(item.description)}</span></span><span class="flavor-check">${icon('plus')}</span></button>`).join('') : '<p class="empty">Nenhum sabor encontrado. Tente outro nome ou ingrediente.</p>';
  $('#menu-grid').scrollTop = 0;
  $('#list-hint').textContent = `${items.length} sabores no cardápio`;
  updateFlavorSelection();
}
function optionCard(name, description, value, group, checked) {
  return `<label class="option-card"><input type="radio" name="pizza-${group}" value="${escape(value)}" data-choice="${group}" ${checked ? 'checked' : ''}><span><strong>${escape(name)}</strong><span>${escape(description)}</span></span></label>`;
}
function renderCatalog() {
  const search = normalize($('#search').value.trim());
  const items = menu.filter(item => item.category === section && normalize(`${item.name} ${item.description}`).includes(search));
  $('#result-count').textContent = `${items.length} opções`;
  $('#list-hint').textContent = '';
  $('#menu-grid').innerHTML = items.length ? items.map(item => `<article class="product-card"><h3>${escape(item.name)}</h3><p>${escape(item.description)}</p><div class="product-bottom"><span>${money(item.price)}</span><button data-add="${item.id}" aria-label="Adicionar ${escape(item.name)}">${icon('plus')}</button></div></article>`).join('') : '<p class="empty">Nenhum item encontrado. Tente outro nome ou ingrediente.</p>';
}
function renderStage() {
  const pizza = section === 'pizzas';
  $('#order-workspace').classList.toggle('catalog-mode', !pizza);
  $('#pizza-builder').hidden = !pizza;
  $('#order-aside').hidden = !pizza;
  $('#search-label').hidden = pizza && step !== 3;
  $('#flavor-tabs').hidden = !pizza || step !== 3;
  $('#selected-flavors').hidden = !pizza || step !== 3;
  $('#sauce-controls').hidden = !pizza || step !== 5 || !draft?.sauceQuantity;
  $('#menu-grid').dataset.step = pizza ? step : 'catalog';
  $('#menu-grid').setAttribute('aria-label', pizza ? steps[step - 1] : 'Itens do cardápio');
  if (!pizza) { renderCatalog(); return; }
  $('#builder-step-label').textContent = `${editingKey ? 'EDITANDO SUA PIZZA · ' : ''}ETAPA ${step} DE 5`;
  $('#wizard-step-title').textContent = step === 4 && draft && quotePizza(draft).size.combo ? 'Refri adicional.' : titles[step - 1];
  $('#result-count').textContent = '';
  $('#list-hint').textContent = '';
  const selected = draft && quotePizza(draft);
  if (step === 1) {
    $('#builder-help').textContent = 'Toque no tamanho que você quer. Depois, continue para escolher a borda.';
    $('#menu-grid').innerHTML = pizzaSizes.map(size => `<button type="button" class="size-card ${draft?.sizeId === size.id ? 'selected' : ''}" data-choose-size="${size.id}" aria-pressed="${draft?.sizeId === size.id}" aria-label="Escolher pizza ${escape(sizeName(size))}"><span class="size-top"><span class="size-disc" style="--diameter:${26 + size.diameter * .5}px"></span><span class="size-check">${icon('check')}</span></span><strong>${escape(sizeName(size))}</strong><span class="size-meta">${size.diameter} cm · até ${size.maxFlavors} ${size.maxFlavors === 1 ? 'sabor' : 'sabores'}</span><span class="size-price"><small>a partir de</small>${money(size.price)}</span>${size.combo ? '<span class="combo-tag">Kuat incluso</span>' : ''}</button>`).join('');
  } else if (step === 2) {
    $('#builder-help').textContent = 'Sem borda recheada já está selecionado. Se preferir, acrescente seu recheio favorito.';
    $('#menu-grid').innerHTML = pizzaEdges.map(edge => optionCard(edge.name, edge.price ? `+ ${money(edge.price)}` : 'Sem custo adicional', edge.id, 'edge', draft.edgeId === edge.id)).join('');
  } else if (step === 3) {
    $('#builder-help').textContent = selected.size.maxFlavors === 1 ? 'Escolha um sabor. Para trocar, toque em outro. Especiais acrescentam R$ 5.' : `Combine até ${selected.size.maxFlavors} sabores. Você pode escolher menos. Cada especial acrescenta R$ 5.`;
    renderFlavorList();
  } else if (step === 4) {
    $('#builder-help').textContent = selected.size.combo ? 'O Guaraná Kuat já está incluso. Quer outro refrigerante para acompanhar?' : 'Escolha um refrigerante ou continue sem. Você decide.';
    $('#menu-grid').innerHTML = optionCard(selected.size.combo ? 'Sem refri adicional' : 'Sem refrigerante', selected.size.combo ? 'Guaraná Kuat continua incluso' : 'Continuar só com a pizza', 'none', 'drink', draft.drinkId === 'none')
      + menu.filter(item => item.category === 'bebidas').map(item => optionCard(item.name, `+ ${money(item.price)}`, item.id, 'drink', draft.drinkId === item.id)).join('');
  } else {
    $('#builder-help').textContent = 'Um molho para acompanhar? Se preferir, continue sem molho.';
    const sauce = productById.get('molhos0');
    $('#menu-grid').innerHTML = optionCard('Sem molho', 'Sem custo adicional', 'none', 'sauce', draft.sauceQuantity === 0)
      + optionCard(sauce.name, `${money(sauce.price)} por unidade`, 'yes', 'sauce', draft.sauceQuantity > 0);
    $('#sauce-quantity').innerHTML = Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}" ${draft.sauceQuantity === i + 1 ? 'selected' : ''}>${i + 1} ${i === 0 ? 'unidade' : 'unidades'} · ${money((i + 1) * sauce.price)}</option>`).join('');
  }
  updateBuilder();
}
function goStep(target) {
  if (!canNavigate(target)) return;
  step = target;
  $('#search').value = '';
  setMessage();
  renderStage(); persist(); focusStep();
}
function openCart() {
  renderCart();
  if (!dialog.open) dialog.showModal();
  document.body.classList.add('dialog-open');
}
function renderCart() {
  const lines = cartLines(cart);
  const total = cartTotal(cart);
  $('#cart-count').textContent = Object.values(cart).reduce((a, b) => a + b, 0);
  $('#cart-items').innerHTML = lines.length ? lines.map((line, index) => `<div class="cart-item"><div class="cart-item-head"><strong>${escape(line.item.name)}</strong><span>${money(line.price * line.quantity)}</span></div>${lineDetails(line).map(detail => `<small>${escape(detail)}</small>`).join('')}<div class="cart-item-bottom"><div class="cart-item-links">${line.key.startsWith('pizza:') ? `<button data-edit-line="${index}">${icon('edit')}Editar</button>` : ''}<button data-remove-line="${index}" aria-label="Remover ${escape(line.item.name)}">${icon('close')}Remover</button></div><div class="quantity"><button data-line="${index}" data-delta="-1" aria-label="Diminuir ${escape(line.item.name)}">−</button><span>${line.quantity}</span><button data-line="${index}" data-delta="1" ${line.quantity >= 20 ? 'disabled title="Máximo de 20 unidades"' : ''} aria-label="Aumentar ${escape(line.item.name)}">+</button></div></div></div>`).join('') + `<div class="cart-total"><strong>Total dos itens</strong><strong>${money(total.cents)}</strong></div>` : `<p class="empty">Seu pedido está esperando o primeiro sabor. Monte uma pizza para começar.</p>`;
  $('#review-button').disabled = !lines.length;
  $('#cart-continue').textContent = lines.length ? 'Adicionar outra pizza ou acompanhamento' : 'Montar minha primeira pizza';
  if (section === 'pizzas') updateBuilder();
}
function editLine(key) {
  suspended = { draft: draft ? structuredClone(draft) : null, step, category };
  editingKey = key;
  draft = pizzaDraftFromKey(key);
  category = 'todos'; step = 3; section = 'pizzas';
  dialog.close();
  updateSectionButtons(); updateCategoryButtons();
  $('#search').value = '';
  setMessage('Edite sua pizza pelas etapas acima. O pedido só muda quando você salvar.');
  renderStage(); focusStep();
}
function finishPizza() {
  const key = pizzaKey(draft);
  if (editingKey) {
    const amount = cart[editingKey];
    const combined = (key === editingKey ? 0 : cart[key] || 0) + amount;
    if (combined > 20) { toast('Essa combinação ultrapassa 20 unidades. Ajuste a quantidade no pedido.'); return; }
    const next = { ...cart };
    delete next[editingKey];
    next[key] = combined;
    cart = next;
  } else {
    if ((cart[key] || 0) >= 20) { toast('Essa pizza já tem 20 unidades no pedido.'); return; }
    cart = changeQuantity(cart, key, 1);
  }
  const edited = Boolean(editingKey);
  editingKey = null; suspended = null; draft = null; step = 1; category = 'todos';
  $('#search').value = '';
  updateCategoryButtons(); setMessage(); invalidateSummary(); renderStage(); persist();
  openCart();
  toast(edited ? 'Pizza atualizada no seu pedido.' : 'Sua pizza foi adicionada ao pedido.');
}
function selectFlavor(id) {
  const max = pizzaSizes.find(size => size.id === draft.sizeId).maxFlavors;
  try {
    if (max === 1 && draft.flavorIds.length && !draft.flavorIds.includes(id)) draft = { ...draft, flavorIds: [id] };
    else draft = toggleFlavor(draft, id);
    setMessage(); updateBuilder(); persist();
  } catch (error) { setMessage(error.message); toast(error.message); }
}
$('#pizza-progress').innerHTML = steps.map((label, i) => `<li><button type="button" data-go-step="${i + 1}"><span>${i + 1}</span>${label}</button></li>`).join('');
$('#summary-details').open = innerWidth > 800;
document.querySelectorAll('[data-section]').forEach(button => button.addEventListener('click', () => {
  section = button.dataset.section;
  $('#search').value = '';
  updateSectionButtons(); renderStage();
}));
document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => {
  category = button.dataset.category;
  $('#search').value = '';
  updateCategoryButtons(); renderFlavorList(); persist();
}));
$('#search').addEventListener('input', () => section === 'pizzas' ? renderFlavorList() : renderCatalog());
$('#builder-next').addEventListener('click', () => {
  if (step === 1 ? !draft : !canProceed(draft, step)) return;
  if (step === 5) finishPizza();
  else goStep(step + 1);
});
$('#builder-back').addEventListener('click', () => goStep(step - 1));
$('#pizza-progress').addEventListener('click', event => { const button = event.target.closest('[data-go-step]'); if (button) goStep(Number(button.dataset.goStep)); });
$('#draft-summary').addEventListener('click', event => { const button = event.target.closest('[data-summary-step]'); if (button) goStep(Number(button.dataset.summaryStep)); });
$('#cancel-edit').addEventListener('click', () => {
  draft = suspended?.draft || null; step = suspended?.step || 1; category = suspended?.category || 'todos';
  editingKey = null; suspended = null;
  updateCategoryButtons(); setMessage(); renderStage(); persist(); openCart();
});
$('#selected-flavors').addEventListener('click', event => {
  const button = event.target.closest('[data-remove-flavor]');
  if (!button) return;
  const focusAfter = event.detail === 0;
  selectFlavor(button.dataset.removeFlavor);
  if (focusAfter) $('#search').focus({ preventScroll: true });
});
$('#menu-grid').addEventListener('click', event => {
  const sizeButton = event.target.closest('[data-choose-size]');
  if (sizeButton) {
    if (draft) {
      const result = resizePizzaDraft(draft, sizeButton.dataset.chooseSize);
      draft = result.draft;
      setMessage(result.removedFlavors.length ? `Esse tamanho permite ${draft.flavorIds.length} sabores. Mantivemos os primeiros; retiramos ${result.removedFlavors.map(id => productById.get(id).name).join(', ')}. Você pode trocar os sabores na etapa 3.` : '');
    } else draft = { ...createPizzaDraft(sizeButton.dataset.chooseSize), edgeId: 'sem', drinkId: 'none', sauceQuantity: 0 };
    document.querySelectorAll('[data-choose-size]').forEach(button => { button.classList.toggle('selected', button.dataset.chooseSize === draft.sizeId); button.setAttribute('aria-pressed', String(button.dataset.chooseSize === draft.sizeId)); });
    updateBuilder(); persist();
    return;
  }
  const flavorButton = event.target.closest('[data-toggle-flavor]');
  if (flavorButton) { selectFlavor(flavorButton.dataset.toggleFlavor); return; }
  const addButton = event.target.closest('[data-add]');
  if (addButton) {
    const id = addButton.dataset.add;
    if ((cart[id] || 0) >= 20) { toast('Máximo de 20 unidades deste item.'); return; }
    cart = changeQuantity(cart, id, 1);
    invalidateSummary(); renderCart(); persist(); toast('Item adicionado ao pedido.');
  }
});
$('#menu-grid').addEventListener('change', event => {
  const choice = event.target.dataset.choice;
  if (!choice) return;
  if (choice === 'edge') draft = { ...draft, edgeId: event.target.value };
  if (choice === 'drink') draft = { ...draft, drinkId: event.target.value };
  if (choice === 'sauce') {
    draft = { ...draft, sauceQuantity: event.target.value === 'none' ? 0 : draft.sauceQuantity || 1 };
    $('#sauce-controls').hidden = !draft.sauceQuantity;
    if (draft.sauceQuantity) $('#sauce-quantity').value = draft.sauceQuantity;
  }
  setMessage(); updateBuilder(); persist();
});
$('#sauce-quantity').addEventListener('change', event => { draft = { ...draft, sauceQuantity: Number(event.target.value) }; updateBuilder(); persist(); });
$('#cart-items').addEventListener('click', event => {
  const edit = event.target.closest('[data-edit-line]');
  if (edit) { editLine(cartLines(cart)[Number(edit.dataset.editLine)].key); return; }
  const remove = event.target.closest('[data-remove-line]');
  if (remove) {
    const line = cartLines(cart)[Number(remove.dataset.removeLine)];
    undoRemoved = { key: line.key, quantity: line.quantity };
    cart = { ...cart }; delete cart[line.key];
    invalidateSummary(); renderCart(); persist(); toast('Item removido do pedido.', true);
    return;
  }
  const button = event.target.closest('[data-line]');
  if (!button) return;
  const index = Number(button.dataset.line);
  const delta = Number(button.dataset.delta);
  const line = cartLines(cart)[index];
  cart = changeQuantity(cart, line.key, delta);
  invalidateSummary(); renderCart(); persist();
  const count = cartLines(cart).length;
  if (count) document.querySelector(`[data-line="${Math.min(index, count - 1)}"][data-delta="${delta}"]:not(:disabled)`)?.focus({ preventScroll: true });
});
$('#undo-remove').addEventListener('click', () => {
  if (!undoRemoved) return;
  const combined = (cart[undoRemoved.key] || 0) + undoRemoved.quantity;
  if (combined > 20) { toast('Não foi possível restaurar: limite de 20 unidades.'); return; }
  cart = { ...cart, [undoRemoved.key]: combined };
  undoRemoved = null; invalidateSummary(); renderCart(); persist(); toast('Item restaurado no pedido.');
});
$('#open-cart').addEventListener('click', openCart);
$('#builder-cart-link').addEventListener('click', openCart);
$('#close-cart').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { document.body.classList.remove('dialog-open'); document.body.append($('#toast')); });
dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
$('#cart-continue').addEventListener('click', () => { dialog.close(); section = 'pizzas'; updateSectionButtons(); renderStage(); focusStep(); });
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
    $('#whatsapp-link').hidden = !restaurant.whatsappConfirmed;
    if (restaurant.whatsappConfirmed) $('#whatsapp-link').href = `https://wa.me/${restaurant.whatsapp}?text=${encodeURIComponent(summary)}`;
    $('#whatsapp-status').textContent = 'O pedido e a entrega serão confirmados pelo atendimento.';
    $('#summary-panel').scrollIntoView({ behavior: 'instant', block: 'nearest' });
  } catch (error) { $('#feedback').textContent = error.message; }
});
$('#copy-summary').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(summary); $('#feedback').textContent = 'Resumo copiado.'; }
  catch { $('#feedback').textContent = 'Selecione e copie o resumo acima.'; }
});
updateCategoryButtons(); renderStage(); renderCart(); updateDelivery();
if (restored && (draft || Object.keys(cart).length)) $('#start-order').firstChild.textContent = 'Continuar meu pedido ';

new IntersectionObserver(([entry]) => { $('#builder-actions').classList.toggle('outside-workspace', !entry.isIntersecting); }, { rootMargin: '-85px 0px 0px 0px' }).observe($('#order-workspace'));
