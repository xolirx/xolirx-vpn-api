```js
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

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR)
}

if (!fs.existsSync(VPN_FILE)) {
    fs.writeFileSync(VPN_FILE, "", "utf-8")
}

if (!fs.existsSync(JSON_FILE)) {
    fs.writeFileSync(JSON_FILE, "[]", "utf-8")
}

app.get("/", (req, res) => {
    res.json({
        name: "XolirX VPN API",
        status: "online",
        endpoints: {
            vpn: "/vpn",
            servers: "/servers",
            upload: "/upload",
            stats: "/stats"
        }
    })
})

app.get("/vpn", (req, res) => {
    try {
        const data = fs.readFileSync(VPN_FILE, "utf-8")

        res.setHeader(
            "Content-Type",
            "text/plain; charset=utf-8"
        )

        res.send(data)
    } catch {
        res.status(500).json({
            error: true,
            message: "failed to read vpn file"
        })
    }
})

app.get("/servers", (req, res) => {
    try {
        const data = fs.readFileSync(JSON_FILE, "utf-8")

        res.setHeader(
            "Content-Type",
            "application/json"
        )

        res.send(data)
    } catch {
        res.status(500).json({
            error: true,
            message: "failed to read servers"
        })
    }
})

app.get("/stats", (req, res) => {
    try {
        const vpn = fs.readFileSync(VPN_FILE, "utf-8")
        const json = JSON.parse(
            fs.readFileSync(JSON_FILE, "utf-8")
        )

        const countries = {}

        for (const server of json) {
            const country = server.country || "Unknown"

            countries[country] =
                (countries[country] || 0) + 1
        }

        res.json({
            online: true,
            total_servers: json.length,
            total_configs: vpn
                .split("\n")
                .filter(x => x.trim())
                .length,
            countries
        })
    } catch {
        res.status(500).json({
            error: true,
            message: "failed to load stats"
        })
    }
})

app.post("/upload", (req, res) => {
    try {
        const {
            txt,
            json
        } = req.body

        if (!txt) {
            return res.status(400).json({
                error: true,
                message: "txt required"
            })
        }

        fs.writeFileSync(
            VPN_FILE,
            txt,
            "utf-8"
        )

        if (json) {
            fs.writeFileSync(
                JSON_FILE,
                JSON.stringify(json, null, 2),
                "utf-8"
            )
        }

        res.json({
            success: true,
            updated: true,
            vpn_endpoint: "/vpn",
            servers_endpoint: "/servers",
            stats_endpoint: "/stats"
        })
    } catch {
        res.status(500).json({
            error: true,
            message: "upload failed"
        })
    }
})

app.listen(PORT, () => {
    console.log("")
    console.log("===================================")
    console.log(" XolirX VPN API")
    console.log("===================================")
    console.log(` PORT: ${PORT}`)
    console.log(` VPN: http://localhost:${PORT}/vpn`)
    console.log(` JSON: http://localhost:${PORT}/servers`)
    console.log(` STATS: http://localhost:${PORT}/stats`)
    console.log("===================================")
    console.log("")
})
```
