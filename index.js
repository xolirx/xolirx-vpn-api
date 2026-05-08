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

function loadServers() {
    try {
        const vpnContent = fs.readFileSync(VPN_FILE, "utf-8")
        const lines = vpnContent.split("\n").filter(l => l.startsWith("vless://"))
        const servers = lines.map((line, index) => {
            const match = line.match(/vless:\/\/([^@]+)@([^:]+):(\d+)/)
            return {
                id: index,
                url: line,
                name: line.split("#").pop()?.replace(/[\[\]]/g, "") || "Server",
                server: match ? match[2] : "unknown"
            }
        }).filter(s => s)
        return servers
    } catch {
        return []
    }
}

function getUserSubscription(token) {
    const users = loadUsers()
    const user = users.find(u => u.token === token)
    if (!user) return null
    
    const now = new Date()
    const expiresAt = new Date(user.expires_at)
    const daysLeft = Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)))
    
    return {
        ...user,
        daysLeft,
        isExpired: now > expiresAt
    }
}

app.get("/", async (req, res) => {
    const token = req.query.token
    
    if (token) {
        const subscription = getUserSubscription(token)
        
        if (!subscription || !subscription.active || subscription.isExpired) {
            return res.send(`
                <!DOCTYPE html>
                <html lang="ru">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>XolirX VPN | Подписка недействительна</title>
                    <style>
                        body {
                            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
                            font-family: 'Inter', sans-serif;
                            color: #fff;
                            min-height: 100vh;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                        }
                        .card {
                            background: rgba(255,255,255,0.05);
                            backdrop-filter: blur(10px);
                            border-radius: 2rem;
                            padding: 2rem;
                            text-align: center;
                            max-width: 500px;
                        }
                        .btn {
                            display: inline-block;
                            margin-top: 1rem;
                            padding: 0.8rem 1.5rem;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            border-radius: 0.8rem;
                            color: white;
                            text-decoration: none;
                        }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h2>⛔ Подписка недействительна</h2>
                        <p>Ваша подписка истекла или была отключена.</p>
                        <p>Для продления напишите в Telegram: <strong>@xolirx</strong></p>
                        <a href="/" class="btn">На главную</a>
                    </div>
                </body>
                </html>
            `)
        }
        
        const servers = loadServers()
        const subscriptionUrl = `${req.protocol}://${req.get("host")}/sub/${token}`
        
        let qrCode = ""
        try {
            qrCode = await QRCode.toDataURL(subscriptionUrl)
        } catch (err) {
            qrCode = ""
        }
        
        res.send(`
            <!DOCTYPE html>
            <html lang="ru">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>XolirX VPN | Ваша подписка</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        color: #fff;
                        min-height: 100vh;
                    }
                    
                    .container {
                        max-width: 1200px;
                        margin: 0 auto;
                        padding: 2rem;
                    }
                    
                    .header {
                        text-align: center;
                        padding: 3rem 0;
                    }
                    
                    .logo {
                        font-size: 3rem;
                        font-weight: 800;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        -webkit-background-clip: text;
                        background-clip: text;
                        color: transparent;
                        margin-bottom: 0.5rem;
                    }
                    
                    .subtitle {
                        color: #888;
                        font-size: 1.1rem;
                    }
                    
                    .subscription-card {
                        background: rgba(255, 255, 255, 0.05);
                        backdrop-filter: blur(10px);
                        border-radius: 2rem;
                        padding: 2rem;
                        margin: 2rem 0;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                    }
                    
                    .section-title {
                        font-size: 1.5rem;
                        margin-bottom: 1.5rem;
                        color: #667eea;
                    }
                    
                    .url-box {
                        background: #000;
                        padding: 1rem;
                        border-radius: 1rem;
                        font-family: monospace;
                        word-break: break-all;
                        margin: 1rem 0;
                        border: 1px solid #333;
                    }
                    
                    .button-group {
                        display: flex;
                        gap: 1rem;
                        flex-wrap: wrap;
                        margin: 1.5rem 0;
                    }
                    
                    .btn {
                        padding: 0.8rem 1.5rem;
                        border: none;
                        border-radius: 0.8rem;
                        font-size: 1rem;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        text-decoration: none;
                        display: inline-block;
                    }
                    
                    .btn-primary {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                    }
                    
                    .btn-primary:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
                    }
                    
                    .btn-secondary {
                        background: rgba(255, 255, 255, 0.1);
                        color: white;
                        border: 1px solid rgba(255, 255, 255, 0.2);
                    }
                    
                    .btn-secondary:hover {
                        background: rgba(255, 255, 255, 0.2);
                    }
                    
                    .qr-container {
                        text-align: center;
                        padding: 2rem;
                        background: white;
                        border-radius: 1rem;
                        display: inline-block;
                    }
                    
                    .stats-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                        gap: 1.5rem;
                        margin: 2rem 0;
                    }
                    
                    .stat-card {
                        background: rgba(255, 255, 255, 0.03);
                        border-radius: 1rem;
                        padding: 1.5rem;
                        text-align: center;
                        border: 1px solid rgba(255, 255, 255, 0.05);
                    }
                    
                    .stat-value {
                        font-size: 2rem;
                        font-weight: bold;
                        color: #667eea;
                    }
                    
                    .stat-label {
                        color: #888;
                        margin-top: 0.5rem;
                    }
                    
                    .expiry-warning {
                        background: rgba(255, 193, 7, 0.1);
                        border: 1px solid rgba(255, 193, 7, 0.3);
                        border-radius: 1rem;
                        padding: 1rem;
                        margin: 1rem 0;
                        text-align: center;
                    }
                    
                    .steps {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                        gap: 2rem;
                        margin: 2rem 0;
                    }
                    
                    .step {
                        background: rgba(255, 255, 255, 0.03);
                        border-radius: 1rem;
                        padding: 1.5rem;
                        border: 1px solid rgba(255, 255, 255, 0.05);
                    }
                    
                    .step-number {
                        width: 40px;
                        height: 40px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-bottom: 1rem;
                        font-weight: bold;
                    }
                    
                    .footer {
                        text-align: center;
                        padding: 3rem 0;
                        color: #888;
                        border-top: 1px solid rgba(255, 255, 255, 0.05);
                        margin-top: 3rem;
                    }
                    
                    .admin-link {
                        position: fixed;
                        bottom: 20px;
                        right: 20px;
                        background: rgba(0,0,0,0.7);
                        padding: 0.5rem 1rem;
                        border-radius: 0.5rem;
                        font-size: 0.8rem;
                        color: #888;
                        text-decoration: none;
                    }
                    
                    @media (max-width: 768px) {
                        .container {
                            padding: 1rem;
                        }
                        .logo {
                            font-size: 2rem;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">XolirX VPN</div>
                        <div class="subtitle">Бесплатный VLESS · Анонимность · Безопасность</div>
                    </div>
                    
                    <div class="subscription-card">
                        <h2 class="section-title">Ваша подписка</h2>
                        ${subscription.daysLeft <= 3 ? `
                            <div class="expiry-warning">
                                ⚠️ Подписка истекает через ${subscription.daysLeft} ${getDayWord(subscription.daysLeft)}!
                                Для продления напишите @xolirx
                            </div>
                        ` : `
                            <div class="expiry-warning" style="background: rgba(102, 126, 234, 0.1); border-color: rgba(102, 126, 234, 0.3);">
                                ✅ Подписка активна до ${new Date(subscription.expires_at).toLocaleDateString()} (осталось ${subscription.daysLeft} ${getDayWord(subscription.daysLeft)})
                            </div>
                        `}
                        <div class="url-box" id="subscriptionUrl">${subscriptionUrl}</div>
                        <div class="button-group">
                            <button class="btn btn-primary" onclick="copyUrl()">📋 Копировать ссылку</button>
                            <a href="${subscriptionUrl}" class="btn btn-secondary">🔗 Открыть подписку</a>
                        </div>
                        <div style="text-align: center; margin-top: 2rem;">
                            <h3>📱 Сканируй для добавления подписки</h3>
                            <div style="margin-top: 1rem;">
                                <img src="${qrCode}" style="max-width: 200px; background: white; padding: 1rem; border-radius: 1rem;" alt="QR Code">
                            </div>
                        </div>
                    </div>
                    
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-value">${servers.length}</div>
                            <div class="stat-label">Серверов</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">VLESS</div>
                            <div class="stat-label">Протокол</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${subscription.total_requests || 0}</div>
                            <div class="stat-label">Запросов</div>
                        </div>
                    </div>
                    
                    <h2 class="section-title">Как подключиться</h2>
                    <div class="steps">
                        <div class="step">
                            <div class="step-number">1</div>
                            <h3>Скачай приложение</h3>
                            <p style="color: #888; margin-top: 0.5rem;">Happ, v2rayNG или Nekobox для Android/iOS</p>
                        </div>
                        <div class="step">
                            <div class="step-number">2</div>
                            <h3>Добавь подписку</h3>
                            <p style="color: #888; margin-top: 0.5rem;">Скопируй ссылку или отсканируй QR-код</p>
                        </div>
                        <div class="step">
                            <div class="step-number">3</div>
                            <h3>Обновляй раз в день</h3>
                            <p style="color: #888; margin-top: 0.5rem;">Новые серверы подтянутся автоматически</p>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p>XolirX VPN — анонимность и свобода в интернете</p>
                        <p style="margin-top: 0.5rem; font-size: 0.8rem;">Никаких логов. Только VLESS.</p>
                    </div>
                </div>
                
                <a href="/admin" class="admin-link">🔐 Админ панель</a>
                
                <script>
                    function copyUrl() {
                        const url = document.getElementById('subscriptionUrl').innerText;
                        navigator.clipboard.writeText(url);
                        alert('Ссылка скопирована!');
                    }
                </script>
            </body>
            </html>
        `)
    } else {
        res.send(`
            <!DOCTYPE html>
            <html lang="ru">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>XolirX VPN | Главная</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        color: #fff;
                        min-height: 100vh;
                    }
                    
                    .container {
                        max-width: 1200px;
                        margin: 0 auto;
                        padding: 2rem;
                    }
                    
                    .header {
                        text-align: center;
                        padding: 3rem 0;
                    }
                    
                    .logo {
                        font-size: 3rem;
                        font-weight: 800;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        -webkit-background-clip: text;
                        background-clip: text;
                        color: transparent;
                        margin-bottom: 0.5rem;
                    }
                    
                    .subtitle {
                        color: #888;
                        font-size: 1.1rem;
                    }
                    
                    .form-card {
                        background: rgba(255, 255, 255, 0.05);
                        backdrop-filter: blur(10px);
                        border-radius: 2rem;
                        padding: 2rem;
                        margin: 2rem 0;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        text-align: center;
                    }
                    
                    .input-group {
                        max-width: 400px;
                        margin: 1rem auto;
                    }
                    
                    input {
                        width: 100%;
                        padding: 1rem;
                        border-radius: 0.8rem;
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        background: rgba(0, 0, 0, 0.5);
                        color: white;
                        font-size: 1rem;
                    }
                    
                    .btn {
                        padding: 0.8rem 1.5rem;
                        border: none;
                        border-radius: 0.8rem;
                        font-size: 1rem;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                    }
                    
                    .btn:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
                    }
                    
                    .stats-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                        gap: 1.5rem;
                        margin: 2rem 0;
                    }
                    
                    .stat-card {
                        background: rgba(255, 255, 255, 0.03);
                        border-radius: 1rem;
                        padding: 1.5rem;
                        text-align: center;
                        border: 1px solid rgba(255, 255, 255, 0.05);
                    }
                    
                    .stat-icon {
                        font-size: 2rem;
                        margin-bottom: 1rem;
                    }
                    
                    .stat-title {
                        font-size: 1.2rem;
                        font-weight: bold;
                        margin-bottom: 0.5rem;
                    }
                    
                    .stat-desc {
                        color: #888;
                    }
                    
                    .steps {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                        gap: 2rem;
                        margin: 2rem 0;
                    }
                    
                    .step {
                        background: rgba(255, 255, 255, 0.03);
                        border-radius: 1rem;
                        padding: 1.5rem;
                        border: 1px solid rgba(255, 255, 255, 0.05);
                    }
                    
                    .step-number {
                        width: 40px;
                        height: 40px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-bottom: 1rem;
                        font-weight: bold;
                    }
                    
                    .footer {
                        text-align: center;
                        padding: 3rem 0;
                        color: #888;
                        border-top: 1px solid rgba(255, 255, 255, 0.05);
                        margin-top: 3rem;
                    }
                    
                    .admin-link {
                        position: fixed;
                        bottom: 20px;
                        right: 20px;
                        background: rgba(0,0,0,0.7);
                        padding: 0.5rem 1rem;
                        border-radius: 0.5rem;
                        font-size: 0.8rem;
                        color: #888;
                        text-decoration: none;
                    }
                    
                    @media (max-width: 768px) {
                        .container {
                            padding: 1rem;
                        }
                        .logo {
                            font-size: 2rem;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">XolirX VPN</div>
                        <div class="subtitle">Бесплатный VLESS · Анонимность · Безопасность</div>
                    </div>
                    
                    <div class="form-card">
                        <h2>VPN by xolirx</h2>
                        <p style="color: #888; margin: 1rem 0;">Введите токен подписки для доступа к конфигурациям</p>
                        <div class="input-group">
                            <input type="text" id="tokenInput" placeholder="Введите ваш токен..." onkeypress="handleKeyPress(event)">
                        </div>
                        <button class="btn" onclick="checkToken()">Получить подписку</button>
                    </div>
                    
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon">🔒</div>
                            <div class="stat-title">Безопасность</div>
                            <div class="stat-desc">Современное шифрование VLESS</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">👻</div>
                            <div class="stat-title">Анонимность</div>
                            <div class="stat-desc">Ни логов, ни следов</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">⚡</div>
                            <div class="stat-title">Скорость</div>
                            <div class="stat-desc">Оптимизированные сервера</div>
                        </div>
                    </div>
                    
                    <h2 style="color: #667eea; margin: 2rem 0 1rem;">Как подключиться</h2>
                    <div class="steps">
                        <div class="step">
                            <div class="step-number">1</div>
                            <h3>Скачай приложение</h3>
                            <p style="color: #888; margin-top: 0.5rem;">Happ для Android или iOS</p>
                        </div>
                        <div class="step">
                            <div class="step-number">2</div>
                            <h3>Добавь подписку</h3>
                            <p style="color: #888; margin-top: 0.5rem;">Скопируй ссылку или отсканируй QR-код</p>
                        </div>
                        <div class="step">
                            <div class="step-number">3</div>
                            <h3>Обновляй раз в день</h3>
                            <p style="color: #888; margin-top: 0.5rem;">Новые серверы подтянутся автоматически</p>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p>XolirX VPN — анонимность и свобода в интернете</p>
                    </div>
                </div>
                
                <a href="/admin" class="admin-link">🔐 Админ панель</a>
                
                <script>
                    function handleKeyPress(event) {
                        if (event.key === 'Enter') checkToken()
                    }
                    
                    function checkToken() {
                        const token = document.getElementById('tokenInput').value.trim()
                        if (token) {
                            window.location.href = '/?token=' + encodeURIComponent(token)
                        } else {
                            alert('Введите токен подписки')
                        }
                    }
                </script>
            </body>
            </html>
        `)
    }
})

function getDayWord(days) {
    if (days % 10 === 1 && days % 100 !== 11) return "день"
    if (days % 10 >= 2 && days % 10 <= 4 && (days % 100 < 10 || days % 100 >= 20)) return "дня"
    return "дней"
}

app.get("/admin", (req, res) => {
    const adminKey = req.query.key
    
    if (!adminKey || adminKey !== ADMIN_KEY) {
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>XolirX VPN | Админ панель</title>
                <style>
                    body {
                        background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
                        font-family: 'Inter', sans-serif;
                        color: white;
                        min-height: 100vh;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                    }
                    .login-card {
                        background: rgba(255,255,255,0.05);
                        backdrop-filter: blur(10px);
                        border-radius: 2rem;
                        padding: 2rem;
                        border: 1px solid rgba(255,255,255,0.1);
                        max-width: 400px;
                        width: 90%;
                    }
                    input {
                        width: 100%;
                        padding: 1rem;
                        border-radius: 0.8rem;
                        border: 1px solid rgba(255,255,255,0.2);
                        background: rgba(0,0,0,0.5);
                        color: white;
                        margin: 1rem 0;
                    }
                    button {
                        width: 100%;
                        padding: 1rem;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        border: none;
                        border-radius: 0.8rem;
                        color: white;
                        font-weight: bold;
                        cursor: pointer;
                    }
                </style>
            </head>
            <body>
                <div class="login-card">
                    <h2>🔐 Админ панель</h2>
                    <input type="password" id="keyInput" placeholder="Введите ключ доступа" onkeypress="handleKeyPress(event)">
                    <button onclick="login()">Войти</button>
                </div>
                <script>
                    function handleKeyPress(event) {
                        if (event.key === 'Enter') login()
                    }
                    function login() {
                        const key = document.getElementById('keyInput').value
                        window.location.href = '/admin/dashboard?key=' + encodeURIComponent(key)
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
    const servers = loadServers()
    const totalRequests = users.reduce((sum, u) => sum + (u.total_requests || 0), 0)
    const now = new Date()
    
    users = users.map(user => {
        const expiresAt = new Date(user.expires_at)
        return {
            ...user,
            expires_at_formatted: expiresAt.toLocaleDateString(),
            daysLeft: Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24))),
            isExpired: now > expiresAt
        }
    })
    
    res.send(`
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>XolirX VPN | Админ панель</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
                    font-family: 'Inter', sans-serif;
                    color: #fff;
                    padding: 2rem;
                }
                .container {
                    max-width: 1400px;
                    margin: 0 auto;
                }
                .header {
                    background: rgba(255,255,255,0.05);
                    backdrop-filter: blur(10px);
                    border-radius: 1rem;
                    padding: 1.5rem;
                    margin-bottom: 2rem;
                    border: 1px solid rgba(255,255,255,0.1);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                }
                .stats {
                    display: flex;
                    gap: 1rem;
                    flex-wrap: wrap;
                }
                .stat {
                    background: rgba(0,0,0,0.5);
                    padding: 0.5rem 1rem;
                    border-radius: 0.5rem;
                }
                .stat span {
                    color: #667eea;
                    font-weight: bold;
                }
                .btn {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 0.5rem 1rem;
                    border-radius: 0.5rem;
                    text-decoration: none;
                    color: white;
                    transition: all 0.3s;
                    border: none;
                    cursor: pointer;
                    font-size: 0.9rem;
                }
                .btn:hover {
                    transform: translateY(-2px);
                }
                .btn-danger {
                    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                }
                .btn-success {
                    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                }
                table {
                    width: 100%;
                    background: rgba(255,255,255,0.03);
                    border-radius: 1rem;
                    overflow: hidden;
                    border-collapse: collapse;
                }
                th, td {
                    padding: 1rem;
                    text-align: left;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }
                th {
                    background: rgba(0,0,0,0.3);
                    color: #667eea;
                }
                .badge {
                    padding: 0.25rem 0.5rem;
                    border-radius: 0.25rem;
                    font-size: 0.8rem;
                }
                .badge-active {
                    background: rgba(0,255,0,0.2);
                    color: #0f0;
                }
                .badge-inactive {
                    background: rgba(255,0,0,0.2);
                    color: #f00;
                }
                .badge-expired {
                    background: rgba(255,0,0,0.2);
                    color: #f00;
                }
                .badge-soon {
                    background: rgba(255,193,7,0.2);
                    color: #ffc107;
                }
                .action-buttons {
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }
                select {
                    padding: 0.25rem;
                    border-radius: 0.25rem;
                    background: #000;
                    color: white;
                    border: 1px solid #333;
                }
                .create-form {
                    background: rgba(255,255,255,0.05);
                    border-radius: 1rem;
                    padding: 1.5rem;
                    margin-bottom: 2rem;
                }
                @media (max-width: 768px) {
                    body {
                        padding: 1rem;
                    }
                    th, td {
                        padding: 0.5rem;
                        font-size: 0.8rem;
                    }
                    .action-buttons {
                        flex-direction: column;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>🔐 Админ панель XolirX VPN</h2>
                    <div class="stats">
                        <div class="stat">👥 Всего: <span>${users.length}</span></div>
                        <div class="stat">🟢 Активных: <span>${users.filter(u => u.active && !u.isExpired).length}</span></div>
                        <div class="stat">📊 Запросов: <span>${totalRequests}</span></div>
                        <div class="stat">🖥️ Серверов: <span>${servers.length}</span></div>
                    </div>
                </div>
                
                <div class="create-form">
                    <h3>➕ Создать нового пользователя</h3>
                    <form method="GET" action="/admin/create-user" style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                        <input type="hidden" name="key" value="${adminKey}">
                        <label>Дней подписки: 
                            <select name="days">
                                <option value="7">7 дней</option>
                                <option value="14">14 дней</option>
                                <option value="30">30 дней</option>
                                <option value="60">60 дней</option>
                                <option value="90">90 дней</option>
                            </select>
                        </label>
                        <button type="submit" class="btn">Создать подписку</button>
                    </form>
                </div>
                
                <table>
                    <thead>
                        <tr><th>Статус</th><th>Токен</th><th>Создан</th><th>Истекает</th><th>Дней</th><th>Запросы</th><th>OS</th><th>Действия</th></tr>
                    </thead>
                    <tbody>
                        ${users.map(user => {
                            let statusClass = ''
                            let statusText = ''
                            if (!user.active) {
                                statusClass = 'badge-inactive'
                                statusText = '✗ Отключен'
                            } else if (user.isExpired) {
                                statusClass = 'badge-expired'
                                statusText = '⛔ Истекла'
                            } else if (user.daysLeft <= 3) {
                                statusClass = 'badge-soon'
                                statusText = '⚠️ Скоро'
                            } else {
                                statusClass = 'badge-active'
                                statusText = '✓ Активен'
                            }
                            return `
                                <tr>
                                    <td><span class="badge ${statusClass}">${statusText}</span></td>
                                    <td><code>${user.token.substring(0, 16)}...</code><br><small style="color:#888">${user.token.substring(16, 32)}</small></td>
                                    <td>${new Date(user.created_at).toLocaleDateString()}</td>
                                    <td>${user.expires_at_formatted}</td>
                                    <td>${user.daysLeft} ${getDayWord(user.daysLeft)}</td>
                                    <td>${user.total_requests || 0}</td>
                                    <td>${user.os || 'Unknown'}</td>
                                    <td>
                                        <div class="action-buttons">
                                            ${user.active && !user.isExpired ? 
                                                `<a href="/admin/disable/${user.token}?key=${adminKey}" class="btn btn-danger" onclick="return confirm('Отключить пользователя ${user.token.substring(0, 8)}?')">🔴 Отключить</a>` : 
                                                (user.isExpired || !user.active) ?
                                                `<a href="/admin/enable/${user.token}?key=${adminKey}&days=7" class="btn btn-success" onclick="return confirm('Продлить подписку на 7 дней?')">🟢 Продлить 7д</a>` :
                                                `<a href="/admin/enable/${user.token}?key=${adminKey}&days=7" class="btn btn-success" onclick="return confirm('Включить подписку на 7 дней?')">🟢 Включить</a>`
                                            }
                                            <form method="GET" action="/admin/extend/${user.token}" style="display: inline;">
                                                <input type="hidden" name="key" value="${adminKey}">
                                                <select name="days" style="padding: 0.25rem;">
                                                    <option value="7">+7 дней</option>
                                                    <option value="14">+14 дней</option>
                                                    <option value="30">+30 дней</option>
                                                </select>
                                                <button type="submit" class="btn" onclick="return confirm('Продлить подписку?')">📅 Продлить</button>
                                            </form>
                                            <a href="/?token=${user.token}" target="_blank" class="btn">👁️ Просмотр</a>
                                        </div>
                                    </td>
                                </tr>
                            `
                        }).join('')}
                    </tbody>
                </table>
                
                <div style="margin-top: 2rem; text-align: center;">
                    <a href="/" class="btn">← На главную</a>
                </div>
            </div>
        </body>
        </html>
    `)
})

app.get("/admin/create-user", (req, res) => {
    const adminKey = req.query.key
    
    if (!adminKey || adminKey !== ADMIN_KEY) {
        return res.redirect("/admin")
    }
    
    const users = loadUsers()
    const token = generateToken()
    const days = parseInt(req.query.days) || 7
    const expires_at = new Date()
    expires_at.setDate(expires_at.getDate() + days)
    
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
    
    res.redirect(`/admin/dashboard?key=${adminKey}`)
})

app.get("/admin/extend/:token", (req, res) => {
    const adminKey = req.query.key
    
    if (!adminKey || adminKey !== ADMIN_KEY) {
        return res.redirect("/admin")
    }
    
    const users = loadUsers()
    const user = users.find(u => u.token === req.params.token)
    if (user) {
        const days = parseInt(req.query.days) || 7
        const currentExpiry = new Date(user.expires_at)
        const now = new Date()
        const newExpiry = new Date(Math.max(currentExpiry.getTime(), now.getTime()))
        newExpiry.setDate(newExpiry.getDate() + days)
        user.expires_at = newExpiry.toISOString()
        user.active = true
    }
    saveUsers(users)
    res.redirect(`/admin/dashboard?key=${adminKey}`)
})

app.get("/admin/disable/:token", (req, res) => {
    const adminKey = req.query.key
    
    if (!adminKey || adminKey !== ADMIN_KEY) {
        return res.redirect("/admin")
    }
    
    const users = loadUsers()
    const user = users.find(u => u.token === req.params.token)
    if (user) user.active = false
    saveUsers(users)
    res.redirect(`/admin/dashboard?key=${adminKey}`)
})

app.get("/admin/enable/:token", (req, res) => {
    const adminKey = req.query.key
    
    if (!adminKey || adminKey !== ADMIN_KEY) {
        return res.redirect("/admin")
    }
    
    const users = loadUsers()
    const user = users.find(u => u.token === req.params.token)
    if (user) {
        const days = parseInt(req.query.days) || 7
        const newExpiry = new Date()
        newExpiry.setDate(newExpiry.getDate() + days)
        user.expires_at = newExpiry.toISOString()
        user.active = true
    }
    saveUsers(users)
    res.redirect(`/admin/dashboard?key=${adminKey}`)
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
        
        res.setHeader("Content-Type", "text/plain; charset=utf-8")
        res.setHeader("Profile-Title", "XolirX VPN")
        res.setHeader("Subscription-Userinfo", `upload=0; download=0; total=0; expire=0`)
        res.setHeader("Profile-Update-Interval", "1")
        res.setHeader("Support-Url", "https://t.me/xolirx")
        
        let result = `#profile-title: XolirX VPN\n`
        result += `#profile-update-interval: 1\n`
        result += `#subscription-userinfo: upload=0; download=0; total=0; expire=0\n`
        result += `#support-url: https://t.me/xolirx\n`
        result += `#announce: 🌐 Осталось дней: ${daysLeft} 🌐 Для продления пиши @xolirx\n\n`
        result += servers
        
        res.send(result)
    } catch {
        res.status(500).send("Internal Server Error")
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

app.listen(PORT, () => {
    console.log(`XolirX VPN API running on port ${PORT}`)
    console.log(`Admin panel: http://localhost:${PORT}/admin`)
    console.log(`Admin key: ${ADMIN_KEY}`)
})
