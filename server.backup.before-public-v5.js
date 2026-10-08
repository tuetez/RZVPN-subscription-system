const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const PRODUCTS_FILE = path.join(__dirname, "products.json");
const SUBSCRIPTIONS_FILE = path.join(__dirname, "subscriptions.json");
const PRICING_LINKS_FILE = path.join(__dirname, "pricing-links.json");

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

function ensureFile(file, defaultValue) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2), "utf8");
  }
}

ensureFile(PRODUCTS_FILE, []);
ensureFile(SUBSCRIPTIONS_FILE, []);
ensureFile(PRICING_LINKS_FILE, []);

function readJson(file, fallback = []) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error("JSON read error:", file, error.message);
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function id() {
  return crypto.randomUUID();
}

function token() {
  return crypto.randomBytes(18).toString("hex");
}

function clean(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function productFromBody(body, old = {}) {
  return {
    id: old.id || id(),
    name: clean(body.name),
    price: clean(body.price),
    volume: clean(body.volume),
    duration: clean(body.duration),
    location: clean(body.location),
    protocol: clean(body.protocol),
    description: clean(body.description),
    active:
      body.active === undefined
        ? old.active !== false
        : body.active === true ||
          body.active === "true" ||
          body.active === 1 ||
          body.active === "1",
    createdAt: old.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/* =========================
   PRODUCTS
========================= */

app.get("/api/products", (req, res) => {
  const products = readJson(PRODUCTS_FILE, []);
  res.json(products);
});

app.get("/api/products/:id", (req, res) => {
  const products = readJson(PRODUCTS_FILE, []);
  const product = products.find(p => p.id === req.params.id);

  if (!product) {
    return res.status(404).json({
      error: "محصول پیدا نشد"
    });
  }

  res.json(product);
});

app.post("/api/products", (req, res) => {
  const product = productFromBody(req.body);

  if (!product.name) {
    return res.status(400).json({
      error: "نام محصول الزامی است"
    });
  }

  const products = readJson(PRODUCTS_FILE, []);
  products.push(product);
  writeJson(PRODUCTS_FILE, products);

  res.status(201).json({
    success: true,
    message: "محصول با موفقیت اضافه شد",
    product
  });
});

app.put("/api/products/:id", (req, res) => {
  const products = readJson(PRODUCTS_FILE, []);
  const index = products.findIndex(p => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({
      error: "محصول پیدا نشد"
    });
  }

  products[index] = productFromBody(req.body, products[index]);
  writeJson(PRODUCTS_FILE, products);

  res.json({
    success: true,
    message: "محصول ویرایش شد",
    product: products[index]
  });
});

app.delete("/api/products/:id", (req, res) => {
  const products = readJson(PRODUCTS_FILE, []);
  const index = products.findIndex(p => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({
      error: "محصول پیدا نشد"
    });
  }

  const deleted = products.splice(index, 1)[0];
  writeJson(PRODUCTS_FILE, products);

  res.json({
    success: true,
    message: "محصول حذف شد",
    product: deleted
  });
});

/* =========================
   SUBSCRIPTIONS
========================= */

app.get("/api/subscriptions", (req, res) => {
  res.json(readJson(SUBSCRIPTIONS_FILE, []));
});

app.post("/api/subscription", (req, res) => {
  const data = {
    token: token(),
    ...req.body,
    createdAt: new Date().toISOString(),
    active: true
  };

  const subscriptions = readJson(SUBSCRIPTIONS_FILE, []);
  subscriptions.push(data);
  writeJson(SUBSCRIPTIONS_FILE, subscriptions);

  res.status(201).json({
    success: true,
    subscription: data
  });
});

app.get("/api/subscription/:token", (req, res) => {
  const subscriptions = readJson(SUBSCRIPTIONS_FILE, []);
  const item = subscriptions.find(
    x => x.token === req.params.token
  );

  if (!item) {
    return res.status(404).json({
      error: "اشتراک پیدا نشد"
    });
  }

  res.json(item);
});

app.post("/api/subscription/:token/toggle", (req, res) => {
  const subscriptions = readJson(SUBSCRIPTIONS_FILE, []);
  const item = subscriptions.find(
    x => x.token === req.params.token
  );

  if (!item) {
    return res.status(404).json({
      error: "اشتراک پیدا نشد"
    });
  }

  item.active = !item.active;
  writeJson(SUBSCRIPTIONS_FILE, subscriptions);

  res.json({
    success: true,
    subscription: item
  });
});

app.delete("/api/subscription/:token", (req, res) => {
  const subscriptions = readJson(SUBSCRIPTIONS_FILE, []);
  const index = subscriptions.findIndex(
    x => x.token === req.params.token
  );

  if (index === -1) {
    return res.status(404).json({
      error: "اشتراک پیدا نشد"
    });
  }

  const deleted = subscriptions.splice(index, 1)[0];
  writeJson(SUBSCRIPTIONS_FILE, subscriptions);

  res.json({
    success: true,
    subscription: deleted
  });
});

app.get("/sub/:token", (req, res) => {
  const subscriptions = readJson(SUBSCRIPTIONS_FILE, []);
  const item = subscriptions.find(
    x => x.token === req.params.token
  );

  if (!item) {
    return res.status(404).send("اشتراک پیدا نشد");
  }

  if (item.active === false) {
    return res.status(403).send("این اشتراک غیرفعال شده است");
  }

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
font-family:Tahoma,Arial;
background:#07111f;
color:white;
display:flex;
justify-content:center;
align-items:center;
min-height:100vh;
padding:20px;
box-sizing:border-box
}
.card{
width:min(600px,100%);
background:#101d2f;
border:1px solid #263b58;
border-radius:22px;
padding:25px;
box-sizing:border-box;
box-shadow:0 20px 60px #0008
}
h1{margin-top:0}
.row{
background:#0b1727;
border-radius:14px;
padding:14px;
margin:10px 0
}
small{color:#9db0c8}
</style>
</head>
<body>
<div class="card">
<h1>🔐 اشتراک RZVPN</h1>
<div class="row">وضعیت: ${item.active ? "🟢 فعال" : "🔴 غیرفعال"}</div>
<div class="row">اطلاعات اشتراک:<br><br>${clean(item.message || item.description || "اشتراک شما آماده است.")}</div>
</div>
</body>
</html>
`);
});

app.get("/sub/:token/raw", (req, res) => {
  const subscriptions = readJson(SUBSCRIPTIONS_FILE, []);
  const item = subscriptions.find(
    x => x.token === req.params.token
  );

  if (!item) {
    return res.status(404).send("Subscription not found");
  }

  res.type("text/plain").send(
    item.config ||
    item.subscription ||
    item.url ||
    item.message ||
    JSON.stringify(item, null, 2)
  );
});

/* =========================
   PRICING LINKS
========================= */

app.get("/api/pricing-links", (req, res) => {
  res.json(readJson(PRICING_LINKS_FILE, []));
});

app.post("/api/pricing-links", (req, res) => {
  const products = readJson(PRODUCTS_FILE, []);
  const selectedIds = Array.isArray(req.body.productIds)
    ? req.body.productIds
    : [];

  const selectedProducts = products.filter(
    p => selectedIds.includes(p.id) && p.active !== false
  );

  if (!selectedProducts.length) {
    return res.status(400).json({
      error: "حداقل یک محصول فعال انتخاب کنید"
    });
  }

  const links = readJson(PRICING_LINKS_FILE, []);

  const item = {
    token: token(),
    productIds: selectedProducts.map(p => p.id),
    createdAt: new Date().toISOString(),
    active: true
  };

  links.push(item);
  writeJson(PRICING_LINKS_FILE, links);

  res.status(201).json({
    success: true,
    link: item,
    url: `/pricing/${item.token}`,
    products: selectedProducts
  });
});

app.post("/api/pricing-links/:token/toggle", (req, res) => {
  const links = readJson(PRICING_LINKS_FILE, []);
  const item = links.find(x => x.token === req.params.token);

  if (!item) {
    return res.status(404).json({
      error: "لینک پیدا نشد"
    });
  }

  item.active = !item.active;
  writeJson(PRICING_LINKS_FILE, links);

  res.json({
    success: true,
    link: item
  });
});

app.delete("/api/pricing-links/:token", (req, res) => {
  const links = readJson(PRICING_LINKS_FILE, []);
  const index = links.findIndex(x => x.token === req.params.token);

  if (index === -1) {
    return res.status(404).json({
      error: "لینک پیدا نشد"
    });
  }

  const deleted = links.splice(index, 1)[0];
  writeJson(PRICING_LINKS_FILE, links);

  res.json({
    success: true,
    link: deleted
  });
});

app.get("/pricing/:token", (req, res) => {
  const links = readJson(PRICING_LINKS_FILE, []);
  const products = readJson(PRODUCTS_FILE, []);

  const link = links.find(x => x.token === req.params.token);

  if (!link) {
    return res.status(404).send("لینک قیمت پیدا نشد");
  }

  if (link.active === false) {
    return res.status(403).send("این لینک غیرفعال شده است");
  }

  const selected = products.filter(
    p => link.productIds.includes(p.id) && p.active !== false
  );

  const cards = selected.map(p => `
    <div class="product">
      <div class="productTop">
        <div>
          <div class="name">${escapeHtml(p.name)}</div>
          <div class="location">${escapeHtml(p.location || "لوکیشن اختصاصی")}</div>
        </div>
        <div class="price">${escapeHtml(p.price || "تماس بگیرید")} تومان</div>
      </div>

      <div class="info">
        <span>📦 ${escapeHtml(p.volume || "نامحدود")}</span>
        <span>⏱️ ${escapeHtml(p.duration || "قابل تنظیم")}</span>
        <span>📡 ${escapeHtml(p.protocol || "مولتی پروتکل")}</span>
      </div>

      <div class="desc">
        ${escapeHtml(p.description || "سرویس RZVPN با کیفیت و پایداری بالا")}
      </div>

      <button onclick="selectProduct('${p.id}')">
        🛒 انتخاب این محصول
      </button>
    </div>
  `).join("");

  res.send(`
<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>محصولات RZVPN</title>
<style>
*{box-sizing:border-box}
body{
margin:0;
font-family:Tahoma,Arial,sans-serif;
background:
radial-gradient(circle at top,#162d4b 0,#08111f 42%,#040914 100%);
color:#fff;
min-height:100vh;
padding:20px
}
.wrap{
width:min(900px,100%);
margin:auto
}
.header{
text-align:center;
padding:20px 10px 28px
}
.logo{
font-size:38px;
font-weight:900;
letter-spacing:2px
}
.logo span{color:#5aa9ff}
.subtitle{
color:#9db1c9;
margin-top:8px
}
.grid{
display:grid;
grid-template-columns:repeat(auto-fit,minmax(270px,1fr));
gap:16px
}
.product{
background:rgba(15,29,48,.9);
border:1px solid #294563;
border-radius:22px;
padding:20px;
box-shadow:0 15px 40px #0005;
transition:.2s
}
.product:hover{
transform:translateY(-3px);
border-color:#4f91d1
}
.productTop{
display:flex;
justify-content:space-between;
gap:10px;
align-items:flex-start
}
.name{
font-size:21px;
font-weight:800
}
.location{
color:#8fa9c3;
font-size:12px;
margin-top:6px
}
.price{
font-size:19px;
font-weight:900;
white-space:nowrap
}
.info{
display:flex;
flex-wrap:wrap;
gap:7px;
margin:18px 0
}
.info span{
background:#0a1728;
border:1px solid #203852;
padding:8px 10px;
border-radius:10px;
font-size:12px
}
.desc{
color:#c0cede;
line-height:1.9;
min-height:55px
}
button{
width:100%;
border:0;
border-radius:14px;
padding:14px;
margin-top:18px;
font-size:15px;
font-weight:800;
cursor:pointer;
background:#2878cf;
color:white
}
.footer{
text-align:center;
color:#7f94ac;
font-size:12px;
padding:25px
}
</style>
</head>
<body>
<div class="wrap">
<div class="header">
<div class="logo">RZ<span>VPN</span></div>
<div class="subtitle">ارائه دهنده خدمات RZVPN</div>
</div>

<div class="grid">
${cards || `<div class="product">در حال حاضر محصول فعالی وجود ندارد.</div>`}
</div>

<div class="footer">
تک لوکیشن • مستقیم • پنل اختصاصی مولتی پروتکل گیمینگ 🎮 🇹🇷
<br>
WireGuard Amnezia + ویتوری
</div>
</div>

<script>
function selectProduct(id){
  alert("محصول انتخاب شد. اتصال به سیستم سفارش در مرحله بعد اضافه می‌شود.");
}
</script>
</body>
</html>
`);
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================
   PAGES
========================= */

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("*", (req, res, next) => {
  if (
    req.path.startsWith("/api/") ||
    req.path.startsWith("/pricing/") ||
    req.path.startsWith("/sub/")
  ) {
    return next();
  }

  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =========================
   SERVER
========================= */

app.listen(PORT, HOST, () => {
  console.log(`RZVPN server running on ${HOST}:${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin`);
});
