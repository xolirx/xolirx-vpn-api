import express from "express"
import cors from "cors"
import fs from "fs"
import path from "path"

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

        const users = JSON.parse(
            fs.readFileSync(
                USERS_FILE,
                "utf-8"
            )
        )

        const user = users.find(
            x =>
                x.token === token &&
                x.active === true
        )

        if (!user) {
            return res.status(403).send(
                "Subscription expired"
            )
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
        "SUB:",
        "http://localhost:" + PORT + "/sub/xolirx_free_01"
    )
    console.log("===================================")
    console.log("")
})
