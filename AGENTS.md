<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Server functions live in `src/functions/*.functions.ts`; server-only helpers live in `src/server/*.server.ts` and are only loaded via dynamic import inside handlers (client imports of `src/server/**` are blocked).
- All writes go through server functions using the admin client after checking the caller; browser reads use RLS-scoped select policies. Why: keeps money/escrow logic tamper-proof.
- Money moves only through SQL functions (`mark_order_paid`, `release_order_escrow`, `refund_order_escrow`, `request_withdrawal`) callable by service role only. Why: atomic, idempotent ledger.
- Wallet balance = sum of `wallet_transactions` (signed) excluding rejected; never store balances.
- Telegram login: initData verified with bot token, account email `tg_<id>@telegram.teleshop.app`, password = HMAC(SESSION_SECRET). Demo accounts (`demo_*`) exist for testing outside Telegram.
- Payments via NOWPayments invoices; IPN webhook `/api/public/nowpayments/ipn` verified by HMAC-SHA512.
- Digital delivery content lives in `product_secrets` (owner-only) and is copied to `orders.delivered_content` on payment.
- Pages render client-side (`defaultSsr: false` in src/start.ts) — Mini App, per-user data.
- Pricing rules are pure functions in `src/lib/pricing.ts`, covered by `src/test/pricing.test.ts`.
- Code issue mutations use service-role-only SQL functions with participant checks, order/code locks and append-only events; replacement claims inventory atomically without moving money.
- Product recommendations use authenticated server functions, server-only AI Gateway Responses helpers and catalog ID validation; provider blocks persist in ai_access_state to prevent replay.
