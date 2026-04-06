const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const fs = require("fs");

/* ================= CONFIG ================= */

const TOKEN = process.env.TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const CHAT_CHANNEL_ID = "1437072659585175564";

/* ================= CLIENT ================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* ================= DATABASE ================= */

const FILE = "/data/data_login.json";

if (!fs.existsSync("/data")) fs.mkdirSync("/data");

if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE, JSON.stringify({}));
}

let data = JSON.parse(fs.readFileSync(FILE));

if (!data._config) {
  data._config = { lastMonth: null };
  save();
}

function save() {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

/* ================= TIME ================= */

function getJakarta() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
}

function getToday() {
  return getJakarta().toISOString().slice(0, 10);
}

function getRemainingDays() {
  const now = getJakarta();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return lastDay.getDate() - now.getDate();
}

function isLastDay() {
  return getRemainingDays() === 0;
}

/* ================= AUTO RESET BULAN ================= */

function checkNewMonth() {
  const now = getJakarta();
  const currentMonth = `${now.getFullYear()}-${now.getMonth()}`;

  if (data._config.lastMonth !== currentMonth) {
    console.log("RESET BULAN BARU");

    for (const id in data) {
      if (id.startsWith("_")) continue;

      data[id] = {
        streak: 0,
        lastLogin: null,
        chatCount: 0,
        lastChatDay: null,
        claimed: false
      };
    }

    data._config.lastMonth = currentMonth;
    save();
  }
}

/* ================= USER ================= */

function getUser(id) {
  if (!data[id]) {
    data[id] = {
      streak: 0,
      lastLogin: null,
      chatCount: 0,
      lastChatDay: null,
      claimed: false
    };
  }
  return data[id];
}

/* ================= BAR ================= */

function bar(val, max) {
  const size = 10;
  const filled = Math.round((val / max) * size);
  return "🟩".repeat(filled) + "⬜".repeat(size - filled);
}

/* ================= CHAT TRACK ================= */

client.on("messageCreate", (msg) => {
  if (msg.author.bot) return;
  if (msg.channel.id !== CHAT_CHANNEL_ID) return;

  const user = getUser(msg.author.id);
  const today = getToday();

  if (user.lastChatDay !== today) {
    user.chatCount = 0;
    user.lastChatDay = today;
  }

  user.chatCount++;
  save();
});

/* ================= PANEL ================= */

client.on("messageCreate", async (msg) => {

  if (msg.content === "!panel") {

    if (msg.author.id !== ADMIN_ID)
      return msg.reply("Owner only");

    const sent = await msg.channel.send({
      embeds: [buildPanel()],
      components: [buildButtons()]
    });

    data._panel = {
      channelId: msg.channel.id,
      messageId: sent.id
    };

    save();
  }
});

/* ================= BUILD PANEL ================= */

function buildPanel() {

  const users = Object.entries(data)
    .filter(([id]) => !id.startsWith("_"));

  const total = users.length;

  const sorted = users.sort((a, b) => b[1].streak - a[1].streak);

  const leaderboard = sorted.slice(0, 10)
    .map((u, i) => {
      const medal =
        i === 0 ? "🥇" :
        i === 1 ? "🥈" :
        i === 2 ? "🥉" : `**${i+1}.**`;

      return `${medal} <@${u[0]}> — ${u[1].streak} ⏣`;
    })
    .join("\n") || "Belum ada data";

  return new EmbedBuilder()
    .setTitle("🌙 CSBK DAILY LOGIN SYSTEM")
    .setDescription(`
👥 Total member: **${total}**
⏳ Sisa hari bulan: **${getRemainingDays()} hari**

━━━━━━━━━━━━━━━━━━

🏆 **Leaderboard**
${leaderboard}

━━━━━━━━━━━━━━━━━━

💎 1 hari login = 1⏣  
💬 Chat 5x → 📅 Hadir  

🎯 Login sampai akhir bulan  
🎁 Claim hanya di hari terakhir  

⚠️ Skip 1 hari → reset ke 0  

━━━━━━━━━━━━━━━━━━

🔥 Jangan sampai streak putus!
`)
    .setColor("Gold");
}

/* ================= BUTTON ================= */

function buildButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("login")
      .setLabel("📅 Hadir")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("claim")
      .setLabel("💰 Claim")
      .setStyle(ButtonStyle.Primary)
  );
}

/* ================= UPDATE PANEL ================= */

async function updatePanel() {
  if (!data._panel) return;

  try {
    const channel = await client.channels.fetch(data._panel.channelId);
    const msg = await channel.messages.fetch(data._panel.messageId);

    await msg.edit({
      embeds: [buildPanel()],
      components: [buildButtons()]
    });

  } catch {}
}

/* ================= BUTTON HANDLER ================= */

client.on("interactionCreate", async (i) => {

  if (!i.isButton()) return;

  await i.deferReply({ ephemeral: true }); // 🔥 FIX ERROR

  checkNewMonth();

  const user = getUser(i.user.id);
  const today = getToday();

  /* LOGIN */
  if (i.customId === "login") {

    if (user.chatCount < 5)
      return i.editReply(`❌ Chat dulu 5x (${user.chatCount}/5)`);

    if (user.lastLogin === today)
      return i.editReply("❌ Sudah login hari ini");

    if (user.lastLogin) {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const yesterday = y.toISOString().slice(0, 10);

      if (user.lastLogin !== yesterday) {
        user.streak = 0;
        user.claimed = false;
      }
    }

    user.streak++;
    user.lastLogin = today;

    save();
    updatePanel();

    return i.editReply(`🔥 Login berhasil! Streak: ${user.streak}`);
  }

  /* CLAIM */
  if (i.customId === "claim") {

    if (!isLastDay())
      return i.editReply("❌ Claim hanya bisa di hari terakhir");

    if (user.lastLogin !== today)
      return i.editReply("❌ Login dulu hari ini");

    if (user.streak <= 0)
      return i.editReply("❌ Tidak ada reward");

    const reward = user.streak;

    user.streak = 0;
    user.claimed = true;

    save();
    updatePanel();

    return i.editReply(`🎉 Kamu dapat ${reward} Robux`);
  }
});

/* ================= OWNER ================= */

client.on("messageCreate", (msg) => {

  if (msg.author.id !== ADMIN_ID) return;

  if (msg.content === "!resetall") {

    for (const id in data) {
      if (id.startsWith("_")) continue;

      data[id] = {
        streak: 0,
        lastLogin: null,
        chatCount: 0,
        lastChatDay: null,
        claimed: false
      };
    }

    save();
    updatePanel();

    msg.reply("✅ Semua user di reset");
  }
});

/* ================= READY ================= */

client.once("ready", () => {
  console.log("BOT ONLINE 🔥");

  checkNewMonth();

  setInterval(() => {
    checkNewMonth();
    updatePanel();
  }, 60000);
});

client.login(TOKEN);