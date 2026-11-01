export type Recommendation = { productId: string; reason: string };
export function matchRecommendations<T extends { id: string }>(items: Recommendation[], catalog: T[]) {
  const seen = new Set<string>();
  return items.flatMap((item) => {
    const product = catalog.find((p) => p.id === item.productId);
    if (!product || seen.has(product.id) || !item.reason.trim()) return [];
    seen.add(product.id);
    return [{ product, reason: item.reason.slice(0, 500) }];
  }).slice(0, 5);
}