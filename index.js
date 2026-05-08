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

const USERS_FILE = path.join(process.cwd(), "users.json")
const DEVICES_FILE = path.join(process.cwd(), "devices.json")

if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, "[]", "utf-8")
}

if (!fs.existsSync(DEVICES_FILE)) {
    fs.writeFileSync(DEVICES_FILE, "{}", "utf-8")
}

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

    return crypto
        .createHash("md5")
        .update(ua + ip)
        .digest("hex")
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
        device = "Android"
        os = "Android"
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

    if (ua.includes("Chrome") && !ua.includes("Edg")) {
        browser = "Chrome"
    } else if (ua.includes("Firefox")) {
        browser = "Firefox"
    } else if (ua.includes("Safari") && !ua.includes("Chrome")) {
        browser = "Safari"
    } else if (ua.includes("Edg")) {
        browser = "Edge"
    }

    return {
        device,
        os,
        browser
    }
}

app.post("/api/create-subscription", (req, res) => {
    try {
        const fingerprint = getDeviceFingerprint(req)
        const devices = loadDevices()

        if (devices[fingerprint]) {
            const existingToken = devices[fingerprint]

            const users = loadUsers()

            const existingUser = users.find(
                u => u.token === existingToken
            )

            if (existingUser && existingUser.active) {
                const now = new Date()
                const expiresAt = new Date(existingUser.expires_at)

                if (now < expiresAt) {
                    return res.json({
                        success: false,
                        error: "active_subscription",
                        token: existingToken
                    })
                }
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
            last_ip:
                req.ip ||
                req.headers["x-forwarded-for"] ||
                "Unknown",
            last_seen: new Date().toISOString(),
            user_agent:
                req.headers["user-agent"] || "Unknown",
            device_info: parseUserAgent(
                req.headers["user-agent"] || ""
            )
        }

        users.push(user)

        saveUsers(users)

        devices[fingerprint] = token

        saveDevices(devices)

        res.json({
            success: true,
            token
        })

    } catch (error) {
        res.json({
            success: false,
            error: error.message
        })
    }
})

app.get("/api/user-info/:token", (req, res) => {
    try {
        const token = req.params.token

        const users = loadUsers()

        const user = users.find(
            u => u.token === token
        )

        if (!user) {
            return res.json({
                success: false,
                error: "User not found"
            })
        }

        const now = new Date()

        const expiresAt = new Date(user.expires_at)

        const daysLeft = Math.max(
            0,
            Math.ceil(
                (expiresAt - now) /
                (1000 * 60 * 60 * 24)
            )
        )

        const createdDate = new Date(user.created_at)

        const totalDays = Math.ceil(
            (expiresAt - createdDate) /
            (1000 * 60 * 60 * 24)
        )

        const usedDays = totalDays - daysLeft

        res.json({
            success: true,
            token: user.token,
            active: user.active,
            daysLeft,
            totalDays,
            usedDays,
            expires_at: user.expires_at,
            total_requests:
                user.total_requests || 0,
            created_at: user.created_at,
            last_ip: user.last_ip || "Unknown",
            last_seen: user.last_seen,
            device_info:
                user.device_info || {
                    device: "Unknown",
                    os: "Unknown",
                    browser: "Unknown"
                }
        })

    } catch (error) {
        res.json({
            success: false,
            error: error.message
        })
    }
})

app.get("/api/admin/users", (req, res) => {
    const key = req.query.key

    if (key !== ADMIN_KEY) {
        return res.json({
            success: false,
            error: "Unauthorized"
        })
    }

    const users = loadUsers()

    const now = new Date()

    const usersWithInfo = users.map(user => {
        const expiresAt = new Date(user.expires_at)

        const daysLeft = Math.max(
            0,
            Math.ceil(
                (expiresAt - now) /
                (1000 * 60 * 60 * 24)
            )
        )

        return {
            token: user.token,
            active: user.active,
            daysLeft,
            isExpired: now > expiresAt,
            total_requests:
                user.total_requests || 0,
            last_ip: user.last_ip || "Unknown",
            last_seen: user.last_seen,
            device_info:
                user.device_info || {
                    device: "Unknown",
                    os: "Unknown",
                    browser: "Unknown"
                }
        }
    })

    res.json({
        success: true,
        users: usersWithInfo
    })
})

app.post("/api/admin/create-user", (req, res) => {
    const { days, key } = req.body

    if (key !== ADMIN_KEY) {
        return res
            .status(403)
            .json({
                error: "Unauthorized"
            })
    }

    const users = loadUsers()

    const token = generateToken()

    const expires_at = new Date()

    expires_at.setDate(
        expires_at.getDate() + (days || 7)
    )

    users.push({
        token,
        active: true,
        created_at: new Date().toISOString(),
        expires_at: expires_at.toISOString(),
        total_requests: 0,
        last_ip: null,
        last_seen: null,
        device_info: {
            device: "Unknown",
            os: "Unknown",
            browser: "Unknown"
        }
    })

    saveUsers(users)

    res.json({
        success: true,
        token
    })
})

app.post("/api/admin/disable", (req, res) => {
    const { token, key } = req.body

    if (key !== ADMIN_KEY) {
        return res
            .status(403)
            .json({
                error: "Unauthorized"
            })
    }

    const users = loadUsers()

    const user = users.find(
        u => u.token === token
    )

    if (user) {
        user.active = false
    }

    saveUsers(users)

    res.json({
        success: true
    })
})

app.post("/api/admin/enable", (req, res) => {
    const { token, days, key } = req.body

    if (key !== ADMIN_KEY) {
        return res
            .status(403)
            .json({
                error: "Unauthorized"
            })
    }

    const users = loadUsers()

    const user = users.find(
        u => u.token === token
    )

    if (user) {
        const newExpiry = new Date()

        newExpiry.setDate(
            newExpiry.getDate() + (days || 7)
        )

        user.expires_at =
            newExpiry.toISOString()

        user.active = true
    }

    saveUsers(users)

    res.json({
        success: true
    })
})

app.post("/api/admin/extend", (req, res) => {
    const { token, days, key } = req.body

    if (key !== ADMIN_KEY) {
        return res
            .status(403)
            .json({
                error: "Unauthorized"
            })
    }

    const users = loadUsers()

    const user = users.find(
        u => u.token === token
    )

    if (user) {
        const currentExpiry =
            new Date(user.expires_at)

        const now = new Date()

        const newExpiry = new Date(
            Math.max(
                currentExpiry.getTime(),
                now.getTime()
            )
        )

        newExpiry.setDate(
            newExpiry.getDate() + (days || 7)
        )

        user.expires_at =
            newExpiry.toISOString()

        user.active = true
    }

    saveUsers(users)

    res.json({
        success: true
    })
})

app.post("/api/admin/extend-all", (req, res) => {
    const { days, key } = req.body

    if (key !== ADMIN_KEY) {
        return res
            .status(403)
            .json({
                error: "Unauthorized"
            })
    }

    const users = loadUsers()

    const now = new Date()

    for (const user of users) {
        if (user.active) {
            const currentExpiry =
                new Date(user.expires_at)

            const newExpiry = new Date(
                Math.max(
                    currentExpiry.getTime(),
                    now.getTime()
                )
            )

            newExpiry.setDate(
                newExpiry.getDate() + (days || 7)
            )

            user.expires_at =
                newExpiry.toISOString()
        }
    }

    saveUsers(users)

    res.json({
        success: true
    })
})

app.get("/sub/:token", async (req, res) => {
    try {
        const token = req.params.token

        const format =
            req.query.format || ""

        const userAgent =
            req.headers["user-agent"] || ""

        const isHappClient =
            format === "happ" ||
            format === "text" ||
            userAgent.includes("Happ") ||
            userAgent.includes("v2rayNG") ||
            userAgent.includes("Nekobox") ||
            userAgent.includes("Clash") ||
            userAgent.includes("Shadowrocket") ||
            userAgent.includes("Sing-box")

        const users = loadUsers()

        const user = users.find(
            x => x.token === token
        )

        if (!user) {
            if (isHappClient) {
                return res
                    .status(404)
                    .send("Subscription not found")
            }

            return res.redirect(
                "https://xolirx-vpn.vercel.app/"
            )
        }

        const now = new Date()

        const expiresAt = new Date(
            user.expires_at
        )

        const isExpired =
            now > expiresAt

        if (!user.active || isExpired) {
            if (isHappClient) {
                return res
                    .status(403)
                    .send("Subscription expired")
            }

            return res.redirect(
                "https://xolirx-vpn.vercel.app/"
            )
        }

        user.last_ip =
            req.ip ||
            req.headers["x-forwarded-for"] ||
            "Unknown"

        user.last_seen =
            new Date().toISOString()

        user.total_requests =
            (user.total_requests || 0) + 1

        user.device_info =
            parseUserAgent(userAgent)

        saveUsers(users)

        const expireTimestamp = Math.floor(
            expiresAt.getTime() / 1000
        )

        if (isHappClient) {

            const response = await fetch(
                "https://raw.githubusercontent.com/xolirx/xolirx-vpn-api/main/data/vpn.txt"
            )

            const vpnContent =
                await response.text()

            res.setHeader(
                "Content-Type",
                "text/plain; charset=utf-8"
            )

            res.setHeader(
                "Content-Disposition",
                "inline"
            )

            res.setHeader(
                "Profile-Title",
                "XolirX 🌑"
            )

            res.setHeader(
                "Subscription-Userinfo",
                `upload=0; download=0; total=0; expire=${expireTimestamp}`
            )

            res.setHeader(
                "Profile-Update-Interval",
                "1"
            )

            res.setHeader(
                "Support-Url",
                "https://t.me/xolirx"
            )

            return res.send(vpnContent)
        }

        return res.redirect(
            `https://xolirx-vpn.vercel.app/?token=${token}`
        )

    } catch (error) {
        console.error(error)

        res.status(500).send(
            "Internal Server Error"
        )
    }
})

app.get("/vpn", async (req, res) => {
    try {

        const response = await fetch(
            "https://raw.githubusercontent.com/xolirx/xolirx-vpn-api/main/data/vpn.txt"
        )

        const vpnContent =
            await response.text()

        res.setHeader(
            "Content-Type",
            "text/plain; charset=utf-8"
        )

        res.send(vpnContent)

    } catch (error) {
        console.error(error)

        res.status(500).send("error")
    }
})

app.listen(PORT, () => {
    console.log(
        `XolirX VPN API running on port ${PORT}`
    )

    console.log(
        `Admin key: ${ADMIN_KEY}`
    )
})
