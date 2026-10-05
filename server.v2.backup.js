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
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(ROOT, "public")));

function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
      return fallback;
    }

    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.error("JSON error:", err.message);
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

function saveProducts(data) {
  saveJSON(PRODUCTS_FILE, data);
}

function saveSubscriptions(data) {
  saveJSON(SUBS_FILE, data);
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
  const {
    name,
    price,
    volume,
    duration,
    description
  } = req.body;

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
  saveProducts(all);

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

  saveProducts(all);

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

  const filtered = all.filter(p => p.id !== req.params.id);

  saveProducts(filtered);

  res.json({
    success: true
  });
});

/* =========================
   SUBSCRIPTIONS
========================= */

app.get("/api/subscriptions", (req, res) => {
  const all = subscriptions();

  const result = all.map(sub => {
    const product = products().find(p => p.id === sub.productId);

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

  res.json({
    success: true
  });
});

/* =========================
   PUBLIC SUBSCRIPTION PAGE
========================= */

app.get("/sub/:token", (req, res) => {
  const sub = subscriptions().find(
    s => s.token === req.params.token && s.active
  );

  if (!sub) {
    return res.status(404).send(`
      <!doctype html>
      <html lang="fa" dir="rtl">
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <body style="background:#080b12;color:white;font-family:Tahoma;text-align:center;padding:60px">
      <h2>❌ لینک اشتراک معتبر نیست</h2>
      </body>
      </html>
    `);
  }

  const product = products().find(
    p => p.id === sub.productId
  );

  if (!product) {
    return res.status(404).send("محصول پیدا نشد.");
  }

  const safe = value =>
    String(value || "")
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
<title>اشتراک ${safe(product.name)} | RZVPN</title>

<style>
*{box-sizing:border-box}

body{
 margin:0;
 background:
 radial-gradient(circle at top,#18233b 0,#080b12 45%);
 color:#fff;
 font-family:Tahoma,Arial,sans-serif;
 min-height:100vh;
 padding:25px 15px;
}

.box{
 width:min(520px,100%);
 margin:auto;
 background:#111827;
 border:1px solid #263449;
 border-radius:24px;
 padding:25px;
 box-shadow:0 20px 60px #0008;
}

.logo{
 font-size:30px;
 font-weight:900;
}

.muted{
 color:#94a3b8;
 margin-top:5px;
}

.title{
 font-size:23px;
 font-weight:900;
 margin:25px 0 15px;
}

.row{
 padding:15px 0;
 border-bottom:1px solid #263244;
 display:flex;
 justify-content:space-between;
 gap:15px;
}

.value{
 font-weight:800;
}

.ok{
 color:#22c55e;
 font-weight:900;
}

.price{
 font-size:27px;
 font-weight:900;
 color:#60a5fa;
}

.desc{
 margin-top:20px;
 color:#cbd5e1;
 line-height:2;
}

.btn{
 display:block;
 text-align:center;
 text-decoration:none;
 background:#2563eb;
 color:white;
 padding:15px;
 border-radius:14px;
 margin-top:20px;
 font-weight:900;
}

.warn{
 margin-top:20px;
 background:#291f0d;
 border:1px solid #6b4f15;
 padding:15px;
 border-radius:14px;
 line-height:1.9;
 color:#fde68a;
}

.footer{
 text-align:center;
 color:#64748b;
 margin-top:25px;
 font-size:13px;
}
</style>
</head>

<body>

<div class="box">

<div class="logo">RZVPN</div>
<div class="muted">ارائه دهنده خدمات RZVPN</div>

<div class="title">${safe(product.name)}</div>

<div class="row">
<span>💰 قیمت</span>
<span class="price">${safe(product.price)}</span>
</div>

<div class="row">
<span>📦 حجم</span>
<span class="value">${safe(product.volume)}</span>
</div>

<div class="row">
<span>⏱ مدت</span>
<span class="value">${safe(product.duration)}</span>
</div>

<div class="row">
<span>وضعیت</span>
<span class="ok">● فعال</span>
</div>

${
 product.description
 ? `<div class="desc">${safe(product.description)}</div>`
 : ""
}

<div class="warn">
⚠️ این لینک برای نمایش و مدیریت اطلاعات اشتراک ساخته شده است.
برای استفاده واقعی در کلاینت‌های VPN، کانفیگ‌های واقعی سرورها باید در مرحله بعد به سیستم متصل شوند.
</div>

<a class="btn" href="/#${encodeURIComponent(product.id)}">
بازگشت به فروشگاه
</a>

<div class="footer">
RZVPN © ${new Date().getFullYear()}
</div>

</div>

</body>
</html>
`);
});

/* =========================
   RAW SUBSCRIPTION
========================= */

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

  const product = products().find(
    p => p.id === sub.productId
  );

  res.type("text/plain").send(
`# RZVPN subscription
# Product: ${product ? product.name : sub.productId}
# Volume: ${product ? product.volume : ""}
# Duration: ${product ? product.duration : ""}
#
# RZVPN real server configurations will be added here.
`
  );
});

/* =========================
   ADMIN
========================= */

app.get("/admin", (req, res) => {
  res.sendFile(path.join(ROOT, "public", "admin.html"));
});

/* =========================
   FRONTEND FALLBACK
========================= */

app.get("*", (req, res) => {
  res.sendFile(
    path.join(ROOT, "public", "index.html")
  );
});

app.listen(PORT, () => {
  console.log("");
  console.log("=================================");
  console.log(" RZVPN Subscription System v2");
  console.log(` http://localhost:${PORT}`);
  console.log(` Admin: http://localhost:${PORT}/admin`);
  console.log("=================================");
  console.log("");
});
