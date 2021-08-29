import webpackConfig from "../webpack.config";
import webpack from "webpack";
const webpacker = webpack(webpackConfig);
webpacker.watch(
    {
        aggregateTimeout: 300,
    },
    (err, stats) => {
        if (err || stats?.hasErrors()) {
            console.log("webpack error");
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

import path from "path";
import http from "http";
import express from "express";
import compression from "compression";
import handlebars from "express-handlebars";
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
        stringify(o: object): string {
            return JSON.stringify(o);
        },
    },
});
const app = express();
app.use(compression());
app.use(express.static("dist"));
app.engine("hbs", renderer.engine);
app.set("view engine", "hbs");
app.set("views", path.resolve(process.cwd(), "front/views/"));

const server = http.createServer(app);
import init from "./sockets";
init(server, app);

server.listen(8080, () => console.log("app running on 8080..."));
