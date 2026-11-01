/** Tách nội dung dán vào thành danh sách mã: mỗi dòng một mã, bỏ dòng trống, tối đa 500 mã/lần. */
export function parseCodeLines(input: string | null | undefined, max = 500): string[] {
  if (!input) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split("\n")) {
    const line = raw.trim();
    if (!line || seen.has(line)) continue;
    seen.add(line);
    out.push(line);
    if (out.length >= max) break;
  }
  return out;
}
