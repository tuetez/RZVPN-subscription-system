const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "RZVPN-Admin-1405";

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");

const PRODUCTS_FILE = path.join(ROOT, "products.json");
const LINKS_FILE = path.join(ROOT, "pricing-links.json");
const ORDERS_FILE = path.join(ROOT, "orders.json");
const SUBSCRIPTIONS_FILE = path.join(ROOT, "subscriptions.json");

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

function ensureFile(file, defaultValue) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2), "utf8");
  }
}

ensureFile(PRODUCTS_FILE, []);
ensureFile(LINKS_FILE, []);
ensureFile(ORDERS_FILE, []);
ensureFile(SUBSCRIPTIONS_FILE, []);

function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const text = fs.readFileSync(file, "utf8").trim();
    if (!text) return fallback;
    return JSON.parse(text);
  } catch (err) {
    console.error("JSON READ ERROR:", file, err.message);
    return fallback;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function id() {
  return crypto.randomUUID();
}

function token(length = 24) {
  return crypto.randomBytes(length).toString("hex");
}

function clean(value) {
  return String(value ?? "").trim();
}

function publicProduct(p) {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    volume: p.volume,
    duration: p.duration,
    location: p.location,
    protocol: p.protocol,
    description: p.description,
    active: p.active !== false,
    createdAt: p.createdAt
  };
}

/* =========================
   ADMIN AUTH
========================= */

function makeAdminToken() {
  const payload = {
    role: "admin",
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7
  };

  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");

  const signature = crypto
    .createHmac("sha256", ADMIN_PASSWORD)
    .update(body)
    .digest("base64url");

  return `${body}.${signature}`;
}

function verifyAdminToken(value) {
  try {
    if (!value) return false;

    const parts = value.split(".");
    if (parts.length !== 2) return false;

    const [body, signature] = parts;

    const expected = crypto
      .createHmac("sha256", ADMIN_PASSWORD)
      .update(body)
      .digest("base64url");

    if (
      signature.length !== expected.length ||
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
      )
    ) {
      return false;
    }

    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    );

    return payload.role === "admin" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";

  if (auth.startsWith("Bearer ")) {
    if (verifyAdminToken(auth.slice(7))) {
      req.admin = true;
      return next();
    }
  }

  if (verifyAdminToken(req.cookies?.admin_token)) {
    req.admin = true;
    return next();
  }

  return res.status(401).json({
    error: "دسترسی غیرمجاز است."
  });
}

/*
  بدون cookie-parser:
  cookie را دستی می‌خوانیم.
*/
app.use((req, res, next) => {
  req.cookies = {};

  const cookieHeader = req.headers.cookie || "";

  cookieHeader.split(";").forEach(part => {
    const index = part.indexOf("=");

    if (index > -1) {
      const key = part.slice(0, index).trim();
      const value = decodeURIComponent(part.slice(index + 1).trim());
      req.cookies[key] = value;
    }
  });

  next();
});

/* =========================
   ADMIN LOGIN
========================= */

app.post("/api/admin/login", (req, res) => {
  const password = clean(req.body.password);

  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({
      success: false,
      error: "رمز مدیریت اشتباه است."
    });
  }

  const adminToken = makeAdminToken();

  res.json({
    success: true,
    token: adminToken,
    message: "ورود موفق بود."
  });
});

app.get("/api/admin/check", requireAdmin, (req, res) => {
  res.json({
    success: true,
    admin: true
  });
});

/* =========================
   PRODUCTS
========================= */

app.get("/api/products", (req, res) => {
  const products = readJSON(PRODUCTS_FILE, []);

  const activeOnly = req.query.all !== "true";

  const result = products
    .filter(p => !activeOnly || p.active !== false)
    .map(publicProduct);

  res.json(result);
});

app.get("/api/admin/products", requireAdmin, (req, res) => {
  const products = readJSON(PRODUCTS_FILE, []);
  res.json(products);
});

app.post("/api/admin/products", requireAdmin, (req, res) => {
  const products = readJSON(PRODUCTS_FILE, []);

  const product = {
    id: id(),
    name: clean(req.body.name),
    price: clean(req.body.price),
    volume: clean(req.body.volume),
    duration: clean(req.body.duration),
    location: clean(req.body.location),
    protocol: clean(req.body.protocol),
    description: clean(req.body.description),
    active: req.body.active !== false,
    createdAt: new Date().toISOString()
  };

  if (!product.name) {
    return res.status(400).json({
      error: "نام محصول الزامی است."
    });
  }

  products.push(product);
  writeJSON(PRODUCTS_FILE, products);

  res.json({
    success: true,
    product
  });
});

app.put("/api/admin/products/:id", requireAdmin, (req, res) => {
  const products = readJSON(PRODUCTS_FILE, []);

  const index = products.findIndex(
    p => String(p.id) === String(req.params.id)
  );

  if (index === -1) {
    return res.status(404).json({
      error: "محصول پیدا نشد."
    });
  }

  const old = products[index];

  products[index] = {
    ...old,
    name: clean(req.body.name),
    price: clean(req.body.price),
    volume: clean(req.body.volume),
    duration: clean(req.body.duration),
    location: clean(req.body.location),
    protocol: clean(req.body.protocol),
    description: clean(req.body.description),
    active: req.body.active !== false,
    updatedAt: new Date().toISOString()
  };

  writeJSON(PRODUCTS_FILE, products);

  res.json({
    success: true,
    product: products[index]
  });
});

app.post("/api/admin/products/:id/toggle", requireAdmin, (req, res) => {
  const products = readJSON(PRODUCTS_FILE, []);

  const product = products.find(
    p => String(p.id) === String(req.params.id)
  );

  if (!product) {
    return res.status(404).json({
      error: "محصول پیدا نشد."
    });
  }

  product.active = product.active === false;

  writeJSON(PRODUCTS_FILE, products);

  res.json({
    success: true,
    product
  });
});

app.delete("/api/admin/products/:id", requireAdmin, (req, res) => {
  const products = readJSON(PRODUCTS_FILE, []);

  const filtered = products.filter(
    p => String(p.id) !== String(req.params.id)
  );

  if (filtered.length === products.length) {
    return res.status(404).json({
      error: "محصول پیدا نشد."
    });
  }

  writeJSON(PRODUCTS_FILE, filtered);

  res.json({
    success: true
  });
});

/* =========================
   PRICING LINKS
========================= */

app.get("/api/pricing-links", requireAdmin, (req, res) => {
  const links = readJSON(LINKS_FILE, []);
  res.json(links);
});

app.post("/api/pricing-links", requireAdmin, (req, res) => {
  const productIds = Array.isArray(req.body.productIds)
    ? req.body.productIds.map(String)
    : [];

  if (!productIds.length) {
    return res.status(400).json({
      error: "حداقل یک محصول انتخاب کنید."
    });
  }

  const products = readJSON(PRODUCTS_FILE, []);

  const selected = products
    .filter(p => productIds.includes(String(p.id)))
    .filter(p => p.active !== false);

  if (!selected.length) {
    return res.status(400).json({
      error: "محصول فعال پیدا نشد."
    });
  }

  const links = readJSON(LINKS_FILE, []);

  const item = {
    id: id(),
    token: token(12),
    productIds: selected.map(p => p.id),
    active: true,
    createdAt: new Date().toISOString()
  };

  links.push(item);
  writeJSON(LINKS_FILE, links);

  res.json({
    success: true,
    link: item,
    url: `/pricing/${item.token}`
  });
});

app.post("/api/pricing-links/:token/toggle", requireAdmin, (req, res) => {
  const links = readJSON(LINKS_FILE, []);

  const link = links.find(
    x => String(x.token) === String(req.params.token)
  );

  if (!link) {
    return res.status(404).json({
      error: "لینک پیدا نشد."
    });
  }

  link.active = link.active === false;

  writeJSON(LINKS_FILE, links);

  res.json({
    success: true,
    link
  });
});

app.delete("/api/pricing-links/:token", requireAdmin, (req, res) => {
  const links = readJSON(LINKS_FILE, []);

  const filtered = links.filter(
    x => String(x.token) !== String(req.params.token)
  );

  if (filtered.length === links.length) {
    return res.status(404).json({
      error: "لینک پیدا نشد."
    });
  }

  writeJSON(LINKS_FILE, filtered);

  res.json({
    success: true
  });
});

app.get("/api/pricing/:token", (req, res) => {
  const links = readJSON(LINKS_FILE, []);

  const link = links.find(
    x => String(x.token) === String(req.params.token)
  );

  if (!link || link.active === false) {
    return res.status(404).json({
      error: "این لینک فعال نیست."
    });
  }

  const products = readJSON(PRODUCTS_FILE, []);

  const selected = products
    .filter(p => link.productIds.includes(p.id))
    .filter(p => p.active !== false)
    .map(publicProduct);

  res.json({
    success: true,
    products: selected
  });
});

/* =========================
   ORDERS
========================= */

app.get("/api/admin/orders", requireAdmin, (req, res) => {
  const orders = readJSON(ORDERS_FILE, []);

  res.json(
    orders.sort(
      (a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
    )
  );
});

app.post("/api/orders", (req, res) => {
  const productId = clean(req.body.productId);
  const customerName = clean(req.body.customerName);
  const contact = clean(req.body.contact);
  const note = clean(req.body.note);

  if (!productId || !customerName || !contact) {
    return res.status(400).json({
      error: "نام، راه ارتباطی و محصول الزامی است."
    });
  }

  const products = readJSON(PRODUCTS_FILE, []);

  const product = products.find(
    p => String(p.id) === productId && p.active !== false
  );

  if (!product) {
    return res.status(404).json({
      error: "محصول انتخاب‌شده موجود نیست."
    });
  }

  const orders = readJSON(ORDERS_FILE, []);

  const order = {
    id: id(),
    customerName,
    contact,
    note,
    productId: product.id,
    productName: product.name,
    productPrice: product.price,
    status: "جدید",
    createdAt: new Date().toISOString()
  };

  orders.unshift(order);

  writeJSON(ORDERS_FILE, orders);

  res.json({
    success: true,
    message: "سفارش شما با موفقیت ثبت شد.",
    orderId: order.id
  });
});

app.post("/api/admin/orders/:id/status", requireAdmin, (req, res) => {
  const orders = readJSON(ORDERS_FILE, []);

  const order = orders.find(
    x => String(x.id) === String(req.params.id)
  );

  if (!order) {
    return res.status(404).json({
      error: "سفارش پیدا نشد."
    });
  }

  const allowed = [
    "جدید",
    "در حال بررسی",
    "تکمیل شده",
    "لغو شده"
  ];

  const status = clean(req.body.status);

  if (!allowed.includes(status)) {
    return res.status(400).json({
      error: "وضعیت نامعتبر است."
    });
  }

  order.status = status;
  order.updatedAt = new Date().toISOString();

  writeJSON(ORDERS_FILE, orders);

  res.json({
    success: true,
    order
  });
});

app.delete("/api/admin/orders/:id", requireAdmin, (req, res) => {
  const orders = readJSON(ORDERS_FILE, []);

  const filtered = orders.filter(
    x => String(x.id) !== String(req.params.id)
  );

  if (filtered.length === orders.length) {
    return res.status(404).json({
      error: "سفارش پیدا نشد."
    });
  }

  writeJSON(ORDERS_FILE, filtered);

  res.json({
    success: true
  });
});

/* =========================
   OLD SUBSCRIPTION APIs
========================= */

app.get("/api/subscriptions", requireAdmin, (req, res) => {
  res.json(readJSON(SUBSCRIPTIONS_FILE, []));
});

app.post("/api/subscription", requireAdmin, (req, res) => {
  const subscriptions = readJSON(SUBSCRIPTIONS_FILE, []);

  const item = {
    id: id(),
    token: token(16),
    ...req.body,
    active: true,
    createdAt: new Date().toISOString()
  };

  subscriptions.push(item);

  writeJSON(SUBSCRIPTIONS_FILE, subscriptions);

  res.json({
    success: true,
    subscription: item
  });
});

app.get("/api/subscription/:token", (req, res) => {
  const subscriptions = readJSON(SUBSCRIPTIONS_FILE, []);

  const item = subscriptions.find(
    x => String(x.token) === String(req.params.token)
  );

  if (!item || item.active === false) {
    return res.status(404).json({
      error: "اشتراک پیدا نشد."
    });
  }

  res.json(item);
});

app.post("/api/subscription/:token/toggle", requireAdmin, (req, res) => {
  const subscriptions = readJSON(SUBSCRIPTIONS_FILE, []);

  const item = subscriptions.find(
    x => String(x.token) === String(req.params.token)
  );

  if (!item) {
    return res.status(404).json({
      error: "اشتراک پیدا نشد."
    });
  }

  item.active = item.active === false;

  writeJSON(SUBSCRIPTIONS_FILE, subscriptions);

  res.json({
    success: true,
    subscription: item
  });
});

app.delete("/api/subscription/:token", requireAdmin, (req, res) => {
  const subscriptions = readJSON(SUBSCRIPTIONS_FILE, []);

  const filtered = subscriptions.filter(
    x => String(x.token) !== String(req.params.token)
  );

  writeJSON(SUBSCRIPTIONS_FILE, filtered);

  res.json({
    success: true
  });
});

/* =========================
   PUBLIC PAGES
========================= */

app.get("/pricing/:token", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "pricing.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "admin.html"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

/* =========================
   SERVER
========================= */

app.listen(PORT, HOST, () => {
  console.log("");
  console.log("====================================");
  console.log(" RZVPN Public Website");
  console.log("====================================");
  console.log(`Local:  http://localhost:${PORT}`);
  console.log(`Admin:  http://localhost:${PORT}/admin`);
  console.log(`PORT:   ${PORT}`);
  console.log("HOST:   0.0.0.0");
  console.log("====================================");
  console.log("");
});
