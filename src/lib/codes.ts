/** Tách nội dung dán vào thành danh sách mã: mỗi dòng một mã, bỏ dòng trống, tối đa max mã/lần. */
export function parseCodeLines(input: string | null | undefined, max = 500): string[] {
  if (!input) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || seen.has(line)) continue;
    seen.add(line);
    out.push(line);
    if (out.length >= max) break;
  }
  return out;
}

/** Tách mã từ file .txt hoặc .csv (lấy cột đầu tiên, bỏ qua dòng tiêu đề 'code'). */
export function parseImportedCodes(text: string, max = 2000): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const firstCol = raw.split(",")[0]?.replace(/^["']|["']$/g, "").trim() ?? "";
    if (!firstCol) continue;
    if (out.length === 0 && /^(code|ma|voucher|key)$/i.test(firstCol)) continue;
    if (seen.has(firstCol)) continue;
    seen.add(firstCol);
    out.push(firstCol);
    if (out.length >= max) break;
  }
  return out;
}
