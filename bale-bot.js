require("dotenv").config();

const https = require("https");
const fs = require("fs");

const TOKEN = process.env.BALE_BOT_TOKEN;

if (!TOKEN) {
  console.error("❌ BALE_BOT_TOKEN داخل .env پیدا نشد");
  process.exit(1);
}

const API = `https://tapi.bale.ai/bot${TOKEN}`;

function api(method, body = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);

    const req = https.request(
      `${API}/${method}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data)
        }
      },
      res => {
        let out = "";

        res.on("data", chunk => out += chunk);

        res.on("end", () => {
          try {
            resolve(JSON.parse(out));
          } catch {
            resolve({ ok: false, raw: out });
          }
        });
      }
    );

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function products() {
  try {
    return JSON.parse(fs.readFileSync("./products.json", "utf8"));
  } catch {
    return [];
  }
}

function settings() {
  try {
    return JSON.parse(fs.readFileSync("./settings.json", "utf8"));
  } catch {
    return {};
  }
}

async function send(chatId, text, keyboard = null) {
  const body = {
    chat_id: chatId,
    text
  };

  if (keyboard) {
    body.reply_markup = {
      keyboard,
      resize_keyboard: true
    };
  }

  const result = await api("sendMessage", body);

  if (!result.ok) {
    console.log("❌ sendMessage:", result);
  }

  return result;
}

function menu() {
  return [
    [
      { text: "💰 لیست قیمت‌ها" },
      { text: "📞 ارتباط با ما" }
    ],
    [
      { text: "🔄 بروزرسانی قیمت‌ها" },
      { text: "ℹ️ راهنما" }
    ]
  ];
}

async function showPrices(chatId) {
  const list = products().filter(x => x.active !== false);

  if (!list.length) {
    return send(chatId, "❌ فعلاً محصول فعالی وجود ندارد.", menu());
  }

  let text = "💰 لیست قیمت‌های RZVPN\n\n";

  for (const p of list) {
    text +=
      `🔹 ${p.name || "-"}\n` +
      `📦 حجم: ${p.volume || "-"}\n` +
      `⏱ مدت: ${p.duration || "-"}\n` +
      `💵 قیمت: ${p.price || "-"}\n`;

    if (p.locations) text += `🌍 لوکیشن: ${p.locations}\n`;
    if (p.tunnel) text += `🚇 تونل: ${p.tunnel}\n`;
    if (p.protocol) text += `🔐 پروتکل: ${p.protocol}\n`;
    if (p.description) text += `📝 ${p.description}\n`;

    text += "\n━━━━━━━━━━━━━━\n\n";
  }

  return send(chatId, text, menu());
}

async function showContact(chatId) {
  const s = settings();

  let text =
    "📞 ارتباط با ما\n\n" +
    `👤 ${s.provider || "ارائه‌دهنده خدمات RZVPN"}\n`;

  if (s.baleChannel)
    text += `📢 کانال بله: ${s.baleChannel}\n`;

  if (s.baleId)
    text += `👤 آیدی بله: ${s.baleId}\n`;

  if (s.instagram)
    text += `📸 اینستاگرام: ${s.instagram}\n`;

  return send(chatId, text, menu());
}

async function handleMessage(message) {
  if (!message || !message.chat) return;

  const chatId = message.chat.id;
  const text = String(message.text || "").trim();

  console.log(`📩 پیام از ${chatId}: ${text}`);

  if (text === "/start" || text === "/menu") {
    return send(
      chatId,
      "🤖 به ربات RZVPN خوش آمدید.\n\nاز منوی زیر انتخاب کنید:",
      menu()
    );
  }

  if (text === "/prices" || text === "💰 لیست قیمت‌ها") {
    return showPrices(chatId);
  }

  if (text === "/contact" || text === "📞 ارتباط با ما") {
    return showContact(chatId);
  }

  if (text === "/refresh" || text === "🔄 بروزرسانی قیمت‌ها") {
    return send(chatId, "✅ قیمت‌ها از سایت خوانده و بروزرسانی شدند.", menu())
      .then(() => showPrices(chatId));
  }

  if (text === "/help" || text === "ℹ️ راهنما") {
    return send(
      chatId,
      "ℹ️ راهنمای ربات RZVPN\n\n" +
      "/start - شروع\n" +
      "/prices - لیست قیمت‌ها\n" +
      "/contact - ارتباط با ما\n" +
      "/refresh - بروزرسانی قیمت‌ها\n" +
      "/help - راهنما",
      menu()
    );
  }

  return send(
    chatId,
    "❓ دستور موردنظر پیدا نشد.\n\nروی «💰 لیست قیمت‌ها» بزنید.",
    menu()
  );
}

async function start() {
  console.log("================================");
  console.log("🤖 RZVPN Bale Bot");
  console.log("================================");

  const me = await api("getMe");

  if (!me.ok) {
    console.error("❌ اتصال به بله ناموفق است:");
    console.error(me);
    process.exit(1);
  }

  console.log("✅ اتصال به بله برقرار شد");
  console.log("🤖 Bot:", me.result);

  let offset = 0;

  while (true) {
    try {
      const result = await api("getUpdates", {
        offset,
        timeout: 25
      });

      if (!result.ok) {
        console.error("❌ getUpdates:", result);
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }

      const updates = result.result || [];

      for (const update of updates) {
        offset = update.update_id + 1;

        try {
          await handleMessage(update.message);
        } catch (err) {
          console.error("❌ خطای پردازش پیام:", err);
        }
      }

    } catch (err) {
      console.error("❌ خطای اتصال:", err.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

start();
