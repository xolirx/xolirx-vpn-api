import express from "express"
import cors from "cors"
import fs from "fs"
import path from "path"
import crypto from "crypto"
import fetch from "node-fetch"

const app = express()
app.use(cors())
app.use(express.json({ limit: "50mb" }))

const PORT = process.env.PORT || 3000
const ADMIN_KEY = process.env.ADMIN_KEY || "xolirx2024"

const USERS_FILE = path.join(process.cwd(), "users.json")
const DEVICES_FILE = path.join(process.cwd(), "devices.json")

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
                if (now < expiresAt) return res.json({ success: false, error: "active_subscription", token: existingToken })
            }
        }
        const users = loadUsers()
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
    } catch (error) {
        res.json({ success: false, error: error.message })
    }
})

app.get("/sub/:token", async (req, res) => {
    try {
        const token = req.params.token
        const format = req.query.format || ""
        const userAgent = req.headers["user-agent"] || ""
        const isHappClient = format === "happ" || format === "text" ||
            userAgent.includes("Happ") || userAgent.includes("v2rayNG") ||
            userAgent.includes("Nekobox") || userAgent.includes("Clash") ||
            userAgent.includes("Shadowrocket") || userAgent.includes("Sing-box")

        const users = loadUsers()
        const user = users.find(u => u.token === token)
        if (!user) return res.status(404).send("Subscription not found")
        const now = new Date()
        const expiresAt = new Date(user.expires_at)
        if (!user.active || now > expiresAt) return res.status(403).send("Subscription expired")

        user.last_ip = req.ip || req.headers["x-forwarded-for"] || "Unknown"
        user.last_seen = new Date().toISOString()
        user.total_requests = (user.total_requests || 0) + 1
        user.device_info = parseUserAgent(userAgent)
        saveUsers(users)

        const expireTimestamp = Math.floor(expiresAt.getTime() / 1000)

        if (isHappClient) {
            const githubResponse = await fetch("https://raw.githubusercontent.com/xolirx/xolirx-vpn-api/refs/heads/main/data/vpn.txt")
            if (!githubResponse.ok) return res.status(500).send("GitHub VPN file error")
            const vpnContent = await githubResponse.text()
            res.setHeader("Content-Type", "text/plain; charset=utf-8")
            res.setHeader("Content-Disposition", "inline")
            res.setHeader("Profile-Title", "XolirX 🌑")
            res.setHeader("Subscription-Userinfo", `upload=0; download=0; total=0; expire=${expireTimestamp}`)
            res.setHeader("Profile-Update-Interval", "1")
            res.setHeader("Support-Url", "https://t.me/xolirx")
            return res.send(vpnContent)
        }

        return res.redirect(`https://xolirx-vpn.vercel.app/?token=${token}`)
    } catch (error) {
        console.error(error)
        res.status(500).send(error.message)
    }
})

app.get("/vpn", async (req, res) => {
    try {
        const githubResponse = await fetch("https://raw.githubusercontent.com/xolirx/xolirx-vpn-api/refs/heads/main/data/vpn.txt")
        if (!githubResponse.ok) return res.status(500).send("GitHub VPN file error")
        const vpnContent = await githubResponse.text()
        res.setHeader("Content-Type", "text/plain; charset=utf-8")
        res.send(vpnContent)
    } catch (error) {
        console.error(error)
        res.status(500).send(error.message)
    }
})

app.listen(PORT, () => {
    console.log(`XolirX VPN API running on port ${PORT}`)
    console.log(`Admin key: ${ADMIN_KEY}`)
})
