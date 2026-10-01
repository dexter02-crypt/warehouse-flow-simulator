export function compatibleSkuSlot(sku, slot) {
  if (!sku || !slot) throw new Error('compatibility: SKU and slot are required.');
  if (![sku.size, sku.weight, slot.capacity, slot.maxWeight].every(v => typeof v === 'number' && Number.isFinite(v) && v > 0)) return false;
  return sku.size <= slot.capacity && sku.weight <= slot.maxWeight &&
    typeof sku.zone === 'string' && (slot.zone === 'any' || sku.zone === slot.zone);
}
