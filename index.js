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
  data._config = { targetDays: 30 };
  save();
}

function save() {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function getTarget() {
  return data._config.targetDays;
}

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

/* ================= TIME ================= */

function getToday() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta"
  });
}

function getResetCountdown() {
  const now = new Date();
  const jakarta = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));

  const tomorrow = new Date(jakarta);
  tomorrow.setHours(24, 0, 0, 0);

  const diff = tomorrow - jakarta;

  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);

  return `${h}j ${m}m`;
}

/* ================= BAR ================= */

function bar(val, max) {
  const size = 10;
  const filled = Math.round((val / max) * size);
  return "🟩".repeat(filled) + "⬜".repeat(size - filled);
}

/* ================= CHAT ================= */

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
    .filter(([id]) => id !== "_config" && id !== "_panel");

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
⏳ Reset Harian: **${getResetCountdown()} lagi**

━━━━━━━━━━━━━━━━━━

🏆 **Leaderboard**
${leaderboard}

━━━━━━━━━━━━━━━━━━

💎 1 hari login = 1⏣  

💬 Chat **5x dulu**, lalu tekan tombol **📅 Hadir**

🎯 Kumpulkan login sampai **akhir bulan (${getTarget()} hari)**  
🎁 Tombol **💰 Claim** hanya bisa ditekan di hari terakhir (akhir bulan)

⚠️ Jika tidak login 1 hari → reward di reset ke 0

━━━━━━━━━━━━━━━━━━
`)
    .setColor("Gold");
}

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

  } catch (err) {
    console.log("Panel error:", err.message);
  }
}

/* ================= BUTTON ================= */

client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;

  const user = getUser(i.user.id);
  const today = getToday();

  /* LOGIN */
  if (i.customId === "login") {

    if (user.chatCount < 5)
      return i.reply({ content: `❌ Chat dulu 5x (${user.chatCount}/5)`, ephemeral: true });

    if (user.lastLogin === today)
      return i.reply({ content: "❌ Sudah login hari ini", ephemeral: true });

    if (user.lastLogin) {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const yesterday = y.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

      if (user.lastLogin !== yesterday) {
        user.streak = 0;
        user.claimed = false;
      }
    }

    user.streak++;
    user.lastLogin = today;

    save();
    updatePanel();

    return i.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("✅ LOGIN BERHASIL")
          .setDescription(`
🔥 ${user.streak}/${getTarget()}
${bar(user.streak, getTarget())}
`)
          .setColor("Green")
      ],
      ephemeral: true
    });
  }

  /* CLAIM (AKHIR BULAN ONLY) */
  if (i.customId === "claim") {

    if (user.lastLogin !== today)
      return i.reply({
        content: "❌ Kamu harus login hari ini dulu",
        ephemeral: true
      });

    if (user.streak < getTarget())
      return i.reply({
        content: `❌ Claim hanya bisa di hari terakhir (${getTarget()} hari)`,
        ephemeral: true
      });

    if (user.claimed)
      return i.reply({
        content: "❌ Sudah claim",
        ephemeral: true
      });

    const reward = user.streak;

    user.claimed = true;

    /* RESET */
    user.streak = 0;
    user.chatCount = 0;
    user.lastLogin = null;

    save();
    updatePanel();

    return i.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🎉 CLAIM BERHASIL")
          .setDescription(`💰 Kamu mendapatkan ${reward} Robux`)
          .setColor("Gold")
      ]
    });
  }
});

/* ================= OWNER ================= */

client.on("messageCreate", (msg) => {

  if (msg.author.id !== ADMIN_ID) return;

  if (msg.content.startsWith("!settarget")) {
    const num = parseInt(msg.content.split(" ")[1]);
    if (isNaN(num)) return;

    data._config.targetDays = num;
    save();
    updatePanel();
  }

  if (msg.content.startsWith("!reset")) {
    const user = msg.mentions.users.first();
    if (!user) return;

    data[user.id] = {
      streak: 0,
      lastLogin: null,
      chatCount: 0,
      lastChatDay: null,
      claimed: false
    };

    save();
    updatePanel();
  }

});

/* ================= READY ================= */

client.once("ready", () => {
  console.log("BOT ONLINE 🔥");

  setInterval(updatePanel, 60000);
});

client.login(TOKEN);