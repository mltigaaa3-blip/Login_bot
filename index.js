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

/* TARGET WINSTREAK (BISA KAMU UBAH) */
let TARGET_DAYS = 30;

/* ================= CLIENT ================= */

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
]
});

/* ================= DATABASE ================= */

const FILE = "/data/data_login.json";

if (!fs.existsSync("/data")) fs.mkdirSync("/data");

if (!fs.existsSync("/data/data_login.json")) {
  fs.writeFileSync("/data/data_login.json", JSON.stringify({}));
}

let data = fs.existsSync(FILE)
?JSON.parse(fs.readFileSync(FILE))
:{};

function save(){
fs.writeFileSync(FILE, JSON.stringify(data,null,2));
}

function getUser(id){
if(!data[id]){
data[id]={
streak:0,
lastLogin:null,
chatCount:0,
lastChatDay:null,
claimed:false
};
}
return data[id];
}

/* ================= WIB TIME ================= */

function getToday(){
const now = new Date();
now.setHours(now.getHours()+7);
return now.toISOString().slice(0,10);
}

/* ================= PROGRESS BAR ================= */

function bar(val,max){
const size=10;
const filled=Math.round((val/max)*size);
return "🟩".repeat(filled)+"⬜".repeat(size-filled);
}

/* ================= CHAT TRACK ================= */

client.on("messageCreate", async msg=>{

if(msg.author.bot) return;
if(msg.channel.id !== CHAT_CHANNEL_ID) return;

const user = getUser(msg.author.id);
const today = getToday();

if(user.lastChatDay !== today){
user.chatCount = 0;
user.lastChatDay = today;
}

user.chatCount += 1;

save();

});

/* ================= PANEL ================= */

client.on("messageCreate", async msg=>{

if(msg.content === "!panel"){

if(msg.author.id !== ADMIN_ID)
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
.setTitle("🌙 SISTEM LOGIN RAMADHAN CSBK")
.setDescription(`
🎯 **Cara Bermain:**

💬 Chat minimal **5x** di channel  
📅 Klik tombol **Hadir**  
🔥 Kumpulkan winstreak sampai **${TARGET_DAYS} hari**

━━━━━━━━━━━━━━━━━━

💰 **Reward:**
1 Hari = 1 Robux  
${TARGET_DAYS} Hari = ${TARGET_DAYS} Robux

━━━━━━━━━━━━━━━━━━

⚠️ **Aturan:**
• Harus chat dulu sebelum login  
• Reset setiap 00:00 WIB  
• Jika telat 1 hari → ulang dari awal  

━━━━━━━━━━━━━━━━━━

Klik tombol di bawah!
`)
.setColor("Gold")
.setFooter({text:"CSBK Daily System"})
.setTimestamp();

msg.channel.send({embeds:[embed],components:[row]});

}

});

/* ================= BUTTON ================= */

client.on("interactionCreate", async i=>{

if(!i.isButton()) return;

const user = getUser(i.user.id);
const today = getToday();

/* ===== LOGIN ===== */

if(i.customId === "login"){

if(user.chatCount < 5)
return i.reply({
content:`❌ Kamu harus chat **5x dulu** (sekarang ${user.chatCount}/5)`,
ephemeral:true
});

if(user.lastLogin === today)
return i.reply({
content:"❌ Sudah login hari ini",
ephemeral:true
});

/* cek streak */
if(user.lastLogin){

const y = new Date(today);
y.setDate(y.getDate()-1);
const yesterday = y.toISOString().slice(0,10);

if(user.lastLogin !== yesterday){
user.streak = 0;
}
}

user.streak += 1;
user.lastLogin = today;

save();

return i.reply({
embeds:[
new EmbedBuilder()
.setTitle("✅ LOGIN BERHASIL")
.setDescription(`
🔥 Streak: **${user.streak}/${TARGET_DAYS}**

${bar(user.streak,TARGET_DAYS)}

💰 Robux terkumpul: ${user.streak}

${user.streak === TARGET_DAYS-1 ? "⚠️ Besok terakhir!" : ""}
`)
.setColor("Green")
],
ephemeral:true
});

}

/* ===== CLAIM ===== */

if(i.customId === "claim"){

if(user.streak < TARGET_DAYS)
return i.reply({
content:`❌ Belum cukup (${user.streak}/${TARGET_DAYS})`,
ephemeral:true
});

if(user.claimed)
return i.reply({
content:"❌ Sudah claim",
ephemeral:true
});

user.claimed = true;
save();

return i.reply({
embeds:[
new EmbedBuilder()
.setTitle("🎉 CLAIM BERHASIL")
.setDescription(`
💰 Kamu mendapatkan **${TARGET_DAYS} Robux**

📩 Hubungi admin untuk pencairan
`)
.setColor("Gold")
]
});

}

});

/* ================= OWNER CONTROL ================= */

client.on("messageCreate", async msg=>{

if(msg.author.id !== ADMIN_ID) return;

/* reset */
if(msg.content.startsWith("!reset")){

const user = msg.mentions.users.first();
if(!user) return msg.reply("Tag user");

data[user.id]={
streak:0,
lastLogin:null,
chatCount:0,
lastChatDay:null,
claimed:false
};

save();

return msg.reply("✅ Reset berhasil");
}

/* set target */
if(msg.content.startsWith("!settarget")){

const num = parseInt(msg.content.split(" ")[1]);
if(isNaN(num)) return msg.reply("Masukkan angka");

TARGET_DAYS = num;

return msg.reply(`✅ Target diubah ke ${num} hari`);
}

});

client.on("messageCreate", async (msg) => {

  if (msg.author.id !== ADMIN_ID) return;

  if (msg.content === "!backup") {
    msg.channel.send({
      content: "💾 Backup:",
      files: ["/data/data_login.json"]
    });
  }

});

/* ================= READY ================= */

client.once("ready", ()=>{
console.log("BOT ONLINE 🔥");
});

client.login(process.env.TOKEN);