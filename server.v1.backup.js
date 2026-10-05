const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PRODUCTS_FILE = path.join(ROOT, "products.json");
const SUBS_FILE = path.join(ROOT, "subscriptions.json");

app.use(express.json());
app.use(express.static(path.join(ROOT, "public")));

function products() {
  return JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8"));
}
function subscriptions() {
  return JSON.parse(fs.readFileSync(SUBS_FILE, "utf8"));
}
function saveSubscriptions(data) {
  fs.writeFileSync(SUBS_FILE, JSON.stringify(data, null, 2), "utf8");
}

app.get("/api/products", (req,res) => res.json(products()));

app.post("/api/subscription", (req,res) => {
  const product = products().find(p => p.id === req.body.productId);
  if (!product) return res.status(404).json({error:"محصول پیدا نشد"});

  const token = crypto.randomBytes(18).toString("hex");
  const sub = {
    token,
    productId: product.id,
    createdAt: new Date().toISOString(),
    active: true
  };
  const all = subscriptions();
  all.push(sub);
  saveSubscriptions(all);

  const baseUrl = `${req.protocol}://${req.get("host")}`;
  res.json({
    token,
    link: `${baseUrl}/sub/${token}`,
    rawLink: `${baseUrl}/sub/${token}/raw`
  });
});

app.get("/api/subscription/:token", (req,res) => {
  const sub = subscriptions().find(s => s.token === req.params.token && s.active);
  if (!sub) return res.status(404).json({error:"لینک اشتراک معتبر نیست"});
  const product = products().find(p => p.id === sub.productId);
  res.json({subscription:sub, product});
});

app.get("/sub/:token", (req,res) => {
  const sub = subscriptions().find(s => s.token === req.params.token && s.active);
  if (!sub) return res.status(404).send("لینک اشتراک معتبر نیست");
  const product = products().find(p => p.id === sub.productId);
  res.send(`<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>اشتراک RZVPN</title>
  <style>body{margin:0;background:#080b12;color:#fff;font-family:Tahoma,Arial,sans-serif;display:flex;justify-content:center;padding:30px}.box{width:min(520px,100%);background:#111827;border:1px solid #273449;border-radius:20px;padding:24px;box-sizing:border-box}.brand{font-size:24px;font-weight:900}.muted{color:#94a3b8}.row{padding:12px 0;border-bottom:1px solid #263244}.ok{color:#22c55e;font-weight:800}.warn{background:#291f0d;border:1px solid #6b4f15;padding:14px;border-radius:12px;margin-top:18px;line-height:1.8}.btn{display:block;text-align:center;text-decoration:none;background:#2563eb;color:#fff;padding:13px;border-radius:12px;margin-top:14px;font-weight:800}</style>
  <div class="box"><div class="brand">RZVPN</div><div class="muted">ارائه دهنده خدمات RZVPN</div>
  <div class="row"><b>محصول:</b> ${product.name}</div><div class="row"><b>حجم:</b> ${product.volume}</div><div class="row"><b>مدت:</b> ${product.duration}</div><div class="row"><b>وضعیت:</b> <span class="ok">فعال</span></div>
  <div class="warn">⚠️ این لینک عمومی است و بدون VPN قابل باز شدن است. برای تبدیل آن به <b>اشتراک واقعی قابل استفاده در کلاینت‌های VPN</b> باید کانفیگ/سرورهای واقعی شما در بخش سرور قرار داده شوند. در حال حاضر این صفحه، لینک اشتراک و مشخصات محصول را مدیریت می‌کند.</div>
  <a class="btn" href="/#${product.id}">بازگشت به فروشگاه</a></div></html>`);
});

app.get("/sub/:token/raw", (req,res) => {
  const sub = subscriptions().find(s => s.token === req.params.token && s.active);
  if (!sub) return res.status(404).type("text/plain").send("INVALID_SUBSCRIPTION");
  // Place real VLESS / VMess / Trojan / WireGuard subscription lines here later.
  res.type("text/plain").send(`# RZVPN subscription
# Product: ${sub.productId}
# This endpoint is ready for real server configurations.
# Add your real subscription nodes in server.js/products.json before distributing this link.
`);
});

app.get("*", (req,res) => res.sendFile(path.join(ROOT,"public","index.html")));

app.listen(PORT, () => console.log(`RZVPN subscription system: http://localhost:${PORT}`));
