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

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR)
if (!fs.existsSync(VPN_FILE)) fs.writeFileSync(VPN_FILE, "", "utf-8")
if (!fs.existsSync(JSON_FILE)) fs.writeFileSync(JSON_FILE, "[]", "utf-8")
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]", "utf-8")

function loadUsers() {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"))
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8")
}

function generateToken() {
    return crypto.randomBytes(16).toString("hex")
}

function getDayWord(days) {
    if (days % 10 === 1 && days % 100 !== 11) return "день"
    if (days % 10 >= 2 && days % 10 <= 4 && (days % 100 < 10 || days % 100 >= 20)) return "дня"
    return "дней"
}

app.post("/api/create-subscription", (req, res) => {
    try {
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
            os: "Unknown",
            last_ip: null,
            last_seen: null
        }
        
        users.push(user)
        saveUsers(users)
        
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
        const isExpired = now > expiresAt
        
        res.json({
            success: true,
            token: user.token,
            active: user.active && !isExpired,
            daysLeft: daysLeft,
            totalDays: totalDays,
            expires_at: user.expires_at,
            total_requests: user.total_requests || 0,
            created_at: user.created_at
        })
    } catch (error) {
        res.json({ success: false, error: error.message })
    }
})

app.post("/api/admin/create-user", (req, res) => {
    const { days, key } = req.body
    if (key !== ADMIN_KEY) return res.status(403).json({ error: "Unauthorized" })
    
    const users = loadUsers()
    const token = generateToken()
    const expires_at = new Date()
    expires_at.setDate(expires_at.getDate() + (days || 7))
    
    users.push({
        token, active: true, created_at: new Date().toISOString(),
        expires_at: expires_at.toISOString(), total_requests: 0,
        os: "Unknown", last_ip: null, last_seen: null
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

app.get("/sub/:token", (req, res) => {
    try {
        const token = req.params.token
        const users = loadUsers()
        const user = users.find(x => x.token === token)
        
        if (!user) {
            return res.status(403).send("Subscription not found")
        }
        
        const now = new Date()
        const expiresAt = new Date(user.expires_at)
        const isExpired = now > expiresAt
        
        if (!user.active || isExpired) {
            return res.status(403).send("Subscription expired or disabled. Contact @xolirx for renewal.")
        }
        
        const vpn = fs.readFileSync(VPN_FILE, "utf-8")
        const servers = vpn.split("\n").filter(l => l.startsWith("vless://")).join("\n")
        
        user.last_ip = req.ip || req.headers['x-forwarded-for'] || 'Unknown'
        user.last_seen = new Date().toISOString()
        user.total_requests = (user.total_requests || 0) + 1
        
        const ua = req.headers["user-agent"] || "Unknown"
        if (ua.includes("Windows")) user.os = "Windows"
        else if (ua.includes("Android")) user.os = "Android"
        else if (ua.includes("iPhone")) user.os = "iOS"
        else if (ua.includes("Mac")) user.os = "MacOS"
        else if (ua.includes("Linux")) user.os = "Linux"
        
        saveUsers(users)
        
        const daysLeft = Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)))
        const expireTimestamp = Math.floor(expiresAt.getTime() / 1000)
        
        res.setHeader("Content-Type", "text/plain; charset=utf-8")
        res.setHeader("Profile-Title", "XolirX VPN")
        res.setHeader("Subscription-Userinfo", `upload=0; download=0; total=0; expire=${expireTimestamp}`)
        res.setHeader("Profile-Update-Interval", "1")
        res.setHeader("Support-Url", "https://t.me/xolirx")
        
        let result = `#profile-title: XolirX VPN\n`
        result += `#profile-update-interval: 1\n`
        result += `#subscription-userinfo: upload=0; download=0; total=0; expire=${expireTimestamp}\n`
        result += `#support-url: https://t.me/xolirx\n`
        result += `#announce: Безопасность | Скорость | Продление в тг: @xolirx\n\n`
        result += servers
        
        res.send(result)
    } catch {
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
