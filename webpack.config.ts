import path from "path";
import HtmlWebpackPlugin from "html-webpack-plugin";
import webpack from "webpack";
import { VueLoaderPlugin } from "vue-loader";
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
            extensions: [".ts", ".js", ".json", ".vue"],
        },
        devtool: mode == "development" ? "eval-cheap-module-source-map" : false,
        module: {
            rules: [
                {
                    test: /\.vue$/i,
                    loader: "vue-loader",
                    options: { hotReload: false },
                },
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
                    loader: "ts-loader",
                    exclude: /node_modules/,
                    options: { appendTsSuffixTo: [/\.vue$/] },
                },
            ],
        },
        plugins: [
            new webpack.DefinePlugin({
                __VUE_PROD_DEVTOOLS__: false,
                __VUE_OPTIONS_API__: false,
            }),
            new VueLoaderPlugin(),
            new MiniCssExtractPlugin({ filename: "[name].[contenthash].css" }),
            new HtmlWebpackPlugin({
                template: "./front/html/index.html",
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
