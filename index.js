
require("dotenv").config();
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

/* GANTI INI */
const CHAT_CHANNEL_ID = "ISI_CHANNEL_CHAT_KAMU";

/* TARGET WINSTREAK */
let TARGET_DAYS = 30;

/* ================= CLIENT ================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* ================= DATABASE ================= */

const FILE = "./data_login.json";

if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE, JSON.stringify({}));
}

let data = JSON.parse(fs.readFileSync(FILE));

function save() {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
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

/* ================= CHAT TRACK ================= */

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (msg.channel.id !== CHAT_CHANNEL_ID) return;

  const user = getUser(msg.author.id);
  const today = getToday();

  if (user.lastChatDay !== today) {
    user.chatCount = 0;
    user.lastChatDay = today;
  }

  user.chatCount += 1;
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
      .setTitle("🌙 SISTEM LOGIN HARIAN CSBK")
      .setDescription(`
🎯 **Cara Main:**
• Chat **5x** di channel
• Klik tombol **Hadir**
• Jaga streak sampai selesai

━━━━━━━━━━━━━━━━━━

💰 **Reward:**
1 Hari = 1 Robux  
Target = ${TARGET_DAYS} hari  

━━━━━━━━━━━━━━━━━━

⚠️ **Aturan:**
• Harus chat dulu  
• Reset jam 00:00 WIB  
• Telat 1 hari → ulang  

━━━━━━━━━━━━━━━━━━

🔥 Klik tombol di bawah!
`)
      .setColor("Gold")
      .setFooter({ text: "CSBK System" })
      .setTimestamp();

    msg.channel.send({
      embeds: [embed],
      components: [row]
    });
  }
});

/* ================= BUTTON ================= */

client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;

  try {

    const user = getUser(i.user.id);
    const today = getToday();

    /* ===== LOGIN ===== */

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

      /* cek streak */
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

      user.streak += 1;
      user.lastLogin = today;

      save();

      return i.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("✅ LOGIN BERHASIL")
            .setDescription(`
🔥 Streak: **${user.streak}/${TARGET_DAYS}**

${bar(user.streak, TARGET_DAYS)}

💰 Total Robux: ${user.streak}

${user.streak === TARGET_DAYS - 1 ? "⚠️ Besok terakhir!" : ""}
`)
            .setColor("Green")
        ],
        ephemeral: true
      });
    }

    /* ===== CLAIM ===== */

    if (i.customId === "claim") {

      if (user.streak < TARGET_DAYS)
        return i.reply({
          content: `❌ Belum cukup (${user.streak}/${TARGET_DAYS})`,
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
            .setDescription(`
💰 Kamu dapat **${TARGET_DAYS} Robux**

📩 Hubungi admin untuk pencairan
`)
            .setColor("Gold")
        ]
      });
    }

  } catch (err) {
    console.log(err);
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
    return msg.reply("✅ Reset berhasil");
  }

  if (msg.content.startsWith("!settarget")) {
    const num = parseInt(msg.content.split(" ")[1]);
    if (isNaN(num)) return msg.reply("Masukkan angka");

    TARGET_DAYS = num;
    return msg.reply(`✅ Target jadi ${num} hari`);
  }

  if (msg.content === "!backup") {
    msg.channel.send({
      content: "💾 Backup:",
      files: ["./data_login.json"]
    });
  }
});

/* ================= READY ================= */

client.once("ready", () => {
  console.log("BOT ONLINE 🔥");
});

client.login(TOKEN);