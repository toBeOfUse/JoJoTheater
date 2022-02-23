import http from "http";
import express from "express";
import compression from "compression";

import initTheater from "./theater";
import uploads from "./upload";
import logger from "./logger";
import cdn from "./optimizeimages";

import webpackConfig from "../webpack.config";
import webpack from "webpack";
import path from "path";
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

const app = express();
app.use(compression());
app.use(function (req, res, next) {
    if (
        req.url == "/" ||
        req.url.endsWith("/index.html") ||
        mode == "development"
    ) {
        res.setHeader(
            "Cache-Control",
            "no-cache, no-store, max-age=0, must-revalidate"
        );
    }
    next();
});
app.use(express.static("assets"));
app.use(express.static("dist"));
app.use(express.json());
app.use(cdn());
app.use(uploads());
app.get("/room", (_req, res) => {
    res.sendFile(path.resolve(__dirname, "../dist/room.html"), (err) => {
        if (err) {
            logger.error("failed to serve room.html");
            logger.error(err);
        }
    });
});
const server = http.createServer(app);
initTheater(server, app);

server.listen(8080, () => logger.info("app running on 8080..."));
