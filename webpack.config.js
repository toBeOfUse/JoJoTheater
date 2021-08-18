const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
    entry: './index.js',
    output: {
        filename: 'main.[contenthash].js',
        path: path.resolve(__dirname, 'dist'),
        publicPath: "./"
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
            template: 'index.html'
        }),
        new CopyWebpackPlugin({
            patterns: [
                { from: './images/', to: './images/' },
                { from: './videos/', to: './videos/' },
            ]
        })
    ]
};