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
    const createdDate = new Date(user.created_at)
    const daysLeft = Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)))
    const totalDays = Math.ceil((expiresAt - createdDate) / (1000 * 60 * 60 * 24))
    const usedDays = totalDays - daysLeft
    const progressPercent = totalDays > 0 ? (daysLeft / totalDays) * 100 : 0
    
    return {
        ...user,
        daysLeft,
        totalDays,
        usedDays,
        progressPercent,
        isExpired: now > expiresAt,
        expiresAtDate: expiresAt
    }
}

function getDayWord(days) {
    if (days % 10 === 1 && days % 100 !== 11) return "день"
    if (days % 10 >= 2 && days % 10 <= 4 && (days % 100 < 10 || days % 100 >= 20)) return "дня"
    return "дней"
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
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body {
                            background: #0a0c10;
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                            min-height: 100vh;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            padding: 20px;
                        }
                        .card {
                            background: #14161c;
                            border: 1px solid #1f2230;
                            border-radius: 32px;
                            padding: 40px;
                            max-width: 500px;
                            width: 100%;
                            text-align: center;
                        }
                        h2 { color: #fff; margin-bottom: 16px; font-size: 28px; }
                        p { color: #6b7280; margin-bottom: 24px; line-height: 1.6; }
                        .btn {
                            display: inline-block;
                            padding: 12px 28px;
                            background: #2563eb;
                            color: white;
                            text-decoration: none;
                            border-radius: 40px;
                            font-weight: 500;
                            transition: 0.2s;
                        }
                        .btn:hover { background: #1d4ed8; transform: translateY(-2px); }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h2>⛔ Подписка недействительна</h2>
                        <p>Ваша подписка истекла или была отключена.</p>
                        <p>Для продления напишите в Telegram: <strong style="color:#2563eb">@xolirx</strong></p>
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
                <title>XolirX VPN | Моя подписка</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        background: #0a0c10;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        color: #fff;
                    }
                    .container { max-width: 1200px; margin: 0 auto; padding: 40px 24px; }
                    
                    .header { text-align: center; margin-bottom: 48px; }
                    .logo { font-size: 42px; font-weight: 700; background: linear-gradient(135deg, #2563eb, #60a5fa); -webkit-background-clip: text; background-clip: text; color: transparent; margin-bottom: 8px; }
                    .subtitle { color: #6b7280; font-size: 16px; }
                    
                    .subscription-card {
                        background: #14161c;
                        border: 1px solid #1f2230;
                        border-radius: 32px;
                        padding: 32px;
                        margin-bottom: 32px;
                    }
                    .section-title { font-size: 20px; font-weight: 600; margin-bottom: 24px; color: #e5e7eb; }
                    
                    .url-box {
                        background: #0a0c10;
                        padding: 16px;
                        border-radius: 16px;
                        font-family: monospace;
                        word-break: break-all;
                        border: 1px solid #1f2230;
                        margin-bottom: 20px;
                    }
                    
                    .button-group { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 32px; }
                    .btn {
                        padding: 12px 24px;
                        border: none;
                        border-radius: 40px;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s;
                        text-decoration: none;
                        display: inline-block;
                    }
                    .btn-primary { background: #2563eb; color: white; }
                    .btn-primary:hover { background: #1d4ed8; transform: translateY(-2px); }
                    .btn-secondary { background: #1f2230; color: #e5e7eb; border: 1px solid #2d3040; }
                    .btn-secondary:hover { background: #2d3040; transform: translateY(-2px); }
                    
                    .qr-section { text-align: center; margin-top: 24px; }
                    .qr-section h3 { font-size: 16px; font-weight: 500; margin-bottom: 16px; color: #9ca3af; }
                    .qr-code { background: white; padding: 16px; border-radius: 24px; display: inline-block; }
                    .qr-code img { width: 180px; height: 180px; }
                    
                    .stats-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 20px;
                        margin-bottom: 32px;
                    }
                    .stat-card {
                        background: #14161c;
                        border: 1px solid #1f2230;
                        border-radius: 24px;
                        padding: 24px;
                        text-align: center;
                    }
                    .stat-value { font-size: 32px; font-weight: 700; color: #2563eb; }
                    .stat-label { color: #6b7280; font-size: 14px; margin-top: 8px; }
                    
                    .progress-section {
                        background: #14161c;
                        border: 1px solid #1f2230;
                        border-radius: 24px;
                        padding: 24px;
                        margin-bottom: 32px;
                    }
                    .progress-header { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; color: #9ca3af; }
                    .progress-bar { background: #1f2230; border-radius: 40px; height: 8px; overflow: hidden; }
                    .progress-fill { width: ${subscription.progressPercent}%; height: 100%; background: linear-gradient(135deg, #2563eb, #60a5fa); border-radius: 40px; transition: width 0.3s; }
                    .expiry-box {
                        background: rgba(37, 99, 235, 0.1);
                        border: 1px solid rgba(37, 99, 235, 0.2);
                        border-radius: 16px;
                        padding: 16px;
                        text-align: center;
                        margin-top: 16px;
                    }
                    
                    .steps {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                        gap: 24px;
                        margin-bottom: 32px;
                    }
                    .step {
                        background: #14161c;
                        border: 1px solid #1f2230;
                        border-radius: 24px;
                        padding: 24px;
                    }
                    .step-number {
                        width: 40px;
                        height: 40px;
                        background: #2563eb;
                        border-radius: 40px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: 700;
                        margin-bottom: 16px;
                    }
                    .step h3 { font-size: 18px; margin-bottom: 8px; }
                    .step p { color: #6b7280; font-size: 14px; line-height: 1.5; }
                    
                    .footer { text-align: center; padding: 32px 0; color: #6b7280; font-size: 13px; border-top: 1px solid #1f2230; margin-top: 32px; }
                    .admin-link {
                        position: fixed;
                        bottom: 24px;
                        right: 24px;
                        background: #1f2230;
                        padding: 10px 20px;
                        border-radius: 40px;
                        font-size: 13px;
                        color: #9ca3af;
                        text-decoration: none;
                        transition: 0.2s;
                    }
                    .admin-link:hover { background: #2d3040; color: #fff; }
                    
                    @media (max-width: 768px) {
                        .container { padding: 20px 16px; }
                        .logo { font-size: 32px; }
                        .subscription-card { padding: 20px; }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">XolirX VPN</div>
                        <div class="subtitle">Безопасный и анонимный доступ в интернет</div>
                    </div>
                    
                    <div class="subscription-card">
                        <h2 class="section-title">🔗 Ваша подписка</h2>
                        <div class="url-box" id="subscriptionUrl">${subscriptionUrl}</div>
                        <div class="button-group">
                            <button class="btn btn-primary" onclick="copyUrl()">📋 Копировать ссылку</button>
                            <a href="${subscriptionUrl}" class="btn btn-secondary">🔗 Открыть подписку</a>
                        </div>
                        <div class="qr-section">
                            <h3>📱 Сканируй для быстрого добавления</h3>
                            <div class="qr-code">
                                <img src="${qrCode}" alt="QR Code">
                            </div>
                        </div>
                    </div>
                    
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-value">${servers.length}</div>
                            <div class="stat-label">Серверов в сети</div>
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
                    
                    <div class="progress-section">
                        <div class="progress-header">
                            <span>📅 Прогресс подписки</span>
                            <span>${subscription.usedDays} / ${subscription.totalDays} дней</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill"></div>
                        </div>
                        <div class="expiry-box">
                            ${subscription.daysLeft <= 3 ? 
                                `<span>⚠️ Подписка истекает через ${subscription.daysLeft} ${getDayWord(subscription.daysLeft)}</span>` :
                                `<span>✅ Подписка активна до ${subscription.expiresAtDate.toLocaleDateString()} (осталось ${subscription.daysLeft} ${getDayWord(subscription.daysLeft)})</span>`
                            }
                        </div>
                    </div>
                    
                    <h2 class="section-title">📖 Как подключиться</h2>
                    <div class="steps">
                        <div class="step">
                            <div class="step-number">1</div>
                            <h3>Скачай приложение</h3>
                            <p>Happ, v2rayNG или Nekobox для Android/iOS</p>
                        </div>
                        <div class="step">
                            <div class="step-number">2</div>
                            <h3>Добавь подписку</h3>
                            <p>Скопируй ссылку или отсканируй QR-код</p>
                        </div>
                        <div class="step">
                            <div class="step-number">3</div>
                            <h3>Обновляй раз в день</h3>
                            <p>Новые серверы подтянутся автоматически</p>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p>XolirX VPN — анонимность и свобода в интернете</p>
                        <p style="margin-top: 8px; font-size: 12px;">Никаких логов. Только VLESS.</p>
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
        const users = loadUsers()
        const servers = loadServers()
        
        res.send(`
            <!DOCTYPE html>
            <html lang="ru">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>XolirX VPN | Главная</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        background: #0a0c10;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        color: #fff;
                        min-height: 100vh;
                    }
                    .container { max-width: 1200px; margin: 0 auto; padding: 60px 24px; }
                    
                    .header { text-align: center; margin-bottom: 60px; }
                    .logo { font-size: 56px; font-weight: 800; background: linear-gradient(135deg, #2563eb, #60a5fa); -webkit-background-clip: text; background-clip: text; color: transparent; margin-bottom: 16px; }
                    .tagline { font-size: 20px; color: #6b7280; margin-bottom: 8px; }
                    .sub { color: #374151; font-size: 14px; }
                    
                    .generate-card {
                        background: #14161c;
                        border: 1px solid #1f2230;
                        border-radius: 32px;
                        padding: 48px;
                        text-align: center;
                        margin-bottom: 60px;
                    }
                    .generate-card h2 { font-size: 28px; margin-bottom: 16px; }
                    .generate-card p { color: #6b7280; margin-bottom: 32px; }
                    .generate-btn {
                        background: #2563eb;
                        color: white;
                        border: none;
                        padding: 16px 48px;
                        font-size: 18px;
                        font-weight: 600;
                        border-radius: 48px;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .generate-btn:hover { background: #1d4ed8; transform: translateY(-2px); }
                    
                    .features {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                        gap: 32px;
                        margin-bottom: 60px;
                    }
                    .feature {
                        background: #14161c;
                        border: 1px solid #1f2230;
                        border-radius: 28px;
                        padding: 32px;
                        text-align: center;
                    }
                    .feature-icon { font-size: 48px; margin-bottom: 20px; }
                    .feature h3 { font-size: 22px; margin-bottom: 12px; }
                    .feature p { color: #6b7280; line-height: 1.6; }
                    
                    .steps {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                        gap: 24px;
                        margin-bottom: 60px;
                    }
                    .step {
                        background: #14161c;
                        border: 1px solid #1f2230;
                        border-radius: 24px;
                        padding: 28px;
                    }
                    .step-number {
                        width: 48px;
                        height: 48px;
                        background: #2563eb;
                        border-radius: 48px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 20px;
                        font-weight: 700;
                        margin-bottom: 20px;
                    }
                    .step h3 { font-size: 20px; margin-bottom: 10px; }
                    .step p { color: #6b7280; line-height: 1.5; }
                    
                    .token-section {
                        background: #14161c;
                        border: 1px solid #1f2230;
                        border-radius: 24px;
                        padding: 24px;
                        margin-top: 20px;
                        text-align: center;
                    }
                    .token-section.hidden { display: none; }
                    .token-box {
                        background: #0a0c10;
                        padding: 16px;
                        border-radius: 16px;
                        margin: 20px 0;
                        word-break: break-all;
                        font-family: monospace;
                        font-size: 14px;
                    }
                    
                    .footer { text-align: center; padding: 32px 0; color: #6b7280; font-size: 13px; border-top: 1px solid #1f2230; }
                    .admin-link {
                        position: fixed;
                        bottom: 24px;
                        right: 24px;
                        background: #1f2230;
                        padding: 10px 20px;
                        border-radius: 40px;
                        font-size: 13px;
                        color: #9ca3af;
                        text-decoration: none;
                        transition: 0.2s;
                    }
                    .admin-link:hover { background: #2d3040; color: #fff; }
                    
                    @media (max-width: 768px) {
                        .container { padding: 32px 16px; }
                        .logo { font-size: 40px; }
                        .generate-card { padding: 32px 24px; }
                        .generate-btn { padding: 14px 32px; font-size: 16px; }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">XolirX VPN</div>
                        <div class="tagline">Бесплатный VLESS · Анонимность · Безопасность</div>
                        <div class="sub">Современное шифрование · Никаких логов · Оптимизированные сервера</div>
                    </div>
                    
                    <div class="generate-card">
                        <h2>🚀 Начни использовать VPN бесплатно</h2>
                        <p>Сгенерируй персональную подписку и получи доступ к защищенному интернету</p>
                        <button class="generate-btn" onclick="generateSubscription()">✨ Сгенерировать подписку</button>
                        
                        <div id="tokenResult" class="token-section hidden">
                            <h3>🎉 Ваша подписка готова!</h3>
                            <p>Сохраните эту ссылку — она понадобится для подключения</p>
                            <div class="token-box" id="subscriptionLink"></div>
                            <button class="btn-primary" style="background:#2563eb; padding:10px 24px; border-radius:40px; border:none; color:white; cursor:pointer; margin-right:12px;" onclick="copySubscription()">📋 Копировать ссылку</button>
                            <button class="btn-secondary" style="background:#1f2230; padding:10px 24px; border-radius:40px; border:1px solid #2d3040; color:white; cursor:pointer;" onclick="openSubscription()">🔗 Открыть</button>
                            <p style="margin-top: 20px; font-size: 13px; color:#6b7280;">Подписка активна 7 дней. Для продления обратитесь к @xolirx</p>
                        </div>
                    </div>
                    
                    <div class="features">
                        <div class="feature">
                            <div class="feature-icon">🔒</div>
                            <h3>Безопасность</h3>
                            <p>Современное шифрование VLESS. Никаких компромиссов с твоей безопасностью.</p>
                        </div>
                        <div class="feature">
                            <div class="feature-icon">👻</div>
                            <h3>Анонимность</h3>
                            <p>Ни логов, ни следов. Только ты и интернет. Твои данные под защитой.</p>
                        </div>
                        <div class="feature">
                            <div class="feature-icon">⚡</div>
                            <h3>Скорость</h3>
                            <p>Оптимизированные сервера для быстрого соединения без потери скорости.</p>
                        </div>
                    </div>
                    
                    <h2 style="font-size: 28px; text-align: center; margin-bottom: 32px;">Как подключиться</h2>
                    <div class="steps">
                        <div class="step">
                            <div class="step-number">1</div>
                            <h3>Скачай приложение</h3>
                            <p>Установи Happ, v2rayNG или Nekobox для твоего устройства</p>
                        </div>
                        <div class="step">
                            <div class="step-number">2</div>
                            <h3>Добавь подписку</h3>
                            <p>Вставь полученную ссылку или отсканируй QR-код</p>
                        </div>
                        <div class="step">
                            <div class="step-number">3</div>
                            <h3>Наслаждайся</h3>
                            <p>Включи VPN и пользуйся интернетом без ограничений</p>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p>XolirX VPN — анонимность и свобода в интернете</p>
                        <p style="margin-top: 8px;">По вопросам сотрудничества: @xolirx</p>
                    </div>
                </div>
                
                <a href="/admin" class="admin-link">🔐 Админ панель</a>
                
                <script>
                    async function generateSubscription() {
                        const btn = document.querySelector('.generate-btn')
                        const originalText = btn.innerText
                        btn.innerText = '⏳ Генерация...'
                        btn.disabled = true
                        
                        try {
                            const response = await fetch('/api/create-subscription', { method: 'POST' })
                            const data = await response.json()
                            
                            if (data.success) {
                                const link = \`\${window.location.origin}/?token=\${data.token}\`
                                document.getElementById('subscriptionLink').innerText = link
                                document.getElementById('tokenResult').classList.remove('hidden')
                                document.getElementById('tokenResult').scrollIntoView({ behavior: 'smooth' })
                            } else {
                                alert('Ошибка при генерации подписки')
                            }
                        } catch (error) {
                            alert('Ошибка сети. Попробуйте позже.')
                        } finally {
                            btn.innerText = originalText
                            btn.disabled = false
                        }
                    }
                    
                    function copySubscription() {
                        const link = document.getElementById('subscriptionLink').innerText
                        navigator.clipboard.writeText(link)
                        alert('Ссылка скопирована!')
                    }
                    
                    function openSubscription() {
                        const link = document.getElementById('subscriptionLink').innerText
                        window.open(link, '_blank')
                    }
                </script>
            </body>
            </html>
        `)
    }
})

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
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        background: #0a0c10;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        min-height: 100vh;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        padding: 20px;
                    }
                    .login-card {
                        background: #14161c;
                        border: 1px solid #1f2230;
                        border-radius: 32px;
                        padding: 48px;
                        max-width: 420px;
                        width: 100%;
                        text-align: center;
                    }
                    .login-card h2 { font-size: 28px; margin-bottom: 8px; color: #fff; }
                    .login-card p { color: #6b7280; margin-bottom: 32px; }
                    input {
                        width: 100%;
                        padding: 16px;
                        background: #0a0c10;
                        border: 1px solid #1f2230;
                        border-radius: 48px;
                        color: white;
                        font-size: 16px;
                        margin-bottom: 20px;
                    }
                    input:focus { outline: none; border-color: #2563eb; }
                    button {
                        width: 100%;
                        padding: 16px;
                        background: #2563eb;
                        border: none;
                        border-radius: 48px;
                        color: white;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: 0.2s;
                    }
                    button:hover { background: #1d4ed8; }
                </style>
            </head>
            <body>
                <div class="login-card">
                    <h2>🔐 Админ панель</h2>
                    <p>Введите ключ доступа для управления подписками</p>
                    <input type="password" id="keyInput" placeholder="Ключ доступа" onkeypress="if(event.key==='Enter') login()">
                    <button onclick="login()">Войти</button>
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
    const servers = loadServers()
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
            progressPercent: totalDays > 0 ? (daysLeft / totalDays) * 100 : 0,
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
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    background: #0a0c10;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    color: #fff;
                    padding: 24px;
                }
                .container { max-width: 1600px; margin: 0 auto; }
                
                .header {
                    background: #14161c;
                    border: 1px solid #1f2230;
                    border-radius: 28px;
                    padding: 24px 32px;
                    margin-bottom: 32px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 20px;
                }
                .header h2 { font-size: 24px; }
                .stats { display: flex; gap: 16px; flex-wrap: wrap; }
                .stat {
                    background: #0a0c10;
                    padding: 8px 20px;
                    border-radius: 40px;
                    border: 1px solid #1f2230;
                }
                .stat span { color: #2563eb; font-weight: 700; }
                
                .create-card {
                    background: #14161c;
                    border: 1px solid #1f2230;
                    border-radius: 28px;
                    padding: 28px 32px;
                    margin-bottom: 32px;
                }
                .create-card h3 { margin-bottom: 20px; font-size: 20px; }
                .form-row { display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap; }
                .form-group { display: flex; flex-direction: column; gap: 8px; }
                .form-group label { font-size: 13px; color: #6b7280; }
                select, .form-group input {
                    background: #0a0c10;
                    border: 1px solid #1f2230;
                    padding: 12px 20px;
                    border-radius: 40px;
                    color: white;
                    font-size: 14px;
                    cursor: pointer;
                }
                .btn {
                    background: #2563eb;
                    border: none;
                    padding: 12px 28px;
                    border-radius: 40px;
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                    text-decoration: none;
                    display: inline-block;
                    transition: 0.2s;
                }
                .btn:hover { background: #1d4ed8; transform: translateY(-2px); }
                .btn-danger { background: #dc2626; }
                .btn-danger:hover { background: #b91c1c; }
                .btn-success { background: #10b981; }
                .btn-success:hover { background: #059669; }
                .btn-sm { padding: 6px 14px; font-size: 12px; }
                
                .table-wrapper {
                    background: #14161c;
                    border: 1px solid #1f2230;
                    border-radius: 28px;
                    overflow-x: auto;
                }
                table { width: 100%; border-collapse: collapse; }
                th, td { padding: 16px; text-align: left; border-bottom: 1px solid #1f2230; }
                th { color: #6b7280; font-weight: 500; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
                td { font-size: 14px; }
                .badge {
                    padding: 4px 10px;
                    border-radius: 40px;
                    font-size: 12px;
                    font-weight: 500;
                    display: inline-block;
                }
                .badge-active { background: rgba(16, 185, 129, 0.2); color: #10b981; }
                .badge-inactive { background: rgba(220, 38, 38, 0.2); color: #ef4444; }
                .badge-expired { background: rgba(220, 38, 38, 0.2); color: #ef4444; }
                .badge-soon { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
                
                .progress-mini { width: 80px; background: #1f2230; border-radius: 40px; height: 4px; overflow: hidden; display: inline-block; margin-left: 8px; }
                .progress-mini-fill { height: 100%; background: #2563eb; border-radius: 40px; }
                
                .action-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
                
                .footer { text-align: center; padding: 32px 0; color: #6b7280; font-size: 13px; }
                
                @media (max-width: 768px) {
                    body { padding: 16px; }
                    th, td { padding: 12px; }
                    .action-buttons { flex-direction: column; }
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
                
                <div class="create-card">
                    <h3>➕ Создать нового пользователя</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Срок подписки</label>
                            <select id="createDays">
                                <option value="7">7 дней</option>
                                <option value="14">14 дней</option>
                                <option value="30">30 дней</option>
                                <option value="60">60 дней</option>
                                <option value="90">90 дней</option>
                            </select>
                        </div>
                        <button class="btn" onclick="createUser()">Создать подписку</button>
                    </div>
                </div>
                
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr><th>Статус</th><th>Токен</th><th>Создан</th><th>Истекает</th><th>Осталось</th><th>Прогресс</th><th>Запросы</th><th>OS</th><th>Действия</th></tr>
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
                                    statusText = `⚠️ ${user.daysLeft} дн.`
                                } else {
                                    statusClass = 'badge-active'
                                    statusText = '✓ Активен'
                                }
                                return `
                                    <tr>
                                        <td><span class="badge ${statusClass}">${statusText}</span></td>
                                        <td><code style="font-size: 11px;">${user.token.substring(0, 16)}...</code></td>
                                        <td style="font-size: 12px;">${user.created_at_formatted}</td>
                                        <td style="font-size: 12px;">${user.expires_at_formatted}</td>
                                        <td style="font-size: 13px; font-weight: 500;">${user.daysLeft} ${getDayWord(user.daysLeft)}</td>
                                        <td>
                                            <span style="font-size: 11px;">${user.usedDays}/${user.totalDays}</span>
                                            <div class="progress-mini">
                                                <div class="progress-mini-fill" style="width: ${100 - user.progressPercent}%"></div>
                                            </div>
                                        </td>
                                        <td>${user.total_requests || 0}</td>
                                        <td style="font-size: 12px;">${user.os || 'Unknown'}</td>
                                        <td>
                                            <div class="action-buttons">
                                                ${user.active && !user.isExpired ? 
                                                    `<button class="btn btn-danger btn-sm" onclick="disableUser('${user.token}')">🔴 Откл</button>` : 
                                                    `<button class="btn btn-success btn-sm" onclick="enableUser('${user.token}', 7)">🟢 Вкл/7д</button>`
                                                }
                                                <select id="extendDays_${user.token}" style="padding: 4px 8px; font-size: 11px;">
                                                    <option value="7">+7</option>
                                                    <option value="14">+14</option>
                                                    <option value="30">+30</option>
                                                </select>
                                                <button class="btn btn-sm" style="background:#374151;" onclick="extendUser('${user.token}')">📅 Продл</button>
                                                <a href="/?token=${user.token}" target="_blank" class="btn btn-sm" style="background:#1f2230;">👁️</a>
                                            </div>
                                        </td>
                                    </tr>
                                `
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="footer">
                    <a href="/" style="color:#2563eb; text-decoration:none;">← На главную</a>
                </div>
            </div>
            
            <script>
                function createUser() {
                    const days = document.getElementById('createDays').value
                    fetch('/api/admin/create-user', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ days: parseInt(days), key: '${adminKey}' })
                    }).then(() => location.reload())
                }
                
                function disableUser(token) {
                    if(confirm('Отключить пользователя?')) {
                        fetch('/api/admin/disable', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ token, key: '${adminKey}' })
                        }).then(() => location.reload())
                    }
                }
                
                function enableUser(token, days) {
                    if(confirm('Включить/продлить подписку на ' + days + ' дней?')) {
                        fetch('/api/admin/enable', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ token, days, key: '${adminKey}' })
                        }).then(() => location.reload())
                    }
                }
                
                function extendUser(token) {
                    const days = document.getElementById('extendDays_' + token).value
                    if(confirm('Продлить подписку на ' + days + ' дней?')) {
                        fetch('/api/admin/extend', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ token, days: parseInt(days), key: '${adminKey}' })
                        }).then(() => location.reload())
                    }
                }
            </script>
        </body>
        </html>
    `)
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
    res.json({ success: true })
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
        
        if (!user) return res.status(403).send("Subscription not found")
        
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
        result += `#announce: 🌐 Подписка активна до ${expiresAt.toLocaleDateString()} (осталось ${daysLeft} ${getDayWord(daysLeft)}) 🌐\n`
        result += `#announce: 📅 Использовано ${usedDays} из ${totalDays} дней\n`
        result += `#announce: ✨ Для продления пиши @xolirx\n\n`
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
