/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path");
const fs = require("fs");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CircularDependencyPlugin = require("circular-dependency-plugin");
const { DefinePlugin, EnvironmentPlugin } = require("webpack");

const outDir = path.resolve(__dirname, "dist");
const rootPackageJson = path.resolve(__dirname, "../../package.json");

module.exports = {
	mode: "development",
	devtool: "source-map",
	context: __dirname,
	entry: "./src/index.tsx",
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: "ts-loader",
				exclude: /node_modules/,
			},
			{
				test: /\.css$/,
				use: [
					"style-loader",
					{
						loader: "css-loader",
						options: {
							esModule: false,
							modules: {
								auto: true,
								localIdentName: "[name]__[local]--[hash:base64:5]",
								namedExport: false,
								exportLocalsConvention: "asIs",
							},
						},
					},
				],
			},
		],
	},
	resolve: {
		extensions: [".tsx", ".ts", ".js"],
	},
	output: {
		filename: "bundle-[contenthash].js",
		path: outDir,
	},
	plugins: [
		new EnvironmentPlugin({
			NODE_ENV: "production",
		}),
		new DefinePlugin({
			APP_VERSION: DefinePlugin.runtimeValue(
				() =>
					JSON.stringify(
						JSON.parse(fs.readFileSync(rootPackageJson, "utf8")).version
					),
				{
					fileDependencies: [rootPackageJson],
				}
			),
			APP_ADMIN_API_URL: JSON.stringify(
				process.env.ADMIN_API_URL || "http://localhost:3003"
			),
			APP_GAME_URL: JSON.stringify(
				process.env.CREATURE_CHESS_APP_URL || "http://localhost:8090"
			),
			APP_IMAGE_URL: JSON.stringify(
				process.env.CREATURE_CHESS_IMAGE_URL || "http://localhost:8090/images"
			),
		}),
		new HtmlWebpackPlugin({
			scriptLoading: "blocking",
			title: "Creature Chess Admin",
		}),
		new CircularDependencyPlugin({
			exclude: /a\.js|node_modules/,
			failOnError: true,
			allowAsyncCycles: false,
			cwd: process.cwd(),
		}),
	].filter(Boolean),
	devServer: {
		compress: true,
		port: 8091,
		historyApiFallback: true,
		https: false,
		host: "0.0.0.0",
		allowedHosts: "all",
	},
	optimization: {
		splitChunks: {
			chunks: "all",
		},
	},
};
