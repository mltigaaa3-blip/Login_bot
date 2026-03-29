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

/* GANTI INI SAJA */
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

/* ===== INIT STORAGE ===== */

if (!fs.existsSync("/data")) fs.mkdirSync("/data");

if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE, JSON.stringify({}));
}

let data = JSON.parse(fs.readFileSync(FILE));

if (!data._config) {
  data._config = {
    targetDays: 30
  };
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

/* ================= WIB ================= */

function getToday() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta"
  });
}

/* ================= BAR ================= */

function bar(val, max) {
  const size = 10;
  const filled = Math.round((val / max) * size);
  return "🟩".repeat(filled) + "⬜".repeat(size - filled);
}

/* ================= CHAT ================= */

client.on("messageCreate", async (msg) => {
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

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("login")
        .setLabel("📅 Hadir")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("claim")
        .setLabel("💰 Claim")
        .setStyle(ButtonStyle.Primary)
    );

    const embed = new EmbedBuilder()
      .setTitle("🌙 SISTEM LOGIN CSBK")
      .setDescription(`
💬 Chat **5x di https://discord.com/channels/1437072658675269644/1437072659585175564**
📅 Klik **Hadir**
🔥 Jaga streak sampai ${getTarget()} hari ( reward di transfer tiap akhir bulan )

━━━━━━━━━━━━━━━━━━

💰 Reward:
1 Hari = 1 Robux  

━━━━━━━━━━━━━━━━━━

⚠️ Aturan:
• Reset jam 00:00 WIB  
• Telat = reward di ulang  

━━━━━━━━━━━━━━━━━━

🔥 Klik tombol di bawah!
`)
      .setColor("Gold");

    msg.channel.send({ embeds: [embed], components: [row] });
  }

});

/* ================= BUTTON ================= */

client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;

  try {

    const user = getUser(i.user.id);
    const today = getToday();

    /* LOGIN */
    if (i.customId === "login") {

      if (user.chatCount < 5)
        return i.reply({
          content: `❌ Chat dulu 5x (${user.chatCount}/5)`,
          ephemeral: true
        });

      if (user.lastLogin === today)
        return i.reply({
          content: "❌ Sudah login hari ini",
          ephemeral: true
        });

      if (user.lastLogin) {
        const y = new Date(today);
        y.setDate(y.getDate() - 1);
        const yesterday = y.toLocaleDateString("en-CA", {
          timeZone: "Asia/Jakarta"
        });

        if (user.lastLogin !== yesterday) {
          user.streak = 0;
          user.claimed = false;
        }
      }

      user.streak++;
      user.lastLogin = today;

      save();

      return i.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("✅ LOGIN BERHASIL")
            .setDescription(`
🔥 Streak: **${user.streak}/${getTarget()}**

${bar(user.streak, getTarget())}

💰 Robux: ${user.streak}
`)
            .setColor("Green")
        ],
        ephemeral: true
      });
    }

    /* CLAIM */
    if (i.customId === "claim") {

      if (user.streak < getTarget())
        return i.reply({
          content: `❌ Belum cukup (${user.streak}/${getTarget()})`,
          ephemeral: true
        });

      if (user.claimed)
        return i.reply({
          content: "❌ Sudah claim",
          ephemeral: true
        });

      user.claimed = true;
      save();

      return i.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🎉 CLAIM BERHASIL")
            .setDescription(`💰 Kamu dapat ${getTarget()} Robux`)
            .setColor("Gold")
        ]
      });
    }

  } catch (err) {
    console.log(err);
  }
});

/* ================= LEADERBOARD ================= */

client.on("messageCreate", async (msg) => {

  if (msg.content === "!lb") {

    const sorted = Object.entries(data)
      .filter(([id]) => id !== "_config")
      .sort((a, b) => b[1].streak - a[1].streak)
      .slice(0, 10);

    let text = "";

    for (let i = 0; i < sorted.length; i++) {
      const [id, u] = sorted[i];
      text += `**${i + 1}.** <@${id}> — ${u.streak} hari\n`;
    }

    const embed = new EmbedBuilder()
      .setTitle("🏆 LEADERBOARD STREAK")
      .setDescription(text || "Kosong")
      .setColor("Blue");

    msg.channel.send({ embeds: [embed] });
  }

});

/* ================= OWNER ================= */

client.on("messageCreate", async (msg) => {

  if (msg.author.id !== ADMIN_ID) return;

  if (msg.content.startsWith("!reset")) {
    const user = msg.mentions.users.first();
    if (!user) return msg.reply("Tag user");

    data[user.id] = {
      streak: 0,
      lastLogin: null,
      chatCount: 0,
      lastChatDay: null,
      claimed: false
    };

    save();
    msg.reply("✅ Reset");
  }

  if (msg.content.startsWith("!settarget")) {
    const num = parseInt(msg.content.split(" ")[1]);

    if (isNaN(num)) return msg.reply("Masukkan angka");

    data._config.targetDays = num;
    save();

    msg.reply(`✅ Target jadi ${num} hari`);
  }

  if (msg.content === "!backup") {
    msg.channel.send({
      content: "💾 Backup",
      files: ["./data_login.json"]
    });
  }

});

/* ================= READY ================= */

client.once("ready", () => {
  console.log("BOT ONLINE 🔥");
});

client.login(TOKEN);