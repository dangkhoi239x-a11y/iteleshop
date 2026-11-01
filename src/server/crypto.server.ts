// WebCrypto helpers (work on the edge runtime, no Node crypto needed).
const enc = new TextEncoder();

async function hmacRaw(key: Uint8Array<ArrayBuffer>, data: string, hash: "SHA-256" | "SHA-512") {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}

export const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

export async function hmacHex(key: string | Uint8Array<ArrayBuffer>, data: string, hash: "SHA-256" | "SHA-512" = "SHA-256") {
  return toHex(await hmacRaw(typeof key === "string" ? enc.encode(key) : key, data, hash));
}

export async function hmacBytes(key: string | Uint8Array<ArrayBuffer>, data: string) {
  return hmacRaw(typeof key === "string" ? enc.encode(key) : key, data, "SHA-256");
}

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
