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
- Reward points are a signed ledger (`reward_points`); check-in, task awards, draw entry and draw runs go through service-role-only SQL functions; task requirements are verified server-side before awarding. Why: no double claims or negative balances.
- Telegram Stars checkout: invoice payload = order id, webhook /api/public/telegram/webhook verifies secret token derived from bot token; post-payment logic shared in src/server/order-paid.server.ts. Why: one idempotent paid path for crypto and Stars.
- Stars actual receipts are allocated proportionally by invoice Stars in service-role-only settlement SQL; seller credits require both settlement and escrow release. Why: checkout prices are not realized cash proceeds and credits must be idempotent.
- Revenue reports aggregate all paginated paid orders by shop, UTC+7 payment day, payment method and settlement currency; never combine TON and USDT. Why: reporting must reconcile to the realized seller ledger without mixing assets.
- The shared revenue view serves the dedicated platform report and seller report; report query keys include the authenticated user and filters. Why: consistent accounting and no cross-account cached financial data.
- Telegram Start and menu buttons use the verified published app URL (optional TELEGRAM_APP_URL override), never a preview or webhook host; webhook registration is separate. Why: public webhook access does not imply public frontend access.
- Telegram send results are recorded without message contents or credentials, and channel administration is server-role checked. Why: auditable notifications without exposing delivered codes.
- Automated payouts stay disabled until provider custody permissions, network quotes and verified payout lifecycle are available; financial completion uses a locked service-role RPC. Why: fee settings alone cannot transfer real funds or prove receipt.
- Growth campaigns use service-only locked SQL for private prize inventory and idempotent free spins; referral bonuses are accepted only during new verified Telegram signup from signed start parameters, and activation requires admin approval. Why: prevents client-forged referrals, duplicate gifts and unapproved campaigns; token funding remains disabled without verified payouts.
