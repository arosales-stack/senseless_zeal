// Cloudflare Pages Function: POST /api/order
// Sends two emails through Resend: a confirmation with a payment link to the buyer,
// and the full order to you. Your inbox is the order log.
//
// Environment variables (Pages → Settings → Variables and secrets):
//   RESEND_API_KEY   secret, from resend.com
//   FROM_EMAIL       e.g. "Senseless Zeal <prints@yourdomain.com>" (domain verified in Resend)
//   ORDER_TO_EMAIL   where orders land (your address)
//   PAYMENT_LINK_A4 / PAYMENT_LINK_A3 / PAYMENT_LINK_A2
//                    Stripe Payment Links, one per size (quantity adjustable in Stripe).
//                    If a link is missing, the buyer is told one will follow by email.

const PRICES = { A4: 35, A3: 55, A2: 90 }; // keep in sync with SIZES in index.html

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function onRequestPost({ request, env }) {
  let o;
  try { o = await request.json(); } catch { return json({ error: "Invalid request" }, 400); }

  const size = String(o.size || "");
  const qty = Math.min(10, Math.max(1, parseInt(o.qty, 10) || 1));
  const email = String(o.email || "").trim();
  const name = String(o.name || "").trim().slice(0, 120);
  const country = String(o.country || "").trim().slice(0, 80);
  const title = String(o.title || "").slice(0, 120);
  const note = String(o.note || "").slice(0, 600);
  if (!PRICES[size] || !name || !country || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Missing or invalid fields" }, 400);
  }
  const total = PRICES[size] * qty; // recomputed server-side, never trusted from the page
  const ref = "AU-" + Date.now().toString(36).toUpperCase().slice(-6);
  const pay = env["PAYMENT_LINK_" + size];

  const buyerHtml = `
  <div style="font-family:Georgia,serif;max-width:520px;margin:auto;color:#111">
    <p style="font-size:22px">Thank you, ${esc(name)}.</p>
    <p>Your order <b>${ref}</b> is confirmed:</p>
    <p>${qty} × <i>${esc(title)}</i>, ${size} print — <b>€${total}</b>, shipping to ${esc(country)} included.</p>
    ${pay
      ? `<p><a href="${esc(pay)}" style="display:inline-block;background:#111;color:#fff;padding:12px 22px;text-decoration:none;font-family:monospace;letter-spacing:.08em">PAY €${total}</a></p>
         <p style="color:#666;font-size:13px">Set the quantity to ${qty} on the payment page. Your print goes into production once payment is complete.</p>`
      : `<p>I'll send your payment link personally within 24 hours.</p>`}
    ${o.original ? `<p>You mentioned interest in the original drawing. I'll write to you about it.</p>` : ""}
    <p>Every work is drawn by hand. No AI.</p>
    <p>Senseless Zeal</p>
  </div>`;

  const youHtml = `<pre style="font-family:monospace">${esc(JSON.stringify({ ref, name, email, country, title, piece: o.piece, size, qty, total, original: !!o.original, note, at: new Date().toISOString() }, null, 2))}</pre>`;

  const send = (to, subject, html, reply_to) => fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.FROM_EMAIL, to, subject, html, ...(reply_to ? { reply_to } : {}) }),
  });

  if (!env.RESEND_API_KEY || !env.FROM_EMAIL || !env.ORDER_TO_EMAIL) {
    return json({ error: "Ordering is not configured yet" }, 503);
  }
  try {
    const [a, b] = await Promise.all([
      send(email, `Your print order ${ref}`, buyerHtml, env.ORDER_TO_EMAIL),
      send(env.ORDER_TO_EMAIL, `New order ${ref}: ${qty} × ${title} ${size} (€${total})${o.original ? " + original interest" : ""}`, youHtml, email),
    ]);
    if (!a.ok || !b.ok) return json({ error: "Email failed" }, 502);
  } catch {
    return json({ error: "Email service unreachable" }, 502);
  }
  return json({ ok: true, ref });
}

const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
