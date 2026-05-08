import express from "express"
import cors from "cors"
import fs from "fs"
import path from "path"
import crypto from "crypto"

const app = express()

app.use(cors())
app.use(express.json({ limit: "50mb" }))

const PORT = process.env.PORT || 3000

const DATA_DIR = path.join(process.cwd(), "data")

const VPN_FILE = path.join(
    DATA_DIR,
    "vpn.txt"
)

const JSON_FILE = path.join(
    DATA_DIR,
    "servers.json"
)

const USERS_FILE = path.join(
    process.cwd(),
    "users.json"
)

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR)
}

if (!fs.existsSync(VPN_FILE)) {
    fs.writeFileSync(
        VPN_FILE,
        "",
        "utf-8"
    )
}

if (!fs.existsSync(JSON_FILE)) {
    fs.writeFileSync(
        JSON_FILE,
        "[]",
        "utf-8"
    )
}

if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(
        USERS_FILE,
        "[]",
        "utf-8"
    )
}

function loadUsers() {
    return JSON.parse(
        fs.readFileSync(
            USERS_FILE,
            "utf-8"
        )
    )
}

function saveUsers(users) {
    fs.writeFileSync(
        USERS_FILE,
        JSON.stringify(users, null, 2),
        "utf-8"
    )
}

function generateToken() {
    return crypto
        .randomBytes(16)
        .toString("hex")
}

app.get("/", (req, res) => {
    res.send(`
    <html>
    <head>
        <title>XolirX VPN</title>

        <style>
            body {
                margin: 0;
                background: #0b0b0b;
                color: white;
                font-family: Arial;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
            }

            .card {
                width: 700px;
                background: #151515;
                border-radius: 24px;
                padding: 40px;
                box-shadow:
                    0 0 60px rgba(0,0,0,0.5);
            }

            h1 {
                margin-top: 0;
                font-size: 42px;
            }

            p {
                opacity: 0.8;
            }

            .buttons {
                display: grid;
                gap: 15px;
                margin-top: 30px;
            }

            a {
                background: #6d5dfc;
                color: white;
                text-decoration: none;
                padding: 16px;
                border-radius: 14px;
                text-align: center;
                font-size: 18px;
            }
        </style>
    </head>

    <body>
        <div class="card">
            <h1>XolirX VPN</h1>

            <p>
                Premium VLESS Subscription API
            </p>

            <div class="buttons">
                <a href="/create-user">
                    Create User
                </a>

                <a href="/users">
                    Users Dashboard
                </a>

                <a href="/vpn">
                    Open VPN Subscription
                </a>

                <a href="/servers">
                    Open Servers JSON
                </a>
            </div>
        </div>
    </body>
    </html>
    `)
})

app.get("/vpn", (req, res) => {
    try {
        const vpn = fs.readFileSync(
            VPN_FILE,
            "utf-8"
        )

        res.setHeader(
            "Content-Type",
            "text/plain; charset=utf-8"
        )

        res.send(vpn)
    }

    catch {
        res.status(500).send("error")
    }
})

app.get("/sub/:token", (req, res) => {
    try {
        const token = req.params.token

        const users = loadUsers()

        const user = users.find(
            x =>
                x.token === token &&
                x.active === true
        )

        if (!user) {
            return res
                .status(403)
                .send("Subscription expired")
        }

        const ua =
            req.headers["user-agent"] ||
            "Unknown"

        let os = "Unknown"

        if (ua.includes("Windows")) {
            os = "Windows"
        }

        else if (ua.includes("Android")) {
            os = "Android"
        }

        else if (ua.includes("iPhone")) {
            os = "iPhone"
        }

        else if (ua.includes("Mac")) {
            os = "MacOS"
        }

        else if (ua.includes("Linux")) {
            os = "Linux"
        }

        user.last_ip = req.ip

        user.last_seen = new Date()
            .toISOString()

        user.last_user_agent = ua

        user.total_requests =
            (user.total_requests || 0) + 1

        user.os = os

        saveUsers(users)

        const vpn = fs.readFileSync(
            VPN_FILE,
            "utf-8"
        )

        res.setHeader(
            "Content-Type",
            "text/plain; charset=utf-8"
        )

        res.send(vpn)
    }

    catch {
        res.status(500).send(
            "Internal Server Error"
        )
    }
})

app.get("/create-user", (req, res) => {
    try {
        const users = loadUsers()

        const token = generateToken()

        const user = {
            token,
            active: true,
            created_at: new Date()
                .toISOString(),
            total_requests: 0,
            os: "Unknown",
            last_ip: null,
            last_seen: null
        }

        users.push(user)

        saveUsers(users)

        const sub =
            req.protocol +
            "://" +
            req.get("host") +
            "/sub/" +
            token

        res.send(`
        <html>
        <head>
            <title>Create User</title>

            <style>
                body {
                    margin: 0;
                    background: #0b0b0b;
                    color: white;
                    font-family: Arial;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                }

                .card {
                    width: 700px;
                    background: #151515;
                    border-radius: 24px;
                    padding: 40px;
                }

                .url {
                    margin-top: 20px;
                    background: #0f0f0f;
                    padding: 20px;
                    border-radius: 14px;
                    word-break: break-all;
                }

                button {
                    margin-top: 20px;
                    width: 100%;
                    border: none;
                    background: #6d5dfc;
                    color: white;
                    padding: 18px;
                    border-radius: 14px;
                    font-size: 18px;
                    cursor: pointer;
                }
            </style>
        </head>

        <body>
            <div class="card">
                <h1>User Created</h1>

                <div class="url">
                    ${sub}
                </div>

                <button onclick="
                    navigator.clipboard.writeText('${sub}')
                ">
                    Copy Subscription
                </button>
            </div>
        </body>
        </html>
        `)
    }

    catch {
        res.status(500).send("error")
    }
})

app.get("/users", (req, res) => {
    try {
        const users = loadUsers()

        let html = `
        <html>
        <head>
            <title>XolirX Users</title>

            <style>
                body {
                    margin: 0;
                    padding: 30px;
                    background: #0b0b0b;
                    color: white;
                    font-family: Arial;
                }

                h1 {
                    margin-top: 0;
                }

                .grid {
                    display: grid;
                    grid-template-columns:
                        repeat(
                            auto-fill,
                            minmax(350px, 1fr)
                        );

                    gap: 20px;
                }

                .card {
                    background: #151515;
                    border-radius: 24px;
                    padding: 20px;
                }

                .token {
                    margin-top: 15px;
                    background: #0f0f0f;
                    padding: 14px;
                    border-radius: 12px;
                    word-break: break-all;
                }

                .online {
                    color: #00ff88;
                }

                .offline {
                    color: #ff4444;
                }

                .btn {
                    display: block;
                    margin-top: 15px;
                    background: #ff4444;
                    color: white;
                    text-decoration: none;
                    padding: 14px;
                    border-radius: 12px;
                    text-align: center;
                }
            </style>
        </head>

        <body>
            <h1>XolirX VPN Users</h1>

            <div class="grid">
        `

        for (const user of users) {
            const sub =
                req.protocol +
                "://" +
                req.get("host") +
                "/sub/" +
                user.token

            html += `
            <div class="card">

                <h2>
                    ${
                        user.active
                            ? '<span class="online">ONLINE</span>'
                            : '<span class="offline">DISABLED</span>'
                    }
                </h2>

                <p>
                    <b>OS:</b>
                    ${user.os || "Unknown"}
                </p>

                <p>
                    <b>Requests:</b>
                    ${user.total_requests || 0}
                </p>

                <p>
                    <b>IP:</b>
                    ${user.last_ip || "Unknown"}
                </p>

                <p>
                    <b>Last Seen:</b>
                    ${user.last_seen || "Never"}
                </p>

                <div class="token">
                    ${sub}
                </div>

                <a
                    class="btn"
                    href="/disable/${user.token}"
                >
                    Disable User
                </a>
            </div>
            `
        }

        html += `
            </div>
        </body>
        </html>
        `

        res.send(html)
    }

    catch {
        res.status(500).send("error")
    }
})

app.get("/disable/:token", (req, res) => {
    try {
        const token = req.params.token

        const users = loadUsers()

        const user = users.find(
            x => x.token === token
        )

        if (!user) {
            return res
                .status(404)
                .send("user not found")
        }

        user.active = false

        saveUsers(users)

        res.redirect("/users")
    }

    catch {
        res.status(500).send("error")
    }
})

app.get("/servers", (req, res) => {
    try {
        const json = fs.readFileSync(
            JSON_FILE,
            "utf-8"
        )

        res.setHeader(
            "Content-Type",
            "application/json"
        )

        res.send(json)
    }

    catch {
        res.status(500).send("error")
    }
})

app.listen(PORT, () => {
    console.log("")
    console.log("===================================")
    console.log(" XolirX VPN API")
    console.log("===================================")
    console.log("PORT:", PORT)
    console.log("===================================")
    console.log("")
})
