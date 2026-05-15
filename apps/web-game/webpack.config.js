/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path");
const fs = require("fs");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { TsConfigPathsPlugin } = require("awesome-typescript-loader");
const CircularDependencyPlugin = require("circular-dependency-plugin");
const { DefinePlugin, EnvironmentPlugin, ProvidePlugin } = require("webpack");

const outDir = path.resolve(__dirname, "dist");
const rootPackageJson = path.resolve(__dirname, "../../package.json");
const imagesDir = path.resolve(__dirname, "../../images");

module.exports = {
	mode: "development",
	devtool: "source-map",

	// target: ['web', 'es5'],  // <-- THÊM DÒNG NÀY MỚI QUAN TRỌNG

	context: __dirname,
	entry: "./src/index.tsx",

	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: "ts-loader",
				exclude: /node_modules/,
			},
			// --> cho ES5
			// {
			// 	test: /\.m?js$/,
			// 	include: /node_modules/,
			// 	use: {
			// 		loader: "babel-loader",
			// 		options: {
			// 			presets: [
			// 				['@babel/preset-env', { targets: "defaults, not dead, > 0.2%, ie 11" }]
			// 			]
			// 		}
			// 	}
			// },
			// -->
			{
				test: /\.css$/,
				use: [
					"style-loader",
					{
						loader: "css-loader",
						options: {
							esModule: false, // Fallback to CommonJS to ensure default export works predictably
							modules: {
								auto: true, // Enable CSS Modules for files ending in .module.css
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
		alias: { "~": path.resolve(__dirname, "src") },
		extensions: [".tsx", ".ts", ".js"],
		fallback: {
			"process/browser": require.resolve("process/browser"),
		},
	},

	output: {
		filename: "bundle-[contenthash].js",
		path: outDir,
	},

	plugins: [
		new ProvidePlugin({
			process: "process/browser",
		}),
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
			APP_URL: JSON.stringify(process.env.CREATURE_CHESS_APP_URL),
			APP_API_URL: JSON.stringify(process.env.API_INFO_URL),
			APP_IMAGE_ROOT: JSON.stringify(process.env.CREATURE_CHESS_IMAGE_URL),
			APP_AUTH0_ENABLED: JSON.stringify(process.env.AUTH0_ENABLED),
			APP_AUTH0_DOMAIN: JSON.stringify(process.env.AUTH0_DOMAIN),
			APP_AUTH0_SPA_CLIENT_ID: JSON.stringify(process.env.AUTH0_SPA_CLIENT_ID),
			APP_AUTH0_API_AUDIENCE: JSON.stringify(process.env.AUTH0_API_AUDIENCE),
		}),
		new HtmlWebpackPlugin({
			scriptLoading: "blocking",
		}),
		new CircularDependencyPlugin({
			// exclude detection of files based on a RegExp
			exclude: /a\.js|node_modules/,
			// add errors to webpack instead of warnings
			failOnError: true,
			// allow import cycles that include an asyncronous import,
			// e.g. via import(/* webpackMode: "weak" */ './file.js')
			allowAsyncCycles: false,
			// set the current working directory for displaying module paths
			cwd: process.cwd(),
		}),
	].filter((plugin) => plugin !== null),

	devServer: {
		compress: true,
		port: 8090,
		historyApiFallback: true,
		https: false,
		// host: "covuasinhvat.xyz",
		host: "0.0.0.0",
		allowedHosts: "all",
		// Thêm proxy configuration để proxy API requests
		client: {
			webSocketURL: "wss://covuasinhvat.xyz/ws",
		},
		proxy: {
			// Proxy tất cả requests bắt đầu bằng /api đến server-info
			"/api": {
				target: "http://localhost:3000",
				changeOrigin: true,
				ws: true,
				// Không rewrite path vì server-info expect /api/...
				// Nếu server-info không có /api prefix, thì dùng pathRewrite:
				pathRewrite: { "^/api": "" },
				logLevel: "debug", // Để debug proxy requests
			},
			"/game": {
				target: "http://localhost:3001",
				changeOrigin: true,
				ws: true, // Enable websocket proxying
				pathRewrite: { "^/game": "" },
				logLevel: "debug",
			},
			"/metrics": {
				target: "http://localhost:3001",
				changeOrigin: true,
				logLevel: "debug",
			},
		},
		// Serve static files từ images directory
		static: [
			{
				directory: imagesDir,
				publicPath: "/images",
				watch: true, // Watch for changes in images
			},
		],
	},

	optimization: {
		splitChunks: {
			chunks: "all",
		},
	},
};
