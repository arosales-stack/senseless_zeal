# Senseless Zeal — portfolio + print orders

Static site (`public/`) deployed as a Cloudflare Worker; orders go through FormSubmit.
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
worker/index.js       one link per work (senselesszeal.com/<id>)
worker/works.json     generated, don't edit
wrangler.jsonc        Cloudflare Workers config
```

## 1. Add or change works
1. Drop the scan in `originals/` as `<id>.webp` (or .jpg / .png / .tif).
2. Add a line to `works.json` with the same `id`, a title and a medium.
3. Run `python3 tools/build.py` (needs `pip install pillow numpy`).

Each image gets a frame in its own background colour so the drawing breathes away from the edges. `frame` is the border on each side as a fraction of the longest side (default `0.12`); set `"frame": 0` for scans that already have enough margin (Companion, Mirror). `trim` shaves pixels off the edges first, for scanner hairlines.

Prices live in `SIZES` (`public/js/site.js`).

## 4. Deploy (Cloudflare Workers, connected to GitHub)
Every push to `main` deploys automatically to senselesszeal.com.
- `wrangler.jsonc` serves `public/` as the site; `worker/index.js` gives each work its own link
  (senselesszeal.com/<id>) with the right title and image in link previews.
- `originals/`, `tools/` and `works.json` are never published.

## 5. Orders
The form posts straight from the page to FormSubmit using its alias for your inbox
(`ORDER_ENDPOINT` in `public/js/site.js`), so your email address is never in the code.
Buyers get an automatic confirmation; you get the order as a table.

Local test: `npx wrangler dev` then open http://localhost:8787

## Reading the demand test
Every order email to you carries the work, size, quantity, total and whether the buyer wants the original. Paid vs. unpaid shows up in Stripe. Unpaid orders are still signal: they tell you which works and sizes pull.
