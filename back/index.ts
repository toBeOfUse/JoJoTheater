import webpackConfig from "../webpack.config";
import webpack from 'webpack';
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

import connect from "connect";
import serveStatic from "serve-static";
const server = connect()
    .use(serveStatic("./dist/"))
    .listen(8080, () => console.log("Server running on 8080..."));

import init from "./sockets";
init(server);