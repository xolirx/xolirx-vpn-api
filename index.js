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

const VPN_FILE = path.join(DATA_DIR, "vpn.txt")
const JSON_FILE = path.join(DATA_DIR, "servers.json")

const USERS_FILE = path.join(
    process.cwd(),
    "users.json"
)

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR)
}

if (!fs.existsSync(VPN_FILE)) {
    fs.writeFileSync(VPN_FILE, "", "utf-8")
}

if (!fs.existsSync(JSON_FILE)) {
    fs.writeFileSync(JSON_FILE, "[]", "utf-8")
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
    res.json({
        name: "XolirX VPN API",
        status: "online"
    })
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
    } catch {
        res.status(500).json({
            error: true
        })
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

        const vpn = fs.readFileSync(
            VPN_FILE,
            "utf-8"
        )

        res.setHeader(
            "Content-Type",
            "text/plain; charset=utf-8"
        )

        res.send(vpn)
    } catch {
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
                .toISOString()
        }

        users.push(user)

        saveUsers(users)

        const sub =
            req.protocol +
            "://" +
            req.get("host") +
            "/sub/" +
            token

        res.json({
            success: true,
            token,
            subscription: sub
        })
    } catch {
        res.status(500).json({
            error: true
        })
    }
})

app.get("/users", (req, res) => {
    try {
        const users = loadUsers()

        res.json({
            total: users.length,
            users
        })
    } catch {
        res.status(500).json({
            error: true
        })
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
            return res.status(404).json({
                error: true,
                message: "user not found"
            })
        }

        user.active = false

        saveUsers(users)

        res.json({
            success: true,
            disabled: token
        })
    } catch {
        res.status(500).json({
            error: true
        })
    }
})

app.listen(PORT, () => {
    console.log("")
    console.log("===================================")
    console.log(" XolirX VPN API")
    console.log("===================================")
    console.log("PORT:", PORT)
    console.log(
        "VPN:",
        "http://localhost:" + PORT + "/vpn"
    )
    console.log(
        "CREATE USER:",
        "http://localhost:" + PORT + "/create-user"
    )
    console.log("===================================")
    console.log("")
})
