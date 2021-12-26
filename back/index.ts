import path from "path";
import http from "http";
import express from "express";
import compression from "compression";
import handlebars from "express-handlebars";
import formidable from "formidable";

import init from "./sockets";
import logger from "./logger";

import webpackConfig from "../webpack.config";
import webpack from "webpack";
const mode =
    process.env.NODE_ENV == "production" ? "production" : "development";
logger.info("starting webpack in mode " + mode);
const webpacker = webpack(webpackConfig(null, { mode }));
const webpackCallback = (
    err: Error | undefined,
    stats: webpack.Stats | undefined
) => {
    if (err || stats?.hasErrors()) {
        logger.warn("webpack error");
        if (err) {
            console.error(err.stack || err);
        }
    }
    console.log(
        stats?.toString({
            colors: true,
            chunks: false,
        })
    );
};
if (mode == "development") {
    webpacker.watch({ aggregateTimeout: 300 }, webpackCallback);
} else {
    webpacker.run(webpackCallback);
}

const renderer = handlebars.create({
    extname: "hbs",
    defaultLayout: "",
    helpers: {
        round(n: number): string {
            return n.toFixed(2);
        },
        msToSeconds(n: number): string {
            return (n / 1000).toFixed(2);
        },
        msToHMS(n: number): string {
            return new Date(n).toISOString().slice(11, 19);
        },
        stringify(o: object): string {
            return JSON.stringify(o, null, 1);
        },
    },
});
const app = express();
app.use(compression());
app.use(function (req, res, next) {
    if (req.url == "/" || req.url.endsWith("/index.html")) {
        res.setHeader(
            "Cache-Control",
            "no-cache, no-store, max-age=0, must-revalidate"
        );
    }
    next();
});
app.use(express.static("dist"));
app.use(express.static("assets"));
app.engine("hbs", renderer.engine);
app.set("view engine", "hbs");
app.set("views", path.resolve(process.cwd(), "front/views/"));

app.get("/upload", (_req, res) => {
    res.sendFile(path.resolve(__dirname, "../front/html/upload.html"));
});

app.post("/api/upload", (req, res) => {
    const form = formidable({
        multiples: false,
        keepExtensions: true,
        maxFileSize: 4294967296,
    });

    form.on("fileBegin", (_formName, file) => {
        const filePath = path.resolve(
            __dirname,
            "../uploads/",
            file.originalFilename ||
                String(new Date().getTime()) +
                    (file.mimetype?.split("/")[1] || "")
        );
        file.filepath = filePath;
    });

    form.on("file", (_formName, file) => {
        logger.info("received file " + file.filepath);
    });

    form.parse(req, (err) => {
        if (err) {
            res.status(400);
        } else {
            res.status(200);
        }
        res.end();
    });
});

const server = http.createServer(app);
init(server, app);

server.listen(8080, () => logger.info("app running on 8080..."));
