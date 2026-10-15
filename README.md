# Senseless Zeal — portfolio + print orders

Static site (`public/`) plus one order endpoint (`functions/api/order.js`), deployed as a Cloudflare Worker.
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

## 4. Deploy (Cloudflare Workers, connected to GitHub)
The repo is connected to the `senseless-zeal` Worker. Every push to `main` deploys automatically.
- `wrangler.jsonc` serves `public/` as the site; `worker/index.js` handles `POST /api/order`
  using `functions/api/order.js` (the same file also works on Cloudflare Pages).
- `originals/`, `tools/` and `works.json` are never published.

Orders go through FormSubmit (free). In Cloudflare → Workers & Pages → senseless-zeal → Settings → Variables and secrets, add:
- `FORMSUBMIT_TO` (secret) — the inbox that receives orders (kept out of this public repo)
- optional `PAYMENT_LINK_A4`, `PAYMENT_LINK_A3`, `PAYMENT_LINK_A2` — Stripe Payment Links

The first order triggers a FormSubmit activation email: click it once.
Until those exist, the order form answers "not configured" instead of sending.
Custom domain: Worker → Settings → Domains & Routes → Add → Custom domain.

Local test: `npx wrangler dev` then open http://localhost:8787

## Reading the demand test
Every order email to you carries the work, size, quantity, total and whether the buyer wants the original. Paid vs. unpaid shows up in Stripe. Unpaid orders are still signal: they tell you which works and sizes pull.
