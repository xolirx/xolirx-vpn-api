import express from "express"
import cors from "cors"
import fs from "fs"
import path from "path"
import crypto from "crypto"

const app = express()

app.use(cors())
app.use(express.json({ limit: "50mb" }))

const PORT = process.env.PORT || 3000
const ADMIN_KEY = process.env.ADMIN_KEY || "xolirx2024"

const DATA_DIR = path.join(process.cwd(), "data")
const VPN_FILE = path.join(DATA_DIR, "vpn.txt")
const USERS_FILE = path.join(DATA_DIR, "users.json")
const DEVICES_FILE = path.join(DATA_DIR, "devices.json")

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR)
if (!fs.existsSync(VPN_FILE)) fs.writeFileSync(VPN_FILE, "", "utf-8")
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]", "utf-8")
if (!fs.existsSync(DEVICES_FILE)) fs.writeFileSync(DEVICES_FILE, "{}", "utf-8")

function loadUsers() { return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8")) }
function saveUsers(users) { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8") }
function loadDevices() { return JSON.parse(fs.readFileSync(DEVICES_FILE, "utf-8")) }
function saveDevices(devices) { fs.writeFileSync(DEVICES_FILE, JSON.stringify(devices, null, 2), "utf-8") }
function generateToken() { return crypto.randomBytes(16).toString("hex") }

function getDeviceFingerprint(req) {
    const ua = req.headers["user-agent"] || "Unknown"
    const ip = req.ip || req.headers["x-forwarded-for"] || "Unknown"
    return crypto.createHash("md5").update(ua + ip).digest("hex")
}

app.post("/api/create-subscription", (req, res) => {
    try {
        const fingerprint = getDeviceFingerprint(req)
        const devices = loadDevices()
        
        if (devices[fingerprint]) {
            const existingToken = devices[fingerprint]
            const users = loadUsers()
            const existingUser = users.find(u => u.token === existingToken)
            
            if (existingUser && existingUser.active) {
                const now = new Date()
                const expiresAt = new Date(existingUser.expires_at)
                const isExpired = now > expiresAt
                if (!isExpired) {
                    return res.json({ success: false, error: "active_subscription", token: existingToken })
                }
            }
        }
        
        const users = loadUsers()
        const token = generateToken()
        const expires_at = new Date()
        expires_at.setDate(expires_at.getDate() + 7)
        
        users.push({
            token: token,
            active: true,
            created_at: new Date().toISOString(),
            expires_at: expires_at.toISOString(),
            total_requests: 0,
            last_ip: req.ip || req.headers["x-forwarded-for"] || "Unknown",
            last_seen: new Date().toISOString(),
            user_agent: req.headers["user-agent"] || "Unknown"
        })
        saveUsers(users)
        
        devices[fingerprint] = token
        saveDevices(devices)
        
        res.json({ success: true, token: token })
    } catch (error) {
        res.json({ success: false, error: error.message })
    }
})

app.get("/api/user-info/:token", (req, res) => {
    try {
        const token = req.params.token
        const users = loadUsers()
        const user = users.find(u => u.token === token)
        if (!user) return res.json({ success: false, error: "User not found" })
        
        const now = new Date()
        const expiresAt = new Date(user.expires_at)
        const daysLeft = Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)))
        const createdDate = new Date(user.created_at)
        const totalDays = Math.ceil((expiresAt - createdDate) / (1000 * 60 * 60 * 24))
        const usedDays = totalDays - daysLeft
        
        res.json({
            success: true,
            token: user.token,
            active: user.active && !(now > expiresAt),
            daysLeft: daysLeft,
            totalDays: totalDays,
            usedDays: usedDays,
            expires_at: user.expires_at,
            total_requests: user.total_requests || 0,
            created_at: user.created_at,
            last_ip: user.last_ip || "Unknown",
            last_seen: user.last_seen
        })
    } catch (error) {
        res.json({ success: false, error: error.message })
    }
})

app.get("/api/admin/users", (req, res) => {
    const key = req.query.key
    if (key !== ADMIN_KEY) return res.json({ success: false, error: "Unauthorized" })
    
    const users = loadUsers()
    const now = new Date()
    const usersWithInfo = users.map(user => {
        const expiresAt = new Date(user.expires_at)
        const daysLeft = Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)))
        return {
            token: user.token,
            active: user.active,
            daysLeft: daysLeft,
            isExpired: now > expiresAt,
            total_requests: user.total_requests || 0,
            last_ip: user.last_ip || "Unknown"
        }
    })
    res.json({ success: true, users: usersWithInfo })
})

app.post("/api/admin/create-user", (req, res) => {
    const { days, key } = req.body
    if (key !== ADMIN_KEY) return res.status(403).json({ error: "Unauthorized" })
    const users = loadUsers()
    const token = generateToken()
    const expires_at = new Date()
    expires_at.setDate(expires_at.getDate() + (days || 7))
    users.push({ token, active: true, created_at: new Date().toISOString(), expires_at: expires_at.toISOString(), total_requests: 0, last_ip: null, last_seen: null })
    saveUsers(users)
    res.json({ success: true, token })
})

app.post("/api/admin/disable", (req, res) => {
    const { token, key } = req.body
    if (key !== ADMIN_KEY) return res.status(403).json({ error: "Unauthorized" })
    const users = loadUsers()
    const user = users.find(u => u.token === token)
    if (user) user.active = false
    saveUsers(users)
    res.json({ success: true })
})

app.post("/api/admin/enable", (req, res) => {
    const { token, days, key } = req.body
    if (key !== ADMIN_KEY) return res.status(403).json({ error: "Unauthorized" })
    const users = loadUsers()
    const user = users.find(u => u.token === token)
    if (user) {
        const newExpiry = new Date()
        newExpiry.setDate(newExpiry.getDate() + (days || 7))
        user.expires_at = newExpiry.toISOString()
        user.active = true
    }
    saveUsers(users)
    res.json({ success: true })
})

app.post("/api/admin/extend", (req, res) => {
    const { token, days, key } = req.body
    if (key !== ADMIN_KEY) return res.status(403).json({ error: "Unauthorized" })
    const users = loadUsers()
    const user = users.find(u => u.token === token)
    if (user) {
        const currentExpiry = new Date(user.expires_at)
        const now = new Date()
        const newExpiry = new Date(Math.max(currentExpiry.getTime(), now.getTime()))
        newExpiry.setDate(newExpiry.getDate() + (days || 7))
        user.expires_at = newExpiry.toISOString()
        user.active = true
    }
    saveUsers(users)
    res.json({ success: true })
})

app.post("/api/admin/extend-all", (req, res) => {
    const { days, key } = req.body
    if (key !== ADMIN_KEY) return res.status(403).json({ error: "Unauthorized" })
    const users = loadUsers()
    const now = new Date()
    for (const user of users) {
        if (user.active) {
            const currentExpiry = new Date(user.expires_at)
            const newExpiry = new Date(Math.max(currentExpiry.getTime(), now.getTime()))
            newExpiry.setDate(newExpiry.getDate() + (days || 7))
            user.expires_at = newExpiry.toISOString()
        }
    }
    saveUsers(users)
    res.json({ success: true })
})

app.get("/sub/:token", async (req, res) => {
    try {
        const token = req.params.token
        const users = loadUsers()
        const user = users.find(x => x.token === token)
        
        if (!user) {
            return res.redirect("https://xolirx-vpn.vercel.app/")
        }
        
        const now = new Date()
        const expiresAt = new Date(user.expires_at)
        const isExpired = now > expiresAt
        
        if (!user.active || isExpired) {
            return res.redirect("https://xolirx-vpn.vercel.app/")
        }
        
        user.last_ip = req.ip || req.headers['x-forwarded-for'] || 'Unknown'
        user.last_seen = new Date().toISOString()
        user.total_requests = (user.total_requests || 0) + 1
        saveUsers(users)
        
        const daysLeft = Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)))
        const expireTimestamp = Math.floor(expiresAt.getTime() / 1000)
        
        // Читаем vpn.txt
        let vpnContent = fs.readFileSync(VPN_FILE, "utf-8")
        
        // Удаляем дублирующиеся заголовки из vpn.txt если они там есть
        const lines = vpnContent.split("\n")
        const cleanLines = lines.filter(line => {
            return !line.startsWith("#profile-title") &&
                   !line.startsWith("#profile-update-interval") &&
                   !line.startsWith("#subscription-userinfo") &&
                   !line.startsWith("#support-url") &&
                   !line.startsWith("#profile-web-page-url") &&
                   !line.startsWith("#announce")
        })
        const cleanVpnContent = cleanLines.join("\n").trim()
        
        const userAgent = req.headers["user-agent"] || ""
        const isApp = userAgent.includes("Happ") || 
                      userAgent.includes("v2rayNG") || 
                      userAgent.includes("Nekobox") ||
                      userAgent.includes("Clash") ||
                      userAgent.includes("Shadowrocket") ||
                      userAgent.includes("Sing-box") ||
                      userAgent.includes("FlClash") ||
                      userAgent.toLowerCase().includes("clash")
        
        if (isApp) {
            // Формируем правильный ответ для приложения
            res.setHeader("Content-Type", "text/plain; charset=utf-8")
            res.setHeader("Profile-Title", "XolirX VPN")
            res.setHeader("Subscription-Userinfo", `upload=0; download=0; total=0; expire=${expireTimestamp}`)
            res.setHeader("Profile-Update-Interval", "1")
            res.setHeader("Support-Url", "https://t.me/xolirx")
            
            let result = `#profile-title: XolirX VPN\n`
            result += `#profile-update-interval: 1\n`
            result += `#subscription-userinfo: upload=0; download=0; total=0; expire=${expireTimestamp}\n`
            result += `#support-url: https://t.me/xolirx\n`
            result += `#announce: Бесплатный VLESS | Обход ограничений | Только VLESS\n\n`
            
            if (cleanVpnContent && cleanVpnContent.length > 0) {
                result += cleanVpnContent
            } else {
                result += "# Нет доступных серверов\n# Обновите подписку позже\n"
            }
            
            return res.send(result)
        }
        
        // ДЛЯ БРАУЗЕРА - КРАСИВАЯ СТРАНИЦА
        const subscriptionUrl = `https://xolirx-vpn-api.onrender.com/sub/${token}`
        const totalDays = 7
        const usedDays = totalDays - daysLeft
        const percent = (daysLeft / totalDays) * 100
        
        const serverLines = cleanVpnContent.split("\n").filter(l => l.startsWith("vless://"))
        const serversHtml = `<div style="margin-top:20px;padding-top:16px;border-top:1px solid #1f2230;"><h3>ДОСТУПНЫЕ СЕРВЕРА (${serverLines.length})</h3><div style="color:#888;font-size:10px;word-break:break-all;">${serverLines.slice(0,5).map(l => l.substring(0, 80) + "...").join("<br>")}</div></div>`
        
        const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>XolirX VPN</title>
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{background:#0a0c10;font-family:monospace;color:#fff;padding:40px 20px;}
.container{max-width:700px;margin:0 auto;}
.card{background:#14161c;border:1px solid #1f2230;border-radius:16px;padding:32px;margin-bottom:20px;}
h1{font-size:24px;margin-bottom:8px;}
.text-secondary{color:#888;font-size:12px;}
.key-box{background:#0a0c10;padding:16px;border-radius:8px;font-size:11px;word-break:break-all;margin:16px 0;border:1px solid #1f2230;}
.flex-row{display:flex;gap:12px;flex-wrap:wrap;margin:20px 0;}
.btn{background:transparent;border:1px solid #fff;color:#fff;padding:12px 24px;font-family:monospace;font-size:12px;cursor:pointer;text-decoration:none;display:inline-block;}
.btn:hover{background:#fff;color:#000;}
.btn-accent{background:#fff;color:#000;border:none;}
.qr-container{text-align:center;margin:20px 0;}
.qr-container canvas{background:#fff;padding:12px;border-radius:12px;}
hr{border-color:#1f2230;margin:20px 0;}
.stats{display:flex;gap:20px;margin:20px 0;flex-wrap:wrap;}
.stat-value{font-size:28px;font-weight:bold;}
.stat-label{color:#888;font-size:10px;}
.progress-bar{background:#1f2230;height:4px;border-radius:4px;margin:16px 0;}
.progress-fill{background:#fff;height:100%;border-radius:4px;width:${percent}%;}
.footer{text-align:center;color:#888;font-size:10px;margin-top:40px;}
</style>
</head>
<body>
<div class="container">
<div class="card">
<h1>XOLIRX VPN</h1>
<p class="text-secondary">ПЕРСОНАЛЬНАЯ ПОДПИСКА</p>
<div class="key-box" id="subUrl">${subscriptionUrl}</div>
<div class="flex-row">
<button class="btn btn-accent" id="copyBtn">КОПИРОВАТЬ ССЫЛКУ</button>
<button class="btn" id="happBtn">ДОБАВИТЬ В HAPP</button>
<a href="https://xolirx-vpn.vercel.app/?token=${token}" class="btn">ПАНЕЛЬ УПРАВЛЕНИЯ</a>
</div>
<div class="qr-container"><div id="qrcode"></div><p class="text-secondary" style="margin-top:12px;">QR-КОД ДЛЯ ПОДПИСКИ</p></div>
<hr>
<div class="stats">
<div><div class="stat-value">${daysLeft}</div><div class="stat-label">ДНЕЙ</div></div>
<div><div class="stat-value">${user.total_requests || 0}</div><div class="stat-label">ЗАПРОСОВ</div></div>
<div><div class="stat-value">${usedDays}/${totalDays}</div><div class="stat-label">ПРОГРЕСС</div></div>
</div>
<div class="progress-bar"><div class="progress-fill"></div></div>
<p class="text-secondary">Истекает: ${expiresAt.toLocaleDateString()}</p>
${serversHtml}
</div>
<div class="card">
<h2>ИНСТРУКЦИЯ</h2>
<p class="text-secondary">1. Скачай приложение Happ</p>
<p class="text-secondary">2. Нажми КОПИРОВАТЬ ССЫЛКУ</p>
<p class="text-secondary">3. В приложении нажми + → Вставить</p>
<p class="text-secondary">4. Обновляй подписку раз в день</p>
</div>
<div class="footer">XOLIRX VPN | @xolirx</div>
</div>
<script>
var subUrl = '${subscriptionUrl}';
document.getElementById('copyBtn').onclick = function() {
    navigator.clipboard.writeText(subUrl);
    alert('Ссылка скопирована');
};
document.getElementById('happBtn').onclick = function() {
    window.location.href = 'happ://add/' + subUrl;
};
QRCode.toCanvas(document.getElementById('qrcode'), 'happ://add/' + subUrl, {
    width: 160, margin: 1, color: { dark: '#000000', light: '#FFFFFF' }
});
</script>
</body>
</html>`
        
        res.setHeader("Content-Type", "text/html; charset=utf-8")
        res.send(html)
        
    } catch (error) {
        console.error(error)
        res.status(500).send("Internal Error")
    }
})

app.get("/vpn", (req, res) => {
    try {
        const vpn = fs.readFileSync(VPN_FILE, "utf-8")
        res.setHeader("Content-Type", "text/plain; charset=utf-8")
        res.send(vpn)
    } catch {
        res.status(500).send("error")
    }
})

app.listen(PORT, () => {
    console.log(`XolirX VPN running on port ${PORT}`)
    console.log(`Admin key: ${ADMIN_KEY}`)
})
