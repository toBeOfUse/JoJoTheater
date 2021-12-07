import path from "path";
import HtmlWebpackPlugin from "html-webpack-plugin";
import webpack from "webpack";
const svgToMiniDataURI = require("mini-svg-data-uri");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const HtmlWebpackInlineSVGPlugin = require("html-webpack-inline-svg-plugin");

function getConfig(mode: "development" | "production") {
    const finalCSSLoader =
        mode == "development" ? "style-loader" : MiniCssExtractPlugin.loader;
    const config: webpack.Configuration = {
        mode,
        entry: "./front/index.ts",
        output: {
            filename: "main.[contenthash].js",
            path: path.resolve(__dirname, "dist"),
            publicPath: "./",
        },
        resolve: {
            extensions: [".ts", ".js", ".json"],
        },
        devtool: mode == "development" ? "eval" : false,
        module: {
            rules: [
                {
                    test: /\.css$/i,
                    use: [finalCSSLoader, "css-loader"],
                },
                {
                    test: /\.scss$/i,
                    use: [finalCSSLoader, "css-loader", "sass-loader"],
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
            new MiniCssExtractPlugin(),
            new HtmlWebpackPlugin({
                template: "./front/index.html",
            }),
            new webpack.WatchIgnorePlugin({
                paths: [path.resolve(__dirname, "back")],
            }),
            new HtmlWebpackInlineSVGPlugin(),
        ],
        optimization: {
            minimizer: [new CssMinimizerPlugin(), "..."],
            realContentHash: false,
        },
    };
    return config;
}

export default getConfig;
