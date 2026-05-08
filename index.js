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

        <meta name="viewport"
        content="width=device-width, initial-scale=1.0">

        <style>

            * {
                box-sizing: border-box;
            }

            body {
                margin: 0;
                min-height: 100vh;

                background:
                    radial-gradient(circle at top,
                    #17172b 0%,
                    #0b0b0b 45%);

                color: white;
                font-family: Inter, Arial;

                display: flex;
                justify-content: center;
                align-items: center;

                padding: 30px;
            }

            .card {

                width: 100%;
                max-width: 900px;

                background:
                    linear-gradient(
                        180deg,
                        rgba(255,255,255,0.05),
                        rgba(255,255,255,0.03)
                    );

                border:
                    1px solid rgba(255,255,255,0.08);

                border-radius: 34px;

                padding: 50px;

                backdrop-filter: blur(20px);

                box-shadow:
                    0 30px 80px rgba(0,0,0,0.45);
            }

            h1 {
                margin-top: 0;
                font-size: 64px;
                margin-bottom: 10px;
            }

            h1 span {
                color: #8b5cf6;
            }

            p {
                opacity: 0.7;
                font-size: 18px;
                line-height: 1.7;
            }

            .grid {

                display: grid;

                grid-template-columns:
                    repeat(auto-fill,
                    minmax(250px,1fr));

                gap: 20px;

                margin-top: 40px;
            }

            .btn {

                text-decoration: none;

                background:
                    linear-gradient(
                        135deg,
                        #8b5cf6,
                        #6d5dfc
                    );

                padding: 20px;

                border-radius: 22px;

                color: white;

                font-size: 18px;
                font-weight: bold;

                text-align: center;

                box-shadow:
                    0 15px 35px rgba(109,93,252,0.25);

                transition: 0.2s;
            }

            .btn:hover {
                transform: translateY(-4px);
            }

            .footer {

                margin-top: 40px;

                opacity: 0.5;

                text-align: center;
            }

            @media(max-width:700px){

                h1 {
                    font-size: 42px;
                }

                .card {
                    padding: 30px;
                }

            }

        </style>
    </head>

    <body>

        <div class="card">

            <h1>
                XolirX <span>VPN</span>
            </h1>

            <p>
                Premium VLESS Subscription Platform
            </p>

            <div class="grid">

                <a class="btn"
                href="/create-user">
                    Create User
                </a>

                <a class="btn"
                href="/users">
                    Users Dashboard
                </a>

                <a class="btn"
                href="/vpn">
                    VPN Subscription
                </a>

                <a class="btn"
                href="/servers">
                    Servers JSON
                </a>

            </div>

            <div class="footer">
                XolirX VPN API
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

            <meta name="viewport"
            content="width=device-width, initial-scale=1.0">

            <style>

                body {

                    margin: 0;
                    min-height: 100vh;

                    background:
                        radial-gradient(circle at top,
                        #17172b 0%,
                        #0b0b0b 45%);

                    color: white;
                    font-family: Inter, Arial;

                    display: flex;
                    justify-content: center;
                    align-items: center;

                    padding: 30px;
                }

                .card {

                    width: 100%;
                    max-width: 850px;

                    background:
                        linear-gradient(
                            180deg,
                            rgba(255,255,255,0.05),
                            rgba(255,255,255,0.03)
                        );

                    border:
                        1px solid rgba(255,255,255,0.08);

                    border-radius: 34px;

                    padding: 50px;

                    backdrop-filter: blur(20px);

                    box-shadow:
                        0 30px 80px rgba(0,0,0,0.45);
                }

                h1 {
                    margin-top: 0;
                    font-size: 48px;
                }

                .url {

                    margin-top: 25px;

                    background:
                        rgba(0,0,0,0.35);

                    border:
                        1px solid rgba(255,255,255,0.05);

                    padding: 22px;

                    border-radius: 20px;

                    line-height: 1.7;

                    word-break: break-all;
                }

                button {

                    margin-top: 25px;

                    width: 100%;

                    border: none;

                    background:
                        linear-gradient(
                            135deg,
                            #8b5cf6,
                            #6d5dfc
                        );

                    color: white;

                    padding: 20px;

                    border-radius: 18px;

                    font-size: 18px;
                    font-weight: bold;

                    cursor: pointer;

                    transition: 0.2s;
                }

                button:hover {
                    transform: translateY(-2px);
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

        let totalRequests = 0

        for (const user of users) {
            totalRequests +=
                user.total_requests || 0
        }

        let html = `
        <html>

        <head>

            <title>XolirX VPN Dashboard</title>

            <meta name="viewport"
            content="width=device-width, initial-scale=1.0">

            <style>

                * {
                    box-sizing: border-box;
                }

                body {

                    margin: 0;

                    background:
                        radial-gradient(circle at top,
                        #17172b 0%,
                        #0b0b0b 40%);

                    color: white;
                    font-family: Inter, Arial;

                    min-height: 100vh;
                }

                .topbar {

                    width: 100%;

                    padding: 30px;

                    display: flex;

                    justify-content:
                        space-between;

                    align-items: center;

                    border-bottom:
                        1px solid
                        rgba(255,255,255,0.06);

                    backdrop-filter: blur(20px);

                    position: sticky;

                    top: 0;

                    background:
                        rgba(11,11,11,0.7);

                    z-index: 999;
                }

                .logo {

                    font-size: 34px;
                    font-weight: bold;
                }

                .logo span {
                    color: #8b5cf6;
                }

                .stats {

                    display: flex;
                    gap: 20px;
                }

                .stat {

                    background:
                        rgba(255,255,255,0.05);

                    border:
                        1px solid
                        rgba(255,255,255,0.08);

                    padding: 14px 22px;

                    border-radius: 18px;

                    min-width: 120px;

                    text-align: center;
                }

                .stat h2 {

                    margin: 0;

                    font-size: 26px;
                }

                .stat p {

                    margin: 5px 0 0 0;

                    opacity: 0.7;

                    font-size: 14px;
                }

                .container {
                    padding: 40px;
                }

                .actions {

                    display: flex;

                    gap: 20px;

                    margin-bottom: 35px;

                    flex-wrap: wrap;
                }

                .btn {

                    text-decoration: none;

                    background:
                        linear-gradient(
                            135deg,
                            #8b5cf6,
                            #6d5dfc
                        );

                    color: white;

                    padding: 16px 28px;

                    border-radius: 18px;

                    font-weight: bold;

                    box-shadow:
                        0 10px 30px
                        rgba(109,93,252,0.25);

                    transition: 0.2s;
                }

                .btn:hover {
                    transform: translateY(-2px);
                }

                .grid {

                    display: grid;

                    grid-template-columns:
                        repeat(auto-fill,
                        minmax(380px, 1fr));

                    gap: 28px;
                }

                .card {

                    background:
                        linear-gradient(
                            180deg,
                            rgba(255,255,255,0.05),
                            rgba(255,255,255,0.03)
                        );

                    border:
                        1px solid
                        rgba(255,255,255,0.08);

                    border-radius: 28px;

                    padding: 28px;

                    backdrop-filter: blur(20px);

                    box-shadow:
                        0 20px 50px
                        rgba(0,0,0,0.4);

                    transition: 0.25s;
                }

                .card:hover {

                    transform: translateY(-4px);

                    border-color:
                        rgba(139,92,246,0.4);
                }

                .status {

                    display: inline-block;

                    padding: 10px 16px;

                    border-radius: 999px;

                    font-size: 14px;

                    font-weight: bold;

                    margin-bottom: 18px;
                }

                .online {

                    background:
                        rgba(0,255,136,0.12);

                    color: #00ff88;
                }

                .offline {

                    background:
                        rgba(255,68,68,0.12);

                    color: #ff4444;
                }

                .info {

                    margin-top: 12px;

                    display: flex;

                    justify-content:
                        space-between;

                    gap: 20px;
                }

                .info span {
                    opacity: 0.7;
                }

                .token {

                    margin-top: 20px;

                    background:
                        rgba(0,0,0,0.35);

                    border:
                        1px solid
                        rgba(255,255,255,0.05);

                    padding: 18px;

                    border-radius: 18px;

                    font-size: 14px;

                    word-break: break-all;

                    line-height: 1.6;
                }

                .buttons {

                    display: flex;

                    gap: 12px;

                    margin-top: 20px;
                }

                .small-btn {

                    flex: 1;

                    text-align: center;

                    text-decoration: none;

                    padding: 14px;

                    border-radius: 16px;

                    font-weight: bold;

                    transition: 0.2s;
                }

                .copy {
                    background: #6d5dfc;
                    color: white;
                }

                .disable {
                    background: #ff4444;
                    color: white;
                }

                .small-btn:hover {

                    opacity: 0.9;

                    transform: translateY(-2px);
                }

                .footer {

                    margin-top: 50px;

                    text-align: center;

                    opacity: 0.5;

                    font-size: 14px;
                }

                @media(max-width:900px){

                    .topbar {

                        flex-direction: column;

                        gap: 20px;

                        align-items: flex-start;
                    }

                    .stats {

                        width: 100%;

                        flex-wrap: wrap;
                    }

                    .container {
                        padding: 20px;
                    }
                }

            </style>

        </head>

        <body>

            <div class="topbar">

                <div class="logo">
                    XolirX <span>VPN</span>
                </div>

                <div class="stats">

                    <div class="stat">
                        <h2>${users.length}</h2>
                        <p>Users</p>
                    </div>

                    <div class="stat">
                        <h2>
                        ${users.filter(x => x.active).length}
                        </h2>
                        <p>Active</p>
                    </div>

                    <div class="stat">
                        <h2>${totalRequests}</h2>
                        <p>Requests</p>
                    </div>

                </div>

            </div>

            <div class="container">

                <div class="actions">

                    <a class="btn"
                    href="/create-user">
                        + Create User
                    </a>

                    <a class="btn"
                    href="/vpn">
                        Open VPN
                    </a>

                </div>

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

                <div class="
                    status
                    ${user.active
                        ? "online"
                        : "offline"}
                ">
                    ${user.active
                        ? "ONLINE"
                        : "DISABLED"}
                </div>

                <div class="info">
                    <b>OS</b>
                    <span>
                        ${user.os || "Unknown"}
                    </span>
                </div>

                <div class="info">
                    <b>Requests</b>
                    <span>
                        ${user.total_requests || 0}
                    </span>
                </div>

                <div class="info">
                    <b>IP</b>
                    <span>
                        ${user.last_ip || "Unknown"}
                    </span>
                </div>

                <div class="info">
                    <b>Last Seen</b>
                    <span>
                        ${user.last_seen || "Never"}
                    </span>
                </div>

                <div class="token"
                id="${user.token}">
                    ${sub}
                </div>

                <div class="buttons">

                    <a
                        class="small-btn copy"
                        href="#"

                        onclick="
                        copySub('${user.token}')
                        "
                    >
                        Copy
                    </a>

                    <a
                        class="small-btn disable"
                        href="/disable/${user.token}"
                    >
                        Disable
                    </a>

                </div>

            </div>
            `
        }

        html += `

                </div>

                <div class="footer">
                    XolirX VPN Dashboard
                </div>

            </div>

            <script>

                function copySub(id){

                    const text =
                        document
                        .getElementById(id)
                        .innerText

                    navigator
                        .clipboard
                        .writeText(text)
                }

            </script>

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
