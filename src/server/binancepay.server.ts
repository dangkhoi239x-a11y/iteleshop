import crypto from "node:crypto";
import { hmacHex } from "./crypto.server";

const BPAY_BASE = "https://bpay.binanceapi.com";

export function randomNonce(len = 32): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.randomBytes(len);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export async function signBinancePay(timestamp: string, nonce: string, rawBody: string, secretKey: string): Promise<string> {
  const payload = `${timestamp}\n${nonce}\n${rawBody}\n`;
  return (await hmacHex(secretKey, payload, "SHA-512")).toUpperCase();
}

async function bpayPost<T>(path: string, bodyObj: Record<string, unknown>): Promise<T> {
  const apiKey = process.env["BINANCE_PAY_API_KEY"];
  const secretKey = process.env["BINANCE_PAY_SECRET_KEY"];
  if (!apiKey || !secretKey) {
    throw new Error("Binance Pay is not configured yet (missing BINANCE_PAY_API_KEY / BINANCE_PAY_SECRET_KEY).");
  }

  const rawBody = JSON.stringify(bodyObj);
  const timestamp = String(Date.now());
  const nonce = randomNonce(32);
  const signature = await signBinancePay(timestamp, nonce, rawBody, secretKey);

  const res = await fetch(`${BPAY_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "BinancePay-Timestamp": timestamp,
      "BinancePay-Nonce": nonce,
      "BinancePay-Certificate-SN": apiKey,
      "BinancePay-Signature": signature,
    },
    body: rawBody,
  });

  const json = (await res.json().catch(() => ({}))) as { status?: string; errorMessage?: string; data?: T };
  if (!res.ok || json.status !== "SUCCESS" || !json.data) {
    throw new Error(`Binance Pay: ${json.errorMessage ?? res.status}`);
  }
  return json.data;
}

export async function createBinancePayOrder(input: {
  orderId: string;
  orderNumber: number;
  amount: number;
  currency: "USDT" | "TON";
  description: string;
  origin: string;
}): Promise<{ invoiceId: string; invoiceUrl: string }> {
  const merchantTradeNo = input.orderId.replace(/-/g, "");
  const data = await bpayPost<{ prepayId: string; checkoutUrl?: string; universalUrl?: string }>("/binancepay/openapi/v3/order", {
    env: { terminalType: "WEB" },
    merchantTradeNo,
    orderAmount: Number(input.amount.toFixed(2)),
    currency: input.currency,
    description: input.description.slice(0, 200),
    goodsDetails: [
      {
        goodsType: "02",
        goodsCategory: "Z000",
        referenceGoodsId: input.orderId,
        goodsName: input.description.slice(0, 120),
      },
    ],
    webhookUrl: `${input.origin}/api/public/binancepay/webhook`,
    returnUrl: `${input.origin}/orders/${input.orderId}?paid=1`,
    cancelUrl: `${input.origin}/orders/${input.orderId}`,
  });

  const url = data.universalUrl || data.checkoutUrl;
  if (!url) throw new Error("Binance Pay did not return checkout URL");
  return { invoiceId: data.prepayId, invoiceUrl: url };
}

export async function queryBinancePayOrder(merchantTradeNo: string): Promise<{ status: string; transactionId?: string; currency?: string }> {
  return bpayPost<{ status: string; transactionId?: string; currency?: string }>("/binancepay/openapi/v2/order/query", {
    merchantTradeNo,
  });
}
