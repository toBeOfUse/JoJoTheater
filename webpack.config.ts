import path from "path";
import HtmlWebpackPlugin from "html-webpack-plugin";
import webpack from "webpack";
const svgToMiniDataURI = require("mini-svg-data-uri");

const config: webpack.Configuration = {
    mode: process.env.NODE_ENV === "production" ? "production" : "development",
    entry: "./front/index.ts",
    output: {
        filename: "main.[contenthash].js",
        path: path.resolve(__dirname, "dist"),
        publicPath: "./",
    },
    resolve: {
        extensions: [".ts", ".js", ".json"],
    },
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: ["style-loader", "css-loader"],
            },
            {
                test: /\.scss$/i,
                use: ["style-loader", "css-loader", "sass-loader"],
            },
            {
                test: /\.svg$/i,
                type: "asset/inline",
                generator: {
                    dataUrl: (content: string) => {
                        content = content.toString();
                        return svgToMiniDataURI(content);
                    },
                },
            },
            {
                test: /\.tsx?$/,
                use: "ts-loader",
                exclude: /node_modules/,
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: "./front/index.html",
        }),
        new webpack.WatchIgnorePlugin({
            paths: [path.resolve(__dirname, "back")],
        }),
    ],
};

export default config;
