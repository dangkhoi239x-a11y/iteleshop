import { describe, it, expect } from 'vitest';
import { summarizeProductRevenue } from '@/lib/product-revenue';
describe('product revenue', () => {
  it('groups by UTC+7 day and product with received and disputed codes', () => {
    const rows = summarizeProductRevenue([
      { id: 'a', product_id: 'p1', paid_at: '2026-11-05T18:00:00Z', currency: 'USDT', total_amount: 2, quantity: 2, escrow_status: 'released', commission_amount: 0.1 },
      { id: 'b', product_id: 'p1', paid_at: '2026-11-06T01:00:00Z', currency: 'USDT', total_amount: 1, quantity: 1, escrow_status: 'frozen' },
    ], [{ order_id: 'a', received_at: 'x' }, { order_id: 'a', received_at: 'x' }, { order_id: 'b', received_at: null }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ day: '2026-11-06', orders: 2, units: 3, gross: 3, codes: 3, received: 2, disputed: 1, disputedOrders: 1 });
    expect(rows[0].net).toBeCloseTo(2.9);
  });
});
