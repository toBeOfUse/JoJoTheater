import path from "path";
import HtmlWebpackPlugin from "html-webpack-plugin";
import CopyWebpackPlugin from "copy-webpack-plugin";
import webpack from "webpack";

const config: webpack.Configuration = {
    mode: (process.env.NODE_ENV === "production")
		? "production" : "development",
    entry: "./front/index.js",
    output: {
        filename: "main.[contenthash].js",
        path: path.resolve(__dirname, "dist"),
        publicPath: "./",
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
        new CopyWebpackPlugin({
            patterns: [
                { from: "./images/", to: "./images/" },
                // { from: './videos/', to: './videos/' },
            ],
        }),
        new webpack.WatchIgnorePlugin({
            paths: [path.resolve(__dirname, "back")],
        }),
    ],
};

export default config;
