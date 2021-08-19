import path from "path";
import HtmlWebpackPlugin from "html-webpack-plugin";
import CopyWebpackPlugin from "copy-webpack-plugin";
import webpack from "webpack";

const config: webpack.Configuration = {
    mode: "development",
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
    ],
};

export default config;
