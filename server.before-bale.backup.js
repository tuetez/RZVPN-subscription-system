const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "RZVPN-Admin-1405";

const PRODUCTS_FILE = path.join(__dirname, "products.json");
const PRICING_FILE = path.join(__dirname, "pricing-links.json");
const ORDERS_FILE = path.join(__dirname, "orders.json");
const SUBSCRIPTIONS_FILE = path.join(__dirname, "subscriptions.json");
const SETTINGS_FILE = path.join(__dirname, "settings.json");

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

function ensureFile(file, data) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(
      file,
      JSON.stringify(data, null, 2),
      "utf8"
    );
  }
}

function readJSON(file, fallback) {
  try {
    return JSON.parse(
      fs.readFileSync(file, "utf8")
    );
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(
    file,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

function makeToken() {
  return crypto.randomBytes(12).toString("hex");
}

function makeId() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function number(value) {
  if (typeof value === "number") return value;

  return Number(
    String(value || "")
      .replace(/,/g, "")
      .replace(/[^\d.-]/g, "")
  ) || 0;
}

ensureFile(PRODUCTS_FILE, []);
ensureFile(PRICING_FILE, []);
ensureFile(ORDERS_FILE, []);
ensureFile(SUBSCRIPTIONS_FILE);

ensureFile(SETTINGS_FILE, {
  brand: "RZVPN",
  provider: "ارائه‌دهنده خدمات RZVPN",
  baleChannel: "",
  baleId: "",
  instagram: "rezagh.1405"
});


/* =========================
   AUTH
========================= */

function adminAuth(req, res, next) {

  const auth =
    req.headers.authorization || "";

  if (!auth.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "نیاز به ورود مدیریت است"
    });
  }

  const token = auth.substring(7);

  if (token !== ADMIN_PASSWORD) {
    return res.status(403).json({
      error: "دسترسی غیرمجاز"
    });
  }

  next();
}


/* =========================
   LOGIN
========================= */

app.post("/api/admin/login", (req, res) => {

  const password =
    String(req.body.password || "");

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({
      success: false,
      error: "رمز مدیریت اشتباه است"
    });
  }

  res.json({
    success: true,
    token: ADMIN_PASSWORD
  });
});


/* =========================
   SETTINGS
========================= */

app.get("/api/settings", (req, res) => {

  const settings =
    readJSON(SETTINGS_FILE, {});

  res.json(settings);
});

app.get(
  "/api/admin/settings",
  adminAuth,
  (req, res) => {

    res.json(
      readJSON(SETTINGS_FILE, {})
    );
  }
);

app.put(
  "/api/admin/settings",
  adminAuth,
  (req, res) => {

    const old =
      readJSON(SETTINGS_FILE, {});

    const settings = {
      ...old,

      brand:
        req.body.brand ??
        old.brand ??
        "RZVPN",

      provider:
        req.body.provider ??
        old.provider ??
        "ارائه‌دهنده خدمات RZVPN",

      baleChannel:
        req.body.baleChannel ??
        old.baleChannel ??
        "",

      baleId:
        req.body.baleId ??
        old.baleId ??
        "",

      instagram:
        req.body.instagram ??
        old.instagram ??
        "rezagh.1405"
    };

    writeJSON(
      SETTINGS_FILE,
      settings
    );

    res.json({
      success: true,
      settings
    });
  }
);


/* =========================
   PRODUCTS
========================= */

app.get("/api/products", (req, res) => {

  res.json(
    readJSON(PRODUCTS_FILE, [])
  );
});


app.post(
  "/api/products",
  adminAuth,
  (req, res) => {

    const products =
      readJSON(PRODUCTS_FILE, []);

    const p = req.body;

    const product = {

      id:
        p.id ||
        makeId(),

      name:
        String(p.name || "محصول جدید"),

      price:
        String(p.price || "0 تومان"),

      costPrice:
        number(p.costPrice),

      volume:
        String(p.volume || ""),

      duration:
        String(p.duration || ""),

      location:
        String(p.location || ""),

      protocol:
        String(p.protocol || ""),

      description:
        String(p.description || ""),

      active:
        p.active !== false,

      createdAt: now(),

      updatedAt: now()
    };

    products.push(product);

    writeJSON(
      PRODUCTS_FILE,
      products
    );

    res.json({
      success: true,
      product
    });
  }
);


app.put(
  "/api/products/:id",
  adminAuth,
  (req, res) => {

    const products =
      readJSON(PRODUCTS_FILE, []);

    const index =
      products.findIndex(
        p =>
          String(p.id) ===
          String(req.params.id)
      );

    if (index === -1) {
      return res.status(404).json({
        error: "محصول پیدا نشد"
      });
    }

    const old =
      products[index];

    const p =
      req.body;

    products[index] = {

      ...old,

      name:
        p.name !== undefined
          ? String(p.name)
          : old.name,

      price:
        p.price !== undefined
          ? String(p.price)
          : old.price,

      costPrice:
        p.costPrice !== undefined
          ? number(p.costPrice)
          : number(old.costPrice),

      volume:
        p.volume !== undefined
          ? String(p.volume)
          : old.volume,

      duration:
        p.duration !== undefined
          ? String(p.duration)
          : old.duration,

      location:
        p.location !== undefined
          ? String(p.location)
          : old.location,

      protocol:
        p.protocol !== undefined
          ? String(p.protocol)
          : old.protocol,

      description:
        p.description !== undefined
          ? String(p.description)
          : old.description,

      active:
        p.active !== undefined
          ? Boolean(p.active)
          : old.active,

      updatedAt: now()
    };

    writeJSON(
      PRODUCTS_FILE,
      products
    );

    res.json({
      success: true,
      product: products[index]
    });
  }
);


app.delete(
  "/api/products/:id",
  adminAuth,
  (req, res) => {

    const products =
      readJSON(PRODUCTS_FILE, []);

    writeJSON(
      PRODUCTS_FILE,
      products.filter(
        p =>
          String(p.id) !==
          String(req.params.id)
      )
    );

    res.json({
      success: true
    });
  }
);


/* =========================
   PRICING LINKS
========================= */

app.get(
  "/api/pricing-links",
  adminAuth,
  (req, res) => {

    res.json(
      readJSON(PRICING_FILE, [])
    );
  }
);


app.post(
  "/api/pricing-links",
  adminAuth,
  (req, res) => {

    const products =
      readJSON(PRODUCTS_FILE, []);

    const links =
      readJSON(PRICING_FILE, []);

    const ids =
      Array.isArray(req.body.productIds)
        ? req.body.productIds.map(String)
        : [];

    const selected =
      products.filter(
        p =>
          ids.includes(String(p.id)) &&
          p.active !== false
      );

    if (!selected.length) {
      return res.status(400).json({
        error:
          "حداقل یک محصول انتخاب کنید"
      });
    }

    const item = {

      token: makeToken(),

      name:
        String(
          req.body.name ||
          "لیست قیمت RZVPN"
        ),

      productIds:
        selected.map(p => p.id),

      active: true,

      createdAt: now()
    };

    links.push(item);

    writeJSON(
      PRICING_FILE,
      links
    );

    res.json({
      success: true,
      link: item
    });
  }
);


app.post(
  "/api/pricing-links/:token/toggle",
  adminAuth,
  (req, res) => {

    const links =
      readJSON(PRICING_FILE, []);

    const link =
      links.find(
        x =>
          x.token ===
          req.params.token
      );

    if (!link) {
      return res.status(404).json({
        error: "لینک پیدا نشد"
      });
    }

    link.active =
      !link.active;

    writeJSON(
      PRICING_FILE,
      links
    );

    res.json({
      success: true,
      link
    });
  }
);


app.delete(
  "/api/pricing-links/:token",
  adminAuth,
  (req, res) => {

    const links =
      readJSON(PRICING_FILE, []);

    writeJSON(
      PRICING_FILE,
      links.filter(
        x =>
          x.token !==
          req.params.token
      )
    );

    res.json({
      success: true
    });
  }
);


/* =========================
   PUBLIC PRICING
========================= */

app.get(
  "/api/pricing/:token",
  (req, res) => {

    const links =
      readJSON(PRICING_FILE, []);

    const products =
      readJSON(PRODUCTS_FILE, []);

    const link =
      links.find(
        x =>
          x.token ===
          req.params.token &&
          x.active !== false
      );

    if (!link) {
      return res.status(404).json({
        error:
          "این لینک وجود ندارد یا غیرفعال است"
      });
    }

    const selected =
      products.filter(
        p =>
          link.productIds
            .map(String)
            .includes(String(p.id)) &&
          p.active !== false
      );

    res.json({
      link,
      products: selected
    });
  }
);


/* =========================
   ORDERS
========================= */

app.get(
  "/api/orders",
  adminAuth,
  (req, res) => {

    const orders =
      readJSON(ORDERS_FILE, []);

    orders.sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    );

    res.json(orders);
  }
);


app.post(
  "/api/orders",
  (req, res) => {

    const products =
      readJSON(PRODUCTS_FILE, []);

    const orders =
      readJSON(ORDERS_FILE, []);

    const p =
      products.find(
        x =>
          String(x.id) ===
          String(req.body.productId) &&
          x.active !== false
      );

    if (!p) {
      return res.status(400).json({
        error:
          "محصول انتخاب‌شده موجود نیست"
      });
    }

    const sale =
      number(p.price);

    const cost =
      number(p.costPrice);

    const order = {

      id:
        "ORD-" +
        Date.now(),

      productId:
        p.id,

      productName:
        p.name,

      salePrice:
        sale,

      costPrice:
        cost,

      profit:
        sale - cost,

      customerName:
        String(
          req.body.customerName || ""
        ),

      customerPhone:
        String(
          req.body.customerPhone || ""
        ),

      baleChannel:
        String(
          req.body.baleChannel || ""
        ),

      baleId:
        String(
          req.body.baleId || ""
        ),

      instagram:
        String(
          req.body.instagram || ""
        ),

      note:
        String(
          req.body.note || ""
        ),

      status:
        "جدید",

      createdAt:
        now(),

      updatedAt:
        now()
    };

    orders.push(order);

    writeJSON(
      ORDERS_FILE,
      orders
    );

    res.json({
      success: true,
      order
    });
  }
);


app.put(
  "/api/orders/:id/status",
  adminAuth,
  (req, res) => {

    const orders =
      readJSON(ORDERS_FILE, []);

    const order =
      orders.find(
        x =>
          x.id ===
          req.params.id
      );

    if (!order) {
      return res.status(404).json({
        error:
          "سفارش پیدا نشد"
      });
    }

    const allowed = [
      "جدید",
      "در حال بررسی",
      "تکمیل شده",
      "لغو شده"
    ];

    const status =
      String(
        req.body.status || ""
      );

    if (!allowed.includes(status)) {
      return res.status(400).json({
        error:
          "وضعیت نامعتبر است"
      });
    }

    order.status =
      status;

    order.updatedAt =
      now();

    writeJSON(
      ORDERS_FILE,
      orders
    );

    res.json({
      success: true,
      order
    });
  }
);


app.delete(
  "/api/orders/:id",
  adminAuth,
  (req, res) => {

    const orders =
      readJSON(ORDERS_FILE, []);

    writeJSON(
      ORDERS_FILE,
      orders.filter(
        x =>
          x.id !==
          req.params.id
      )
    );

    res.json({
      success: true
    });
  }
);


/* =========================
   DASHBOARD
========================= */

app.get(
  "/api/dashboard",
  adminAuth,
  (req, res) => {

    const orders =
      readJSON(ORDERS_FILE, []);

    const completed =
      orders.filter(
        x =>
          x.status ===
          "تکمیل شده"
      );

    const totalSales =
      completed.reduce(
        (sum, x) =>
          sum +
          number(x.salePrice),
        0
      );

    const totalCost =
      completed.reduce(
        (sum, x) =>
          sum +
          number(x.costPrice),
        0
      );

    const totalProfit =
      completed.reduce(
        (sum, x) =>
          sum +
          number(x.profit),
        0
      );

    const products =
      readJSON(
        PRODUCTS_FILE,
        []
      );

    const productStats = {};

    completed.forEach(
      order => {

        if (!productStats[
          order.productId
        ]) {

          productStats[
            order.productId
          ] = {

            productId:
              order.productId,

            productName:
              order.productName,

            count: 0,

            sales: 0,

            profit: 0
          };
        }

        productStats[
          order.productId
        ].count++;

        productStats[
          order.productId
        ].sales +=
          number(
            order.salePrice
          );

        productStats[
          order.productId
        ].profit +=
          number(
            order.profit
          );
      }
    );

    res.json({

      totalSales,

      totalRevenue:
        totalSales,

      totalCost,

      totalProfit,

      totalOrders:
        orders.length,

      newOrders:
        orders.filter(
          x =>
            x.status === "جدید"
        ).length,

      processingOrders:
        orders.filter(
          x =>
            x.status ===
            "در حال بررسی"
        ).length,

      completedOrders:
        completed.length,

      cancelledOrders:
        orders.filter(
          x =>
            x.status ===
            "لغو شده"
        ).length,

      products:
        products.length,

      activeProducts:
        products.filter(
          x =>
            x.active !== false
        ).length,

      productStats:
        Object.values(
          productStats
        ),

      recentOrders:
        orders.slice(0, 10)
    });
  }
);


/* =========================
   OLD SUBSCRIPTIONS
========================= */

app.get(
  "/api/subscriptions",
  adminAuth,
  (req, res) => {

    res.json(
      readJSON(
        SUBSCRIPTIONS_FILE,
        []
      )
    );
  }
);


app.post(
  "/api/subscription",
  (req, res) => {

    const list =
      readJSON(
        SUBSCRIPTIONS_FILE,
        []
      );

    const item = {

      token:
        makeToken(),

      ...req.body,

      active: true,

      createdAt:
        now()
    };

    list.push(item);

    writeJSON(
      SUBSCRIPTIONS_FILE,
      list
    );

    res.json({
      success: true,
      subscription: item
    });
  }
);


app.get(
  "/api/subscription/:token",
  (req, res) => {

    const list =
      readJSON(
        SUBSCRIPTIONS_FILE,
        []
      );

    const item =
      list.find(
        x =>
          x.token ===
          req.params.token
      );

    if (!item) {
      return res.status(404).json({
        error:
          "اشتراک پیدا نشد"
      });
    }

    res.json(item);
  }
);


app.post(
  "/api/subscription/:token/toggle",
  adminAuth,
  (req, res) => {

    const list =
      readJSON(
        SUBSCRIPTIONS_FILE,
        []
      );

    const item =
      list.find(
        x =>
          x.token ===
          req.params.token
      );

    if (!item) {
      return res.status(404).json({
        error:
          "اشتراک پیدا نشد"
      });
    }

    item.active =
      !item.active;

    writeJSON(
      SUBSCRIPTIONS_FILE,
      list
    );

    res.json({
      success: true,
      subscription: item
    });
  }
);


app.delete(
  "/api/subscription/:token",
  adminAuth,
  (req, res) => {

    const list =
      readJSON(
        SUBSCRIPTIONS_FILE,
        []
      );

    writeJSON(
      SUBSCRIPTIONS_FILE,
      list.filter(
        x =>
          x.token !==
          req.params.token
      )
    );

    res.json({
      success: true
    });
  }
);


/* =========================
   PAGES
========================= */

app.get(
  "/admin",
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        "public",
        "admin.html"
      )
    );
  }
);


app.get(
  "/pricing/:token",
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        "public",
        "pricing.html"
      )
    );
  }
);


app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    )
  )
);


app.use(
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );
  }
);


/* =========================
   START
========================= */

app.listen(
  PORT,
  HOST,
  () => {

    console.log("");
    console.log(
      "===================================="
    );
    console.log(
      " RZVPN Subscription System"
    );
    console.log(
      "===================================="
    );
    console.log(
      `Local: http://localhost:${PORT}`
    );
    console.log(
      `Admin: http://localhost:${PORT}/admin`
    );
    console.log(
      `HOST: ${HOST}`
    );
    console.log(
      `PORT: ${PORT}`
    );
    console.log(
      "===================================="
    );
    console.log("");
  }
);
