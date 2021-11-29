import path from "path";
import http from "http";
import express from "express";
import compression from "compression";
import handlebars from "express-handlebars";

import init from "./sockets";
import logger from "./logger";

import webpackConfig from "../webpack.config";
import webpack from "webpack";
const webpacker = webpack(webpackConfig);
logger.info("starting webpack in mode " + webpackConfig.mode);
webpacker.watch(
    {
        aggregateTimeout: 300,
    },
    (err, stats) => {
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
    }
);

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
app.use(express.static("dist"));
app.use(express.static("assets"));
app.engine("hbs", renderer.engine);
app.set("view engine", "hbs");
app.set("views", path.resolve(process.cwd(), "front/views/"));

const server = http.createServer(app);
init(server, app);

server.listen(8080, () => logger.info("app running on 8080..."));
