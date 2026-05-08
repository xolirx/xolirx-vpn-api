import express from "express"
import cors from "cors"
import fs from "fs"
import path from "path"
import crypto from "crypto"
import QRCode from "qrcode"

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
        const createdDate = new Date(user.created_at)
        const totalDays = Math.ceil((expiresAt - createdDate) / (1000 * 60 * 60 * 24))
        const usedDays = totalDays - daysLeft
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
        result += `#announce: Подписка активна до ${expiresAt.toLocaleDateString()} (осталось ${daysLeft} ${getDayWord(daysLeft)})\n`
        result += `#announce: Использовано ${usedDays} из ${totalDays} дней\n`
        result += `#announce: Для продления пиши @xolirx\n\n`
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

app.get("/servers", (req, res) => {
    try {
        const json = fs.readFileSync(JSON_FILE, "utf-8")
        res.setHeader("Content-Type", "application/json")
        res.send(json)
    } catch {
        res.status(500).send("[]")
    }
})

app.get("/admin", (req, res) => {
    const adminKey = req.query.key
    
    if (!adminKey || adminKey !== ADMIN_KEY) {
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>XolirX VPN | Admin</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        background: #0a0c10;
                        font-family: monospace;
                        min-height: 100vh;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        padding: 20px;
                    }
                    .login-card {
                        background: #14161c;
                        border: 1px solid #1f2230;
                        border-radius: 8px;
                        padding: 40px;
                        max-width: 400px;
                        width: 100%;
                        text-align: center;
                    }
                    input {
                        width: 100%;
                        padding: 12px;
                        background: #0a0c10;
                        border: 1px solid #1f2230;
                        color: white;
                        margin: 16px 0;
                        font-family: monospace;
                    }
                    button {
                        width: 100%;
                        padding: 12px;
                        background: #fff;
                        border: none;
                        color: #000;
                        font-weight: bold;
                        cursor: pointer;
                        font-family: monospace;
                    }
                </style>
            </head>
            <body>
                <div class="login-card">
                    <h2>ADMIN ACCESS</h2>
                    <input type="password" id="keyInput" placeholder="ENTER KEY" onkeypress="if(event.key==='Enter') login()">
                    <button onclick="login()">LOGIN</button>
                </div>
                <script>
                    function login() {
                        const key = document.getElementById('keyInput').value
                        if(key) window.location.href = '/admin/dashboard?key=' + encodeURIComponent(key)
                    }
                </script>
            </body>
            </html>
        `)
    }
    
    res.redirect(`/admin/dashboard?key=${adminKey}`)
})

app.get("/admin/dashboard", (req, res) => {
    const adminKey = req.query.key
    
    if (!adminKey || adminKey !== ADMIN_KEY) {
        return res.redirect("/admin")
    }
    
    let users = loadUsers()
    const totalRequests = users.reduce((sum, u) => sum + (u.total_requests || 0), 0)
    const now = new Date()
    
    users = users.map(user => {
        const expiresAt = new Date(user.expires_at)
        const createdDate = new Date(user.created_at)
        const daysLeft = Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)))
        const totalDays = Math.ceil((expiresAt - createdDate) / (1000 * 60 * 60 * 24))
        const usedDays = totalDays - daysLeft
        return {
            ...user,
            expires_at_formatted: expiresAt.toLocaleDateString(),
            created_at_formatted: createdDate.toLocaleDateString(),
            daysLeft,
            totalDays,
            usedDays,
            isExpired: now > expiresAt
        }
    })
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>XolirX VPN | Admin Dashboard</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    background: #0a0c10;
                    font-family: monospace;
                    color: #fff;
                    padding: 20px;
                }
                .container { max-width: 1400px; margin: 0 auto; }
                .header {
                    background: #14161c;
                    border: 1px solid #1f2230;
                    padding: 20px;
                    margin-bottom: 20px;
                    display: flex;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 16px;
                }
                .stats { display: flex; gap: 16px; flex-wrap: wrap; }
                .stat { background: #0a0c10; padding: 8px 16px; border: 1px solid #1f2230; }
                .stat span { color: #fff; font-weight: bold; }
                table { width: 100%; border-collapse: collapse; background: #14161c; border: 1px solid #1f2230; }
                th, td { padding: 12px; text-align: left; border-bottom: 1px solid #1f2230; }
                th { color: #888; font-weight: normal; }
                .badge {
                    padding: 2px 8px;
                    font-size: 11px;
                    border: 1px solid;
                }
                .badge-active { border-color: #00ff00; color: #00ff00; }
                .badge-expired { border-color: #ff0000; color: #ff0000; }
                .badge-inactive { border-color: #ff0000; color: #ff0000; }
                .badge-soon { border-color: #ffaa00; color: #ffaa00; }
                button, .btn {
                    background: transparent;
                    border: 1px solid #fff;
                    color: #fff;
                    padding: 4px 12px;
                    cursor: pointer;
                    font-family: monospace;
                    font-size: 11px;
                    text-decoration: none;
                    display: inline-block;
                }
                button:hover, .btn:hover { background: #fff; color: #000; }
                select {
                    background: #0a0c10;
                    border: 1px solid #1f2230;
                    color: #fff;
                    padding: 4px;
                    font-family: monospace;
                }
                .create-form {
                    background: #14161c;
                    border: 1px solid #1f2230;
                    padding: 20px;
                    margin-bottom: 20px;
                    display: flex;
                    gap: 16px;
                    align-items: flex-end;
                    flex-wrap: wrap;
                }
                .form-group { display: flex; flex-direction: column; gap: 4px; }
                .form-group label { font-size: 11px; color: #888; }
                .action-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
                @media (max-width: 768px) {
                    th, td { padding: 8px; font-size: 11px; }
                    .action-buttons { flex-direction: column; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>XOLIRX VPN ADMIN</h2>
                    <div class="stats">
                        <div class="stat">USERS: <span>${users.length}</span></div>
                        <div class="stat">ACTIVE: <span>${users.filter(u => u.active && !u.isExpired).length}</span></div>
                        <div class="stat">REQUESTS: <span>${totalRequests}</span></div>
                    </div>
                </div>
                
                <div class="create-form">
                    <div class="form-group">
                        <label>SUBSCRIPTION DAYS</label>
                        <select id="createDays">
                            <option value="7">7 days</option>
                            <option value="14">14 days</option>
                            <option value="30">30 days</option>
                        </select>
                    </div>
                    <button onclick="createUser()">CREATE USER</button>
                </div>
                
                <div style="overflow-x: auto;">
                    <table>
                        <thead>
                            <tr><th>STATUS</th><th>TOKEN</th><th>CREATED</th><th>EXPIRES</th><th>LEFT</th><th>REQS</th><th>OS</th><th>ACTIONS</th></tr>
                        </thead>
                        <tbody>
                            ${users.map(user => {
                                let statusClass = 'badge-active'
                                let statusText = 'ACTIVE'
                                if (!user.active) {
                                    statusClass = 'badge-inactive'
                                    statusText = 'DISABLED'
                                } else if (user.isExpired) {
                                    statusClass = 'badge-expired'
                                    statusText = 'EXPIRED'
                                } else if (user.daysLeft <= 3) {
                                    statusClass = 'badge-soon'
                                    statusText = user.daysLeft + ' DAYS'
                                }
                                return `
                                    <tr>
                                        <td><span class="badge ${statusClass}">${statusText}</span></td>
                                        <td><code style="font-size: 10px;">${user.token.substring(0, 16)}...</code></td>
                                        <td style="font-size: 11px;">${user.created_at_formatted}</td>
                                        <td style="font-size: 11px;">${user.expires_at_formatted}</td>
                                        <td style="font-size: 11px;">${user.daysLeft} days</td>
                                        <td>${user.total_requests || 0}</td>
                                        <td style="font-size: 11px;">${user.os || 'unknown'}</td>
                                        <td class="action-buttons">
                                            ${user.active && !user.isExpired ? 
                                                `<button onclick="disableUser('${user.token}')">DISABLE</button>` : 
                                                `<button onclick="enableUser('${user.token}', 7)">ENABLE+7D</button>`
                                            }
                                            <select id="extend_${user.token}" style="width: 60px;">
                                                <option value="7">+7</option>
                                                <option value="14">+14</option>
                                                <option value="30">+30</option>
                                            </select>
                                            <button onclick="extendUser('${user.token}')">EXTEND</button>
                                            <a href="https://xolirx-vpn.vercel.app/?token=${user.token}" target="_blank" class="btn">VIEW</a>
                                        </td>
                                    </tr>
                                `
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <script>
                const ADMIN_KEY = '${adminKey}';
                
                function createUser() {
                    const days = document.getElementById('createDays').value;
                    fetch('/api/admin/create-user', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ days: parseInt(days), key: ADMIN_KEY })
                    }).then(() => location.reload());
                }
                
                function disableUser(token) {
                    if(confirm('Disable user?')) {
                        fetch('/api/admin/disable', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ token, key: ADMIN_KEY })
                        }).then(() => location.reload());
                    }
                }
                
                function enableUser(token, days) {
                    if(confirm('Enable user for ' + days + ' days?')) {
                        fetch('/api/admin/enable', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ token, days, key: ADMIN_KEY })
                        }).then(() => location.reload());
                    }
                }
                
                function extendUser(token) {
                    const days = document.getElementById('extend_' + token).value;
                    if(confirm('Extend by ' + days + ' days?')) {
                        fetch('/api/admin/extend', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ token, days: parseInt(days), key: ADMIN_KEY })
                        }).then(() => location.reload());
                    }
                }
            </script>
        </body>
        </html>
    `)
})

app.listen(PORT, () => {
    console.log(`XolirX VPN API running on port ${PORT}`)
    console.log(`Admin panel: http://localhost:${PORT}/admin`)
    console.log(`Admin key: ${ADMIN_KEY}`)
})
