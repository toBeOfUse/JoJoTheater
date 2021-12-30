import path from "path";
import http from "http";
import express from "express";
import compression from "compression";
import handlebars from "express-handlebars";

import initTheater from "./theater";
import initUploads from "./upload";
import logger from "./logger";

import webpackConfig from "../webpack.config";
import webpack from "webpack";
import { existsSync } from "fs";
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
app.use((req, _res, next) => {
    if (req.url.startsWith("/images/thumbnails/")) {
        if (!existsSync("./assets" + req.url)) {
            req.url = "/images/video-file.svg";
        }
    }
    next();
});
app.use(express.static("assets"));
app.engine("hbs", renderer.engine);
app.set("view engine", "hbs");
app.set("views", path.resolve(process.cwd(), "front/views/"));

const server = http.createServer(app);
initTheater(server, app);
initUploads(app);

server.listen(8080, () => logger.info("app running on 8080..."));
