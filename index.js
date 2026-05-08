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

// Создание папок и файлов, если их нет
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR)
if (!fs.existsSync(VPN_FILE)) fs.writeFileSync(VPN_FILE, "", "utf-8")
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]", "utf-8")
if (!fs.existsSync(DEVICES_FILE)) fs.writeFileSync(DEVICES_FILE, "{}", "utf-8")

// Загрузка/сохранение пользователей и устройств
function loadUsers() { return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8")) }
function saveUsers(users) { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8") }
function loadDevices() { return JSON.parse(fs.readFileSync(DEVICES_FILE, "utf-8")) }
function saveDevices(devices) { fs.writeFileSync(DEVICES_FILE, JSON.stringify(devices, null, 2), "utf-8") }

// Генерация токена
function generateToken() { return crypto.randomBytes(16).toString("hex") }

// Получение уникального идентификатора устройства
function getDeviceFingerprint(req) {
    const ua = req.headers["user-agent"] || "Unknown"
    const ip = req.ip || req.headers["x-forwarded-for"] || "Unknown"
    return crypto.createHash("md5").update(ua + ip).digest("hex")
}

// Парсинг user-agent
function parseUserAgent(ua) {
    let device = "Unknown", os = "Unknown", browser = "Unknown"
    ua = ua || ""
    if (ua.includes("iPhone")) { device = "iPhone"; os = "iOS" }
    else if (ua.includes("iPad")) { device = "iPad"; os = "iOS" }
    else if (ua.includes("Android")) { device = "Android"; os = "Android" }
    else if (ua.includes("Windows")) { device = "PC"; os = "Windows" }
    else if (ua.includes("Mac")) { device = "MacBook"; os = "macOS" }
    else if (ua.includes("Linux")) { device = "PC"; os = "Linux" }

    if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome"
    else if (ua.includes("Firefox")) browser = "Firefox"
    else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari"
    else if (ua.includes("Edg")) browser = "Edge"

    return { device, os, browser }
}

// Создание подписки для устройства
app.post("/api/create-subscription", (req, res) => {
    try {
        const fingerprint = getDeviceFingerprint(req)
        const devices = loadDevices()
        const users = loadUsers()

        if (devices[fingerprint]) {
            const existingToken = devices[fingerprint]
            const existingUser = users.find(u => u.token === existingToken)
            if (existingUser && existingUser.active && new Date() < new Date(existingUser.expires_at)) {
                return res.json({ success: false, error: "active_subscription", token: existingToken })
            }
        }

        const token = generateToken()
        const expires_at = new Date()
        expires_at.setDate(expires_at.getDate() + 7)

        const user = {
            token,
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

        res.json({ success: true, token })
    } catch (err) {
        console.error(err)
        res.json({ success: false, error: err.message })
    }
})

// Информация о пользователе
app.get("/api/user-info/:token", (req, res) => {
    try {
        const token = req.params.token
        const users = loadUsers()
        const user = users.find(u => u.token === token)
        if (!user) return res.json({ success: false, error: "User not found" })

        const now = new Date()
        const expiresAt = new Date(user.expires_at)
        const daysLeft = Math.max(0, Math.ceil((expiresAt - now)/(1000*60*60*24)))
        const totalDays = Math.ceil((expiresAt - new Date(user.created_at))/(1000*60*60*24))
        const usedDays = totalDays - daysLeft

        res.json({
            success: true,
            token: user.token,
            active: user.active,
            daysLeft,
            totalDays,
            usedDays,
            expires_at: user.expires_at,
            total_requests: user.total_requests || 0,
            created_at: user.created_at,
            last_ip: user.last_ip || "Unknown",
            last_seen: user.last_seen,
            device_info: user.device_info || { device: "Unknown", os: "Unknown", browser: "Unknown" }
        })
    } catch (err) {
        console.error(err)
        res.json({ success: false, error: err.message })
    }
})

// Просмотр подписки для Happ
app.get("/sub/:token", (req, res) => {
    try {
        const token = req.params.token
        const format = req.query.format || ""
        const userAgent = req.headers["user-agent"] || ""
        const isHappClient = format === "happ" || userAgent.includes("Happ")

        const users = loadUsers()
        const user = users.find(u => u.token === token)
        if (!user) return res.status(404).send("Subscription not found")

        if (!user.active || new Date() > new Date(user.expires_at)) {
            return res.status(403).send("Subscription expired")
        }

        user.last_ip = req.ip || req.headers["x-forwarded-for"] || "Unknown"
        user.last_seen = new Date().toISOString()
        user.total_requests = (user.total_requests || 0) + 1
        saveUsers(users)

        const expireTimestamp = Math.floor(new Date(user.expires_at).getTime()/1000)

        if (isHappClient) {
            const vpnContent = fs.readFileSync(VPN_FILE, "utf-8")
            res.setHeader("Content-Type", "text/plain; charset=utf-8")
            res.setHeader("Content-Disposition", "inline")
            res.setHeader("Profile-Title", "XolirX 🌑")
            res.setHeader("Subscription-Userinfo", `upload=0; download=0; total=0; expire=${expireTimestamp}`)
            res.setHeader("Profile-Update-Interval", "1")
            res.setHeader("Support-Url", "https://t.me/xolirx")
            return res.send(vpnContent)
        }

        return res.redirect(`https://xolirx-vpn.vercel.app/?token=${token}`)
    } catch (err) {
        console.error(err)
        res.status(500).send("Internal Server Error")
    }
})

// Прямой доступ к vpn.txt
app.get("/vpn", (req, res) => {
    try {
        const vpnContent = fs.readFileSync(VPN_FILE, "utf-8")
        res.setHeader("Content-Type", "text/plain; charset=utf-8")
        res.send(vpnContent)
    } catch (err) {
        console.error(err)
        res.status(500).send("VPN file error")
    }
})

// Запуск сервера
app.listen(PORT, () => {
    console.log(`XolirX VPN API running on port ${PORT}`)
    console.log(`Admin key: ${ADMIN_KEY}`)
})
