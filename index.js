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
const JSON_FILE = path.join(DATA_DIR, "servers.json")
const USERS_FILE = path.join(process.cwd(), "users.json")
const DEVICES_FILE = path.join(process.cwd(), "devices.json")

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR)
if (!fs.existsSync(VPN_FILE)) fs.writeFileSync(VPN_FILE, "", "utf-8")
if (!fs.existsSync(JSON_FILE)) fs.writeFileSync(JSON_FILE, "[]", "utf-8")
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]", "utf-8")
if (!fs.existsSync(DEVICES_FILE)) fs.writeFileSync(DEVICES_FILE, "{}", "utf-8")

function loadUsers() {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"))
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8")
}

function loadDevices() {
    return JSON.parse(fs.readFileSync(DEVICES_FILE, "utf-8"))
}

function saveDevices(devices) {
    fs.writeFileSync(DEVICES_FILE, JSON.stringify(devices, null, 2), "utf-8")
}

function generateToken() {
    return crypto.randomBytes(16).toString("hex")
}

function getDeviceFingerprint(req) {
    const ua = req.headers["user-agent"] || "Unknown"
    const ip = req.ip || req.headers["x-forwarded-for"] || "Unknown"
    return crypto.createHash("md5").update(ua + ip).digest("hex")
}

function parseUserAgent(ua) {
    let device = "Unknown"
    let os = "Unknown"
    let browser = "Unknown"
    
    ua = ua || ""
    
    if (ua.includes("iPhone")) {
        device = "iPhone"
        os = "iOS"
    } else if (ua.includes("iPad")) {
        device = "iPad"
        os = "iOS"
    } else if (ua.includes("Android")) {
        device = "Android Phone"
        os = "Android"
        if (ua.includes("SM-") || ua.includes("Galaxy")) device = "Samsung Galaxy"
        else if (ua.includes("Pixel")) device = "Google Pixel"
        else if (ua.includes("Xiaomi") || ua.includes("Redmi")) device = "Xiaomi"
        else if (ua.includes("OnePlus")) device = "OnePlus"
    } else if (ua.includes("Windows")) {
        device = "PC"
        os = "Windows"
    } else if (ua.includes("Mac")) {
        device = "MacBook"
        os = "macOS"
    } else if (ua.includes("Linux")) {
        device = "PC"
        os = "Linux"
    }
    
    if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome"
    else if (ua.includes("Firefox")) browser = "Firefox"
    else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari"
    else if (ua.includes("Edg")) browser = "Edge"
    else if (ua.includes("Opera")) browser = "Opera"
    
    return { device, os, browser }
}

function getDayWord(days) {
    if (days % 10 === 1 && days % 100 !== 11) return "день"
    if (days % 10 >= 2 && days % 10 <= 4 && (days % 100 < 10 || days % 100 >= 20)) return "дня"
    return "дней"
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
                    return res.json({ 
                        success: false, 
                        error: "active_subscription",
                        token: existingToken,
                        message: "У вас уже есть активная подписка"
                    })
                }
            }
        }
        
        const users = loadUsers()
        const token = generateToken()
        const expires_at = new Date()
        expires_at.setDate(expires_at.getDate() + 7)
        
        const user = {
            token: token,
            active: true,
            created_at: new Date().toISOString(),
            expires_at: expires_at.toISOString(),
            total_requests: 0,
            last_ip: req.ip || req.headers["x-forwarded-for"] || "Unknown",
            last_seen: new Date().toISOString(),
            user_agent: req.headers["user-agent"] || "Unknown",
            device_info: parseUserAgent(req.headers["user-agent"] || "")
        }
        
        users.push(user)
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
        
        if (!user) {
            return res.json({ success: false, error: "User not found" })
        }
        
        const now = new Date()
        const expiresAt = new Date(user.expires_at)
        const daysLeft = Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)))
        const createdDate = new Date(user.created_at)
        const totalDays = Math.ceil((expiresAt - createdDate) / (1000 * 60 * 60 * 24))
        const usedDays = totalDays - daysLeft
        const isExpired = now > expiresAt
        
        res.json({
            success: true,
            token: user.token,
            active: user.active && !isExpired,
            daysLeft: daysLeft,
            totalDays: totalDays,
            usedDays: usedDays,
            expires_at: user.expires_at,
            total_requests: user.total_requests || 0,
            created_at: user.created_at,
            last_ip: user.last_ip || "Unknown",
            last_seen: user.last_seen,
            device_info: user.device_info || { device: "Unknown", os: "Unknown", browser: "Unknown" }
        })
    } catch (error) {
        res.json({ success: false, error: error.message })
    }
})

app.get("/api/admin/users", (req, res) => {
    const key = req.query.key
    if (key !== ADMIN_KEY) {
        return res.json({ success: false, error: "Unauthorized" })
    }
    
    const users = loadUsers()
    const now = new Date()
    
    const usersWithInfo = users.map(user => {
        const expiresAt = new Date(user.expires_at)
        const daysLeft = Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)))
        const createdDate = new Date(user.created_at)
        const totalDays = Math.ceil((expiresAt - createdDate) / (1000 * 60 * 60 * 24))
        return {
            token: user.token,
            active: user.active,
            daysLeft: daysLeft,
            totalDays: totalDays,
            isExpired: now > expiresAt,
            total_requests: user.total_requests || 0,
            created_at: user.created_at,
            expires_at: user.expires_at,
            last_ip: user.last_ip || "Unknown",
            last_seen: user.last_seen,
            device_info: user.device_info || { device: "Unknown", os: "Unknown", browser: "Unknown" }
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
    
    users.push({
        token: token,
        active: true,
        created_at: new Date().toISOString(),
        expires_at: expires_at.toISOString(),
        total_requests: 0,
        last_ip: null,
        last_seen: null,
        device_info: { device: "Unknown", os: "Unknown", browser: "Unknown" }
    })
    saveUsers(users)
    res.json({ success: true, token: token })
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
    res.json({ success: true, extended: users.filter(u => u.active).length })
})

app.get("/sub/:token", async (req, res) => {
    try {
        const token = req.params.token
        const userAgent = req.headers["user-agent"] || ""
        
        const isHappClient = userAgent.includes("Happ") || 
                            userAgent.includes("v2rayNG") || 
                            userAgent.includes("Nekobox") ||
                            userAgent.includes("Clash") ||
                            userAgent.includes("Shadowrocket") ||
                            userAgent.includes("Sing-box") ||
                            (userAgent.includes("Android") && !userAgent.includes("Chrome") && !userAgent.includes("Firefox")) ||
                            (userAgent.includes("iOS") && !userAgent.includes("Safari") && !userAgent.includes("Chrome"))
        
        const users = loadUsers()
        const user = users.find(x => x.token === token)
        
        if (!user) {
            if (isHappClient) {
                return res.status(404).send("Subscription not found")
            }
            return res.status(404).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>404 | XolirX VPN</title><style>body{background:#0a0c10;color:#fff;font-family:monospace;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}.card{background:#14161c;border:1px solid #1f2230;padding:40px;border-radius:16px;text-align:center}.btn{display:inline-block;margin-top:20px;padding:10px 24px;border:1px solid #fff;color:#fff;text-decoration:none}</style></head><body><div class="card"><h2>404</h2><p>Подписка не найдена</p><a href="https://xolirx-vpn.vercel.app/" class="btn">На главную</a></div></body></html>`)
        }
        
        const now = new Date()
        const expiresAt = new Date(user.expires_at)
        const isExpired = now > expiresAt
        
        if (!user.active || isExpired) {
            if (isHappClient) {
                return res.status(403).send("Subscription expired. Contact @xolirx")
            }
            return res.status(403).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Подписка истекла | XolirX VPN</title><style>body{background:#0a0c10;color:#fff;font-family:monospace;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}.card{background:#14161c;border:1px solid #1f2230;padding:40px;border-radius:16px;text-align:center}.btn{display:inline-block;margin-top:20px;padding:10px 24px;border:1px solid #fff;color:#fff;text-decoration:none}</style></head><body><div class="card"><h2>Подписка истекла</h2><p>Срок действия подписки закончился</p><p>Для продления: <strong>@xolirx</strong></p><a href="https://xolirx-vpn.vercel.app/" class="btn">На главную</a></div></body></html>`)
        }
        
        user.last_ip = req.ip || req.headers['x-forwarded-for'] || 'Unknown'
        user.last_seen = new Date().toISOString()
        user.total_requests = (user.total_requests || 0) + 1
        user.device_info = parseUserAgent(userAgent)
        user.user_agent = userAgent
        saveUsers(users)
        
        const daysLeft = Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)))
        const expireTimestamp = Math.floor(expiresAt.getTime() / 1000)
        
        if (isHappClient) {
            const vpn = fs.readFileSync(VPN_FILE, "utf-8")
            const servers = vpn.split("\n").filter(l => l.startsWith("vless://")).join("\n")
            
            res.setHeader("Content-Type", "text/plain; charset=utf-8")
            res.setHeader("Profile-Title", "XolirX VPN")
            res.setHeader("Subscription-Userinfo", `upload=0; download=0; total=0; expire=${expireTimestamp}`)
            res.setHeader("Profile-Update-Interval", "1")
            res.setHeader("Support-Url", "https://t.me/xolirx")
            
            let result = `#profile-title: XolirX VPN\n`
            result += `#profile-update-interval: 1\n`
            result += `#subscription-userinfo: upload=0; download=0; total=0; expire=${expireTimestamp}\n`
            result += `#support-url: https://t.me/xolirx\n`
            result += `#announce: 🔒 Безопасность | ⚡ Скорость | 📅 Осталось ${daysLeft} ${getDayWord(daysLeft)} | ✨ Продление: @xolirx\n\n`
            result += servers
            return res.send(result)
        }
        
        const createdDate = new Date(user.created_at)
        const totalDays = Math.ceil((expiresAt - createdDate) / (1000 * 60 * 60 * 24))
        const usedDays = totalDays - daysLeft
        const percent = (daysLeft / totalDays) * 100
        const subscriptionUrl = `${req.protocol}://${req.get("host")}/sub/${token}`
        
        const html = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>XolirX VPN | Моя подписка</title>
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #0a0c10; font-family: 'Courier New', monospace; color: #fff; min-height: 100vh; }
        .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        .card { background: #14161c; border: 1px solid #1f2230; border-radius: 16px; padding: 32px; margin-bottom: 20px; }
        h1 { font-size: 24px; margin-bottom: 8px; }
        h2 { font-size: 18px; margin-bottom: 16px; letter-spacing: 1px; }
        .text-secondary { color: #888; font-size: 12px; }
        .key-box { background: #0a0c10; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 11px; word-break: break-all; margin: 16px 0; border: 1px solid #1f2230; }
        .flex-row { display: flex; gap: 12px; flex-wrap: wrap; margin: 20px 0; }
        .btn { background: transparent; border: 1px solid #fff; color: #fff; padding: 12px 24px; font-family: monospace; font-size: 12px; cursor: pointer; text-decoration: none; display: inline-block; transition: 0.2s; }
        .btn:hover { background: #fff; color: #000; }
        .btn-accent { background: #fff; color: #000; border: none; }
        .btn-accent:hover { opacity: 0.85; }
        .stats { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin: 20px 0; }
        .stat { flex: 1; min-width: 100px; }
        .stat-value { font-size: 24px; font-weight: bold; }
        .stat-label { color: #888; font-size: 10px; text-transform: uppercase; }
        .progress-bar { background: #1f2230; height: 4px; border-radius: 4px; margin: 16px 0; }
        .progress-fill { background: #fff; height: 100%; border-radius: 4px; width: ${percent}%; }
        .qr-container { text-align: center; margin: 20px 0; }
        .qr-container canvas { background: #fff; padding: 12px; border-radius: 12px; }
        hr { border: none; border-top: 1px solid #1f2230; margin: 20px 0; }
        .footer { text-align: center; color: #888; font-size: 10px; margin-top: 40px; }
        @media (max-width: 600px) { .container { padding: 20px 16px; } .card { padding: 20px; } .stats { flex-direction: column; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <h1>XOLIRX VPN</h1>
            <p class="text-secondary">ПЕРСОНАЛЬНАЯ ПОДПИСКА</p>
            <div class="key-box" id="subUrl">${subscriptionUrl}</div>
            <div class="flex-row">
                <button class="btn btn-accent" onclick="copyUrl()">КОПИРОВАТЬ ССЫЛКУ</button>
                <button class="btn" onclick="addToHapp()">ДОБАВИТЬ В HAPP</button>
                <a href="https://xolirx-vpn.vercel.app/?token=${token}" class="btn">ПАНЕЛЬ УПРАВЛЕНИЯ</a>
            </div>
            <div class="qr-container">
                <div id="qrcode"></div>
                <p class="text-secondary" style="margin-top: 12px;">QR-КОД ДЛЯ HAPP</p>
            </div>
            <hr>
            <div class="stats">
                <div class="stat">
                    <div class="stat-value">${daysLeft}</div>
                    <div class="stat-label">ОСТАЛОСЬ ДНЕЙ</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${user.total_requests || 0}</div>
                    <div class="stat-label">ЗАПРОСОВ</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${usedDays}/${totalDays}</div>
                    <div class="stat-label">ПРОГРЕСС</div>
                </div>
            </div>
            <div class="progress-bar">
                <div class="progress-fill"></div>
            </div>
            <p class="text-secondary" style="margin-top: 16px;">Истекает: ${expiresAt.toLocaleDateString()}</p>
        </div>
        <div class="card">
            <h2>КАК ПОДКЛЮЧИТЬСЯ</h2>
            <p class="text-secondary" style="margin-bottom: 12px;"><strong>1.</strong> Скачай приложение Happ</p>
            <p class="text-secondary" style="margin-bottom: 12px;"><strong>2.</strong> Нажми «ДОБАВИТЬ В HAPP» или скопируй ссылку</p>
            <p class="text-secondary" style="margin-bottom: 12px;"><strong>3.</strong> В Happ нажми «+» → «Вставить из буфера обмена»</p>
            <p class="text-secondary"><strong>4.</strong> Обновляй подписку раз в день</p>
        </div>
        <div class="footer">
            <p>XOLIRX VPN | @xolirx</p>
        </div>
    </div>
    <script>
        function copyUrl() {
            const url = document.getElementById('subUrl').innerText;
            navigator.clipboard.writeText(url);
            alert('Ссылка скопирована');
        }
        function addToHapp() {
            const url = document.getElementById('subUrl').innerText;
            window.location.href = 'happ://add/' + url;
        }
        const url = document.getElementById('subUrl').innerText;
        QRCode.toCanvas(document.getElementById('qrcode'), 'happ://add/' + url, {
            width: 160, margin: 1, color: { dark: '#000000', light: '#FFFFFF' }
        });
    </script>
</body>
</html>`
        
        res.setHeader("Content-Type", "text/html; charset=utf-8")
        res.send(html)
        
    } catch (error) {
        console.error(error)
        res.status(500).send("Internal Server Error")
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
    console.log(`XolirX VPN API running on port ${PORT}`)
    console.log(`Admin key: ${ADMIN_KEY}`)
})
