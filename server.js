const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const PRODUCTS_FILE = path.join(ROOT, "products.json");
const SUBS_FILE = path.join(ROOT, "subscriptions.json");
const PRICING_FILE = path.join(ROOT, "pricing-links.json");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(ROOT, "public")));

function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
      return fallback;
    }
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.error("JSON error:", e.message);
    return fallback;
  }
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function products() {
  return readJSON(PRODUCTS_FILE, []);
}

function subscriptions() {
  return readJSON(SUBS_FILE, []);
}

function pricingLinks() {
  return readJSON(PRICING_FILE, []);
}

function saveSubscriptions(data) {
  saveJSON(SUBS_FILE, data);
}

function savePricingLinks(data) {
  saveJSON(PRICING_FILE, data);
}

function makeId() {
  return crypto.randomBytes(8).toString("hex");
}

function makeToken() {
  return crypto.randomBytes(18).toString("hex");
}

/* =========================
   PRODUCTS
========================= */

app.get("/api/products", (req, res) => {
  res.json(products());
});

app.post("/api/products", (req, res) => {
  const { name, price, volume, duration, description } = req.body;

  if (!name || !price || !volume || !duration) {
    return res.status(400).json({
      error: "نام، قیمت، حجم و مدت الزامی هستند."
    });
  }

  const all = products();

  const product = {
    id: makeId(),
    name: String(name),
    price: String(price),
    volume: String(volume),
    duration: String(duration),
    description: String(description || ""),
    active: true,
    createdAt: new Date().toISOString()
  };

  all.push(product);

  saveJSON(PRODUCTS_FILE, all);

  res.json({
    success: true,
    product
  });
});

app.put("/api/products/:id", (req, res) => {
  const all = products();

  const index = all.findIndex(p => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({
      error: "پلن پیدا نشد."
    });
  }

  const old = all[index];

  all[index] = {
    ...old,
    name: req.body.name ?? old.name,
    price: req.body.price ?? old.price,
    volume: req.body.volume ?? old.volume,
    duration: req.body.duration ?? old.duration,
    description: req.body.description ?? old.description,
    active:
      typeof req.body.active === "boolean"
        ? req.body.active
        : old.active,
    updatedAt: new Date().toISOString()
  };

  saveJSON(PRODUCTS_FILE, all);

  res.json({
    success: true,
    product: all[index]
  });
});

app.delete("/api/products/:id", (req, res) => {
  const all = products();

  const exists = all.some(p => p.id === req.params.id);

  if (!exists) {
    return res.status(404).json({
      error: "پلن پیدا نشد."
    });
  }

  saveJSON(
    PRODUCTS_FILE,
    all.filter(p => p.id !== req.params.id)
  );

  res.json({ success: true });
});

/* =========================
   SINGLE SUBSCRIPTIONS
========================= */

app.get("/api/subscriptions", (req, res) => {
  const ps = products();

  const result = subscriptions().map(sub => {
    const product = ps.find(p => p.id === sub.productId);

    return {
      ...sub,
      productName: product ? product.name : "نامشخص"
    };
  });

  res.json(result);
});

app.post("/api/subscription", (req, res) => {
  const product = products().find(
    p => p.id === req.body.productId && p.active !== false
  );

  if (!product) {
    return res.status(404).json({
      error: "محصول پیدا نشد."
    });
  }

  const token = makeToken();

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
    success: true,
    token,
    link: `${baseUrl}/sub/${token}`,
    rawLink: `${baseUrl}/sub/${token}/raw`
  });
});

app.get("/api/subscription/:token", (req, res) => {
  const sub = subscriptions().find(
    s => s.token === req.params.token && s.active
  );

  if (!sub) {
    return res.status(404).json({
      error: "لینک اشتراک معتبر نیست."
    });
  }

  const product = products().find(
    p => p.id === sub.productId
  );

  res.json({
    subscription: sub,
    product
  });
});

app.post("/api/subscription/:token/toggle", (req, res) => {
  const all = subscriptions();

  const index = all.findIndex(
    s => s.token === req.params.token
  );

  if (index === -1) {
    return res.status(404).json({
      error: "لینک پیدا نشد."
    });
  }

  all[index].active = !all[index].active;

  saveSubscriptions(all);

  res.json({
    success: true,
    subscription: all[index]
  });
});

app.delete("/api/subscription/:token", (req, res) => {
  const all = subscriptions();

  const filtered = all.filter(
    s => s.token !== req.params.token
  );

  if (filtered.length === all.length) {
    return res.status(404).json({
      error: "لینک پیدا نشد."
    });
  }

  saveSubscriptions(filtered);

  res.json({ success: true });
});

/* =========================
   GROUP PRICING LINKS
========================= */

app.get("/api/pricing-links", (req, res) => {
  const ps = products();

  const result = pricingLinks().map(link => ({
    ...link,
    products: link.productIds
      .map(id => ps.find(p => p.id === id))
      .filter(Boolean)
  }));

  res.json(result);
});

app.post("/api/pricing-links", (req, res) => {
  let productIds = req.body.productIds;

  if (!Array.isArray(productIds)) {
    return res.status(400).json({
      error: "لیست پلن‌ها معتبر نیست."
    });
  }

  productIds = [...new Set(productIds)];

  if (productIds.length < 2) {
    return res.status(400).json({
      error: "حداقل ۲ پلن را انتخاب کنید."
    });
  }

  const ps = products();

  const validProducts = productIds.filter(id =>
    ps.some(p => p.id === id && p.active !== false)
  );

  if (validProducts.length !== productIds.length) {
    return res.status(400).json({
      error: "یکی از پلن‌های انتخاب‌شده وجود ندارد یا غیرفعال است."
    });
  }

  const token = makeToken();

  const item = {
    token,
    productIds: validProducts,
    createdAt: new Date().toISOString(),
    active: true
  };

  const all = pricingLinks();
  all.push(item);

  savePricingLinks(all);

  const baseUrl = `${req.protocol}://${req.get("host")}`;

  res.json({
    success: true,
    token,
    link: `${baseUrl}/pricing/${token}`
  });
});

app.post("/api/pricing-links/:token/toggle", (req, res) => {
  const all = pricingLinks();

  const index = all.findIndex(
    x => x.token === req.params.token
  );

  if (index === -1) {
    return res.status(404).json({
      error: "لینک پیدا نشد."
    });
  }

  all[index].active = !all[index].active;

  savePricingLinks(all);

  res.json({
    success: true,
    pricingLink: all[index]
  });
});

app.delete("/api/pricing-links/:token", (req, res) => {
  const all = pricingLinks();

  const filtered = all.filter(
    x => x.token !== req.params.token
  );

  if (filtered.length === all.length) {
    return res.status(404).json({
      error: "لینک پیدا نشد."
    });
  }

  savePricingLinks(filtered);

  res.json({ success: true });
});

/* =========================
   PUBLIC GROUP PRICE PAGE
========================= */

app.get("/pricing/:token", (req, res) => {
  const link = pricingLinks().find(
    x => x.token === req.params.token && x.active
  );

  if (!link) {
    return res.status(404).send(`
<!doctype html>
<html lang="fa" dir="rtl">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>RZVPN</title>
<body style="
margin:0;
background:#080b12;
color:#fff;
font-family:Tahoma;
text-align:center;
padding:70px 20px">
<h2>❌ لینک قیمت معتبر نیست</h2>
</body>
</html>
`);
  }

  const ps = products();

  const selectedProducts = link.productIds
    .map(id => ps.find(p => p.id === id))
    .filter(p => p && p.active !== false);

  const safe = value =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const cards = selectedProducts.map(p => `
<div class="plan">

  <div class="plan-title">
    ${safe(p.name)}
  </div>

  <div class="price">
    ${safe(p.price)}
  </div>

  <div class="info">
    📦 حجم: <b>${safe(p.volume)}</b>
  </div>

  <div class="info">
    ⏱ مدت: <b>${safe(p.duration)}</b>
  </div>

  ${
    p.description
      ? `<div class="desc">${safe(p.description)}</div>`
      : ""
  }

  <button onclick="selectPlan('${safe(p.id)}')">
    انتخاب این پلن
  </button>

</div>
`).join("");

  res.send(`
<!doctype html>
<html lang="fa" dir="rtl">

<head>

<meta charset="utf-8">

<meta name="viewport"
content="width=device-width,initial-scale=1">

<title>قیمت‌های RZVPN</title>

<style>

*{
 box-sizing:border-box;
}

body{
 margin:0;
 min-height:100vh;
 padding:25px 14px 50px;

 background:
 radial-gradient(
   circle at top,
   #18233b 0,
   #080b12 48%
 );

 color:#fff;

 font-family:
 Tahoma,
 Arial,
 sans-serif;
}

.container{
 width:min(1000px,100%);
 margin:auto;
}

.header{
 text-align:center;
 padding:20px;
 margin-bottom:20px;
}

.logo{
 font-size:36px;
 font-weight:900;
}

.subtitle{
 color:#94a3b8;
 margin-top:8px;
}

.badge{
 display:inline-block;
 margin-top:15px;
 padding:8px 14px;
 border-radius:999px;
 background:#172554;
 color:#93c5fd;
 font-weight:800;
}

.plans{
 display:grid;
 grid-template-columns:
 repeat(auto-fit,minmax(240px,1fr));
 gap:16px;
}

.plan{
 background:#111827;
 border:1px solid #263449;
 border-radius:22px;
 padding:22px;
 box-shadow:0 15px 45px #0007;
}

.plan-title{
 font-size:20px;
 font-weight:900;
 margin-bottom:12px;
}

.price{
 color:#60a5fa;
 font-size:26px;
 font-weight:900;
 margin-bottom:18px;
}

.info{
 padding:10px 0;
 border-bottom:1px solid #263244;
 color:#cbd5e1;
}

.desc{
 color:#94a3b8;
 line-height:1.9;
 margin-top:14px;
}

button{
 width:100%;
 border:0;
 border-radius:13px;
 padding:14px;
 margin-top:18px;

 background:#2563eb;
 color:#fff;

 font-family:inherit;
 font-weight:900;
 font-size:15px;
}

button:active{
 transform:scale(.98);
}

.footer{
 text-align:center;
 color:#64748b;
 margin-top:30px;
 font-size:13px;
}

</style>

</head>

<body>

<div class="container">

<div class="header">

<div class="logo">RZVPN ⚡</div>

<div class="subtitle">
ارائه دهنده خدمات RZVPN
</div>

<div class="badge">
پلن‌های موجود
</div>

</div>

<div class="plans">
${cards}
</div>

<div class="footer">
RZVPN © ${new Date().getFullYear()}
</div>

</div>

<script>

function selectPlan(id){

 alert(
 "پلن انتخاب شد.\\n\\n" +
 "شناسه پلن: " + id +
 "\\n\\nمرحله اتصال به پرداخت و صدور اشتراک در نسخه بعدی اضافه می‌شود."
 );

}

</script>

</body>
</html>
`);
});

/* =========================
   SINGLE SUB PAGE
========================= */

app.get("/sub/:token", (req, res) => {
  const sub = subscriptions().find(
    s => s.token === req.params.token && s.active
  );

  if (!sub) {
    return res.status(404).send("لینک اشتراک معتبر نیست");
  }

  const product = products().find(
    p => p.id === sub.productId
  );

  if (!product) {
    return res.status(404).send("محصول پیدا نشد");
  }

  const safe = value =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  res.send(`
<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>اشتراک RZVPN</title>
<style>
body{
 margin:0;
 background:#080b12;
 color:#fff;
 font-family:Tahoma;
 padding:25px 15px;
}
.box{
 max-width:520px;
 margin:auto;
 background:#111827;
 border:1px solid #263449;
 border-radius:22px;
 padding:25px;
}
.logo{
 font-size:30px;
 font-weight:900;
}
.row{
 padding:14px 0;
 border-bottom:1px solid #263244;
}
.ok{
 color:#22c55e;
 font-weight:900;
}
.price{
 color:#60a5fa;
 font-size:26px;
 font-weight:900;
}
</style>
</head>
<body>
<div class="box">
<div class="logo">RZVPN</div>
<p>${safe(product.name)}</p>
<div class="row">💰 قیمت: <b class="price">${safe(product.price)}</b></div>
<div class="row">📦 حجم: <b>${safe(product.volume)}</b></div>
<div class="row">⏱ مدت: <b>${safe(product.duration)}</b></div>
<div class="row">وضعیت: <span class="ok">● فعال</span></div>
</div>
</body>
</html>
`);
});

app.get("/sub/:token/raw", (req, res) => {
  const sub = subscriptions().find(
    s => s.token === req.params.token && s.active
  );

  if (!sub) {
    return res
      .status(404)
      .type("text/plain")
      .send("INVALID_SUBSCRIPTION");
  }

  res.type("text/plain").send(
`# RZVPN subscription
# Product: ${sub.productId}
# Real VPN server configurations will be added here.
`
  );
});

/* =========================
   ADMIN
========================= */

app.get("/admin", (req, res) => {
  res.sendFile(
    path.join(ROOT, "public", "admin.html")
  );
});

app.get("*", (req, res) => {
  res.sendFile(
    path.join(ROOT, "public", "index.html")
  );
});

app.listen(PORT, () => {
  console.log("");
  console.log("=================================");
  console.log(" RZVPN Subscription System v3");
  console.log(` http://localhost:${PORT}`);
  console.log(` Admin: http://localhost:${PORT}/admin`);
  console.log("=================================");
  console.log("");
});
