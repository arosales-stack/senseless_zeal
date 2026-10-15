// POST /api/order — sends each order through FormSubmit (free, no account).
// The order goes to your inbox; the buyer gets an automatic confirmation email.
// Your address is never in the page or this public repo: it lives in a Cloudflare secret.
//
// Cloudflare → Workers & Pages → senseless-zeal → Settings → Variables and secrets:
//   FORMSUBMIT_TO    (secret) your email, or the random FormSubmit alias once activated
// Optional:
//   PAYMENT_LINK_A4 / PAYMENT_LINK_A3 / PAYMENT_LINK_A2   Stripe Payment Links, one per size.
//                    If a link is missing, the buyer is told it will follow by email.
//
// First order ever: FormSubmit emails you an activation link. Click it once; every order after that arrives.

const PRICES = { A4: 35, A3: 55, A2: 90 }; // keep in sync with SIZES in public/js/site.js
const SITE = "https://senselesszeal.com/";

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
  if (!env.FORMSUBMIT_TO) return json({ error: "Ordering is not configured yet" }, 503);

  const total = PRICES[size] * qty;                      // recomputed here, never trusted from the page
  const ref = "SZ-" + Date.now().toString(36).toUpperCase().slice(-6);
  const pay = env["PAYMENT_LINK_" + size];

  const confirmation =
    `Thank you, ${name}.\n\n` +
    `Your order ${ref}: ${qty} × ${title}, ${size} print — €${total}, shipping to ${country} included.\n\n` +
    (pay ? `Pay here: ${pay}\nSet the quantity to ${qty} on the payment page. Your print goes into production once payment is complete.\n\n`
         : `I'll send your secure payment link personally within 24 hours. Nothing is charged until you pay through it.\n\n`) +
    (o.original ? `You mentioned interest in the original drawing. I'll write to you about it.\n\n` : "") +
    `Every work is drawn by hand. No AI.\nSenseless Zeal`;

  const payload = {
    _subject: `New order ${ref}: ${qty} × ${title} ${size} (€${total})${o.original ? " + original interest" : ""}`,
    _template: "table",
    _captcha: "false",
    _autoresponse: confirmation,                         // FormSubmit emails this to the "email" field below
    Reference: ref,
    Work: title,
    Size: size,
    Quantity: qty,
    Total: `€${total}`,
    Name: name,
    email,                                               // buyer: also becomes reply-to
    Country: country,
    "Interested in original": o.original ? "Yes" : "No",
    Note: note || "—",
  };

  try {
    const r = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(env.FORMSUBMIT_TO)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Origin: SITE.slice(0, -1), Referer: SITE },
      body: JSON.stringify(payload),
    });
    const res = await r.json().catch(() => ({}));
    // The very first submission returns "needs activation" and emails you the activation link: count it as received.
    const activating = /activat/i.test(String(res.message || ""));
    if (!activating && (!r.ok || String(res.success) === "false")) return json({ error: "Order service error", detail: res.message || r.status }, 502);
  } catch {
    return json({ error: "Order service unreachable" }, 502);
  }
  return json({ ok: true, ref });
}

const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
