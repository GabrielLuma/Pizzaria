import { pizzaSizes } from './menu.js';
import { cartLines, quotePizza } from './order.js';

export function resizePizzaDraft(draft, sizeId) {
  const size = pizzaSizes.find(size => size.id === sizeId);
  if (!size) throw new Error('Tamanho de pizza inválido.');
  quotePizza(draft);

  const next = {
    ...draft,
    sizeId,
    flavorIds: draft.flavorIds.slice(0, size.maxFlavors),
    drinkId: draft.drinkId === 'kuat' && !size.combo ? 'none' : draft.drinkId,
  };
  quotePizza(next);
  return { draft: next, removedFlavors: draft.flavorIds.slice(size.maxFlavors) };
}

export function pizzaDraftFromKey(key) {
  if (typeof key !== 'string' || !key.startsWith('pizza:')) throw new Error('Esta seleção não é uma pizza montada.');
  const [line] = cartLines({ [key]: 1 });
  return {
    sizeId: line.size.id,
    edgeId: line.edge.id,
    flavorIds: line.flavors.map(flavor => flavor.id),
    drinkId: key.split(':')[4],
    sauceQuantity: line.sauceQuantity,
  };
}
