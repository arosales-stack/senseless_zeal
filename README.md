# Audra — portfolio + print orders

Static site (`public/`) plus one Cloudflare Pages Function (`functions/api/order.js`).
No login, no database: each order sends a confirmation email with a Stripe payment link to the buyer, and a copy to you.

## 1. Add your works
- Put images in `public/img/`: `name.webp` (≈1400px, viewer) and `name-sm.webp` (≈720px, grid).
- Add one line per work to `WORKS` at the top of the script in `public/index.html` (id = file name, plus title, medium, width, height).
- Prices live in `SIZES` (index.html) and `PRICES` (order.js). Keep them identical.

## 2. Payments (Stripe Payment Links)
Create one Payment Link per size (A4 €35, A3 €55, A2 €90) with "customer can adjust quantity" on. Paste each URL into the env vars below.

## 3. Email (Resend)
Create a Resend account, verify your domain, create an API key.

## 4. Deploy
1. Push this folder to GitHub, or run `npx wrangler pages deploy public` from this folder.
2. Cloudflare → Workers & Pages → your project → Settings → Variables and secrets:
   - `RESEND_API_KEY` (secret)
   - `FROM_EMAIL` — `Audra <prints@yourdomain.com>`
   - `ORDER_TO_EMAIL` — your address
   - `PAYMENT_LINK_A4`, `PAYMENT_LINK_A3`, `PAYMENT_LINK_A2`
3. Build output directory: `public`. No build command.

## Reading the demand test
Every order email to you carries the work, size, quantity, total and whether the buyer wants the original. Paid vs. unpaid shows up in Stripe. Unpaid orders are still signal: they tell you which works and sizes pull.
