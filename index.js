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
const USERS_FILE = path.join(process.cwd(), "users.json")
const DEVICES_FILE = path.join(DATA_DIR, "devices.json")

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR)
if (!fs.existsSync(VPN_FILE)) fs.writeFileSync(VPN_FILE, "", "utf-8")
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

// ... тут оставляем все функции для /api/... без изменений ...

app.get("/sub/:token", (req, res) => {
  try {
    const token = req.params.token
    const format = req.query.format || ""
    const userAgent = req.headers["user-agent"] || ""
    const isHappClient = format === "happ" || userAgent.includes("Happ")

    const users = loadUsers()
    const user = users.find(u => u.token === token)
    if (!user) return res.status(404).send("Subscription not found")

    const now = new Date()
    const expiresAt = new Date(user.expires_at)
    if (!user.active || now > expiresAt) return res.status(403).send("Subscription expired")

    user.last_ip = req.ip || req.headers["x-forwarded-for"] || "Unknown"
    user.last_seen = new Date().toISOString()
    user.total_requests = (user.total_requests || 0) + 1
    saveUsers(users)

    const expireTimestamp = Math.floor(expiresAt.getTime() / 1000)

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

app.listen(PORT, () => {
  console.log(`XolirX VPN API running on port ${PORT}`)
  console.log(`Admin key: ${ADMIN_KEY}`)
})
