# Audra — portfolio + print orders

Static site (`public/`) plus one Cloudflare Pages Function (`functions/api/order.js`).
No login, no database: each order sends a confirmation email with a Stripe payment link to the buyer, and a copy to you.

## Project layout
```
works.json            the list of works (order, title, medium, frame) — edit this
originals/            source scans, never served
tools/build.py        frames + resizes originals into public/img, writes public/js/works.js
public/               what gets deployed
  index.html
  css/site.css
  js/site.js          viewer, order form, prices (SIZES)
  js/works.js         generated, don't edit
  img/                generated, don't edit
functions/api/order.js
```

## 1. Add or change works
1. Drop the scan in `originals/` as `<id>.webp` (or .jpg / .png / .tif).
2. Add a line to `works.json` with the same `id`, a title and a medium.
3. Run `python3 tools/build.py` (needs `pip install pillow numpy`).

Each image gets a frame in its own background colour so the drawing breathes away from the edges. `frame` is the border on each side as a fraction of the longest side (default `0.12`); set `"frame": 0` for scans that already have enough margin (Companion, Mirror). `trim` shaves pixels off the edges first, for scanner hairlines.

Prices live in `SIZES` (`public/js/site.js`) and `PRICES` (`functions/api/order.js`). Keep them identical.

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
