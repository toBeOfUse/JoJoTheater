import path from "path";
import HtmlWebpackPlugin from "html-webpack-plugin";
import webpack from "webpack";
import { VueLoaderPlugin } from "vue-loader";
const svgToMiniDataURI = require("mini-svg-data-uri");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const HtmlWebpackInlineSVGPlugin = require("html-webpack-inline-svg-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");

function getConfig(_: any, options: any) {
    const mode = options.mode;
    const finalCSSLoader =
        mode == "development" ? "style-loader" : MiniCssExtractPlugin.loader;
    const config: webpack.Configuration = {
        mode,
        entry: { index: "./front/index.ts", upload: "./front/upload.ts" },
        output: {
            filename: "[name].[contenthash].js",
            path: path.resolve(__dirname, "dist"),
            publicPath: "/",
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
                    test: /\.inline\.svg$/i,
                    type: "asset/inline",
                    generator: {
                        dataUrl: (content: string) => {
                            content = content.toString();
                            return svgToMiniDataURI(content);
                        },
                    },
                },
                {
                    test: /\.vue\.svg$/i,
                    use: [
                        "vue-loader",
                        {
                            loader: "vue-svg-loader",
                            options: {
                                svgo: {
                                    plugins: [{ prefixIds: true }],
                                },
                            },
                        },
                    ],
                },
                {
                    test: /\.tsx?$/,
                    loader: "ts-loader",
                    exclude: /node_modules/,
                    options: {
                        appendTsSuffixTo: [/\.vue$/],
                        configFile: "tsconfig.webpack.json",
                        ignoreDiagnostics: [7006, 2363, 2365], // deal with weird problem with vue-loader
                    },
                },
            ],
        },
        plugins: [
            new HtmlWebpackPlugin({
                inject: true,
                template: "./front/html/index.html",
                chunks: ["index"],
                filename: "index.html",
            }),
            new HtmlWebpackPlugin({
                inject: true,
                template: "./front/html/upload.html",
                chunks: ["upload"],
                filename: "upload/index.html",
            }),
            new webpack.DefinePlugin({
                __VUE_PROD_DEVTOOLS__: false,
                __VUE_OPTIONS_API__: false,
            }),
            new VueLoaderPlugin(),
            new MiniCssExtractPlugin({ filename: "[name].[contenthash].css" }),
            new webpack.WatchIgnorePlugin({
                paths: [path.resolve(__dirname, "back")],
            }),
            new HtmlWebpackInlineSVGPlugin(),
            new CleanWebpackPlugin(),
        ],
        optimization: {
            minimizer: [new CssMinimizerPlugin(), "..."],
            // realContentHash: false,
        },
    };
    return config;
}

export default getConfig;
