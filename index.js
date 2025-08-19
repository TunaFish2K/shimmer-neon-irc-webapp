import ShimmerIRC, { createNodeStreams } from "shimmer-neon-irc";
import express from "express";
import { Socket } from "net";
import morgan from "morgan";
import open from "open";
import sea from "node:sea";
import { readFileSync, stat } from "fs";
import { readFile } from "fs/promises";

const DEV_MODE = process.env["APP_DEV"] == "true";

const HOST = "xg-2.frp.one";
const PORT = 12783;

const isSea = sea.isSea();
const assets = JSON.parse(isSea ? sea.getAsset("_assets.json", "utf8") : readFileSync("sea-config.json")).assets;

/**
 * 
 * @param { string } key
 *  
 */
async function getAsset(key) {
    if (isSea) {
        return await new Promise((resolve, reject) => {
            try {
                resolve(Buffer.from(sea.getAsset(key)));
            }
            catch (e) {
                reject(e);
            }
        });
    } else {
        return await readFile(assets[key]);
    }
}

async function prepareStatics() {
    registerAssetAsStatic("index.html", "/index.html", "text/html");
    registerAssetAsStatic("index.js", "/index.js", "text/javascript");
}

const app = express();
if (DEV_MODE) {
    app.use(morgan("tiny"));
}

const states = {
    /**
     * @type { Socket }
     */
    socket: undefined,
    /**
     * @type { ShimmerIRC }
     */
    irc: undefined,
    /**
     * @type { {player: string, message: string}[] }
     */
    messages: []
};

function ircRequired(req, res, next) {
    if (!states.irc) {
        return res.status(400).json({
            "message": "irc closed"
        });
    }
    next();
}

app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({
        "message": "internal error"
    });
});

app.get("/isAlive", (req, res) => {
    res.json({
        "message": "success",
        "result": states.irc !== undefined
    });
});

app.post("/start", express.json(), (req, res) => {
    if (states.irc) {
        return res.status(400).json({
            "message": "already connected"
        });
    };
    if (typeof (req.body?.username) !== "string" ||
        req.body.username.trim() === "") {
        return res.status(400).json({
            "message": "missing username"
        });
    }

    function create() {
        states.irc && states.irc.stop();
        states.socket && states.socket.end();

        states.socket = new Socket();
        states.socket.connect({
            host: HOST,
            port: PORT
        });

        const { readableStream, writableStream } = createNodeStreams(states.socket);
        states.irc = new ShimmerIRC({
            readableStream,
            writableStream,
            username: req.body.username,
            verbose: DEV_MODE
        });
        states.irc.start();
        states.irc.addEventListener("message", (ev) => {
            states.messages.push(Object.assign({ type: "message" }, ev.detail));
        });
        states.irc.addEventListener("playerLeave", (ev) => {
            states.messages.push({
                player: ev.detail,
                type: "playerLeave"
            });
        });
        states.irc.addEventListener("playerJoin", (ev) => {
            states.messages.push({
                player: ev.detail,
                type: "playerJoin"
            });
        });

        states.irc.addEventListener("error", (ev) => {
            console.error(ev.detail);
            setTimeout(create, 100);
        });
    }

    create();

    return res.json({
        "message": "success"
    });
});

app.post("/send", ircRequired, express.json(), async (req, res) => {
    if (typeof (req.body.message) !== "string") {
        return res.status(400).json({
            "message": "message required"
        });
    }
    states.irc.sendMessage(req.body.message);
    return res.json({
        "message": "message pushed"
    });
});

app.get("/getPlayerList", ircRequired, async (req, res) => {
    const players = await states.irc.getPlayerList();
    return res.json({
        "message": "success",
        "result": players
    });
});

app.get("/fetchMessages", (req, res) => {
    const result = states.messages;
    states.messages = [];
    return res.json({
        "message": "success",
        "result": result
    });
});

app.post("/stop", ircRequired, (req, res) => {
    states.irc.stop();
    states.socket.end();

    states.irc = undefined;
    states.socket = undefined;

    return res.json({
        "message": "success"
    });
});

const staticPath = "/public";

/**
 * 
 * @param { string } key 
 * @param { string } url 
 * @param { string } contentType 
 */
async function registerAssetAsStatic(key, url, contentType) {
    const data = await getAsset(key);
    if (!url.startsWith("/")) url = "/" + url;
    app.get(staticPath + url, (req, res) => {
        res.setHeader("Content-Type", contentType);
        res.end(data);
    });
}

prepareStatics().then(() => {
    const server = app.listen(process.env["APP_PORT"] ?? undefined, process.env["APP_HOST"] ?? "127.0.0.1", () => {
        const { address, port } = server.address();
        const url = `http://${address}:${port}/public/index.html`;

        console.log(`listening, visit \`${url}\``);
        open(url);
    });
});