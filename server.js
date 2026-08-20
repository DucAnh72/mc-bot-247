const mineflayer = require("mineflayer");
const express = require("express");
const https = require("https");

// --- 1. TẠO WEB SERVER ĐỂ KEEP-ALIVE TRÊN RAILWAY ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send("Bot Minecraft đang chạy 24/7!");
});

app.listen(PORT, () => {
    console.log(`[Web] Server HTTP đang chạy tại port ${PORT}`);
});

// --- 2. CẤU HÌNH BIẾN MÔI TRƯỜNG (ENVIRONMENT VARIABLES) ---
const config = {
    host: process.env.MC_HOST || "localhost",
    port: parseInt(process.env.MC_PORT) || 25565,
    username: process.env.MC_USERNAME || "Bot247",
    botPassword: process.env.MC_PASSWORD || "password123",
    version: process.env.MC_VERSION || false,
    respawn: true,
    webhookUrl: process.env.DISCORD_WEBHOOK || ""
};

let bot_args = {
    host: config.host,
    port: config.port,
    username: config.username,
    version: config.version,
    respawn: config.respawn
};

let reconnecting = false;
let reportInterval = null;
let startTime = null;

function getUptimeString() {
    if (!startTime) return "0 phút";
    const diffMs = Date.now() - startTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    return diffHours > 0 ? `${diffHours} giờ ${diffMins % 60} phút` : `${diffMins} phút`;
}

function sendDiscordWebhook(content) {
    if (!config.webhookUrl || config.webhookUrl.trim() === "") return;

    const data = JSON.stringify({
        username: config.username,
        content: content
    });

    try {
        const url = new URL(config.webhookUrl.trim());
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            if (res.statusCode >= 400) console.error(`[!] Discord Webhook lỗi: ${res.statusCode}`);
        });
        req.on('error', (err) => console.error('[!] Lỗi Webhook:', err));
        req.write(data);
        req.end();
    } catch (e) {
        console.error('[!] URL Webhook không hợp lệ.');
    }
}

function start_bot() {
    const bot = mineflayer.createBot(bot_args);

    bot.on('login', () => {
        console.log('[+] Logged in');
        // Tự động gửi lệnh đăng nhập mỗi khi join
        setTimeout(() => {
            bot.chat(`/dn ${config.botPassword}`);
            console.log('[+] Đã gửi lệnh đăng nhập /dn');
        }, 2000);
    });

    bot.on('spawn', () => {
        console.log("[+] Đăng nhập game thành công");
        if (!startTime) startTime = Date.now();

        sendDiscordWebhook(`🟢 **${config.username}** đã kết nối thành công vào server!`);

        clearInterval(reportInterval);
        reportInterval = setInterval(() => {
            const uptime = getUptimeString();
            const statusMsg = `📈 **[BÁO CÁO ĐỊNH KỲ]**\n👤 Bot: **${config.username}**\n⏱️ Uptime: \`${uptime}\`\n❤️ Máu: \`${Math.round(bot.health || 20)}\` | 🍖 Thức ăn: \`${Math.round(bot.food || 20)}\``;
            sendDiscordWebhook(statusMsg);
        }, 300000);
    });

    bot.on('entityHurt', (entity) => {
        if (entity === bot.entity) {
            sendDiscordWebhook(`⚠️ **[CẢNH BÁO]** **${config.username}** đang nhận sát thương!`);
        }
    });

    bot.on('death', () => {
        sendDiscordWebhook(`💀 **${config.username}** đã chết! Đang chờ hồi sinh...`);
        setTimeout(() => bot.respawn(), Math.floor(Math.random() * 5000) + 2000);
    });

    bot.on('kicked', (reason) => {
        let reasonClean = typeof reason === 'object' ? JSON.stringify(reason) : reason;
        sendDiscordWebhook(`🛑 **[BỊ KICK]** Lý do: \`${reasonClean}\``);
    });

    bot.on('windowOpen', (window) => {
        setTimeout(() => {
            bot.clickWindow(24, 0, 0);
            console.log('[+] Đang Vào KingSMP');
        }, 2653);
    });

    bot.on('end', () => {
        clearInterval(reportInterval);
        if (reconnecting) return;
        reconnecting = true;
        
        sendDiscordWebhook(`⚠️ **${config.username}** bị ngắt kết nối. Đang kết nối lại sau 5s...`);
        startTime = null;

        setTimeout(() => {
            reconnecting = false;
            start_bot();
        }, 5000);
    });
}

start_bot();