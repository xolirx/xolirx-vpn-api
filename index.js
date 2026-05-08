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

app.get("/", async (req, res) => {
    const token = req.query.token
    
    if (token) {
        const users = loadUsers()
        const user = users.find(u => u.token === token && u.active === true)
        
        if (!user) {
            return res.redirect("/?error=invalid")
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
                            <div class="stat-value">${user.total_requests || 0}</div>
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
    
    const users = loadUsers()
    const servers = loadServers()
    const totalRequests = users.reduce((sum, u) => sum + (u.total_requests || 0), 0)
    
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
                }
                .btn:hover {
                    transform: translateY(-2px);
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
                button {
                    background: #ff4444;
                    color: white;
                    border: none;
                    padding: 0.25rem 0.5rem;
                    border-radius: 0.25rem;
                    cursor: pointer;
                }
                .create-form {
                    background: rgba(255,255,255,0.05);
                    border-radius: 1rem;
                    padding: 1.5rem;
                    margin-bottom: 2rem;
                }
                .create-form input {
                    padding: 0.5rem;
                    border-radius: 0.5rem;
                    border: 1px solid rgba(255,255,255,0.2);
                    background: rgba(0,0,0,0.5);
                    color: white;
                    margin-right: 1rem;
                }
                @media (max-width: 768px) {
                    body {
                        padding: 1rem;
                    }
                    th, td {
                        padding: 0.5rem;
                        font-size: 0.8rem;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>🔐 Админ панель XolirX VPN</h2>
                    <div class="stats">
                        <div class="stat">👥 Пользователей: <span>${users.length}</span></div>
                        <div class="stat">🟢 Активных: <span>${users.filter(u => u.active).length}</span></div>
                        <div class="stat">📊 Запросов: <span>${totalRequests}</span></div>
                        <div class="stat">🖥️ Серверов: <span>${servers.length}</span></div>
                    </div>
                </div>
                
                <div class="create-form">
                    <h3>➕ Создать нового пользователя</h3>
                    <form method="GET" action="/admin/create-user">
                        <input type="hidden" name="key" value="${adminKey}">
                        <button type="submit" class="btn">Создать подписку</button>
                    </form>
                </div>
                
                <table>
                    <thead>
                        <tr><th>Статус</th><th>Токен</th><th>Запросы</th><th>OS</th><th>IP</th><th>Last Seen</th><th>Действия</th></tr>
                    </thead>
                    <tbody>
                        ${users.map(user => `
                            <tr>
                                <td><span class="badge ${user.active ? 'badge-active' : 'badge-inactive'}">${user.active ? '✓ Активен' : '✗ Отключен'}</span></td>
                                <td><code>${user.token.substr(0, 16)}...</code></td>
                                <td>${user.total_requests || 0}</td>
                                <td>${user.os || 'Unknown'}</td>
                                <td>${user.last_ip || '-'}</td>
                                <td>${user.last_seen ? new Date(user.last_seen).toLocaleDateString() : '-'}</td>
                                <td>
                                    ${user.active ? `<a href="/admin/disable/${user.token}?key=${adminKey}" style="color: #ff4444; text-decoration: none;" onclick="return confirm('Отключить пользователя?')">🔴 Отключить</a>` : `<a href="/admin/enable/${user.token}?key=${adminKey}" style="color: #00ff00; text-decoration: none;">🟢 Включить</a>`}
                                    <a href="/?token=${user.token}" style="color: #667eea; text-decoration: none; margin-left: 0.5rem;" target="_blank">👁️ Просмотр</a>
                                </td>
                            </tr>
                        `).join('')}
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
    
    const user = {
        token: token,
        active: true,
        created_at: new Date().toISOString(),
        total_requests: 0,
        os: "Unknown",
        last_ip: null,
        last_seen: null
    }
    
    users.push(user)
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
    if (user) user.active = true
    saveUsers(users)
    res.redirect(`/admin/dashboard?key=${adminKey}`)
})

app.get("/sub/:token", (req, res) => {
    try {
        const token = req.params.token
        const users = loadUsers()
        const user = users.find(x => x.token === token && x.active === true)
        
        if (!user) {
            return res.status(403).send("Subscription expired or invalid")
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
        
        res.setHeader("Content-Type", "text/plain; charset=utf-8")
        res.setHeader("Profile-Title", "XolirX VPN")
        res.setHeader("Subscription-Userinfo", `upload=0; download=0; total=0; expire=0`)
        res.send(servers)
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
