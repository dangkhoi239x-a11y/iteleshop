/** Never treat a rejected persistence operation as successful. */
export function checked<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export function requireTransition(result: { data: boolean | null; error: { message: string } | null }) {
  if (checked(result) !== true) throw new Error("The requested transition did not complete");
}

export async function readAll<T>(page: (offset: number, end: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, size = 500): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += size) {
    const batch = checked(await page(offset, offset + size - 1)) ?? [];
    rows.push(...batch);
    if (batch.length < size) return rows;
  }
}