const fs = require("fs");
const path = require("path");

const JsonMinimizerPlugin = require("json-minimizer-webpack-plugin");
const evalSourceMapMiddleware = require("react-dev-utils/evalSourceMapMiddleware");
const noopServiceWorkerMiddleware = require("react-dev-utils/noopServiceWorkerMiddleware");
const redirectServedPath = require("react-dev-utils/redirectServedPathMiddleware");
const paths = require("react-scripts/config/paths");
const express = require("express");

// This package IS the CRA app root (sibling of ../server and ../docs).
const appRoot = __dirname;
paths.appPath = appRoot;
paths.appSrc = appRoot;
paths.appPublic = path.resolve(appRoot, "public");
paths.appHtml = path.resolve(appRoot, "public/index.html");
paths.appIndexJs = path.resolve(appRoot, "index.tsx");
paths.appTypeDeclarations = path.resolve(appRoot, "react-app-env.d.ts");
paths.appTsConfig = path.resolve(appRoot, "tsconfig.json");
paths.appBuild = path.resolve(appRoot, "build");

module.exports = {
    paths: (existingPaths) => {
        existingPaths.appPath = paths.appPath;
        existingPaths.appSrc = paths.appSrc;
        existingPaths.appPublic = paths.appPublic;
        existingPaths.appHtml = paths.appHtml;
        existingPaths.appIndexJs = paths.appIndexJs;
        existingPaths.appTypeDeclarations = paths.appTypeDeclarations;
        existingPaths.appTsConfig = paths.appTsConfig;
        existingPaths.appBuild = paths.appBuild;
        return existingPaths;
    },
    webpack: {
        configure: (webpackConfig) => {
            const jsXxhashPath = path.resolve(appRoot, "node_modules/js-xxhash");
            const glslLoader = {
                test: /\.(glsl|vs|fs)$/,
                loader: "ts-shader-loader",
            };

            for (const rule of webpackConfig.module.rules) {
                if (
                    rule &&
                    rule.enforce === "pre" &&
                    Array.isArray(rule.use) &&
                    rule.use.some((use) =>
                        typeof use === "object"
                            ? use.loader?.includes("source-map-loader")
                            : String(use).includes("source-map-loader"),
                    )
                ) {
                    const existingExclude = rule.exclude;
                    rule.exclude = Array.isArray(existingExclude)
                        ? [...existingExclude, jsXxhashPath]
                        : existingExclude
                          ? [existingExclude, jsXxhashPath]
                          : [jsXxhashPath];
                }
                if (rule.oneOf) {
                    // appSrc is the package root (not src/), so without this
                    // babel-preset-react-app also rewrites node_modules CJS
                    // (e.g. threads) into broken ESM and browsers throw
                    // "exports is not defined".
                    for (const oneOfRule of rule.oneOf) {
                        const loader =
                            typeof oneOfRule.loader === "string"
                                ? oneOfRule.loader
                                : "";
                        if (
                            loader.includes("babel-loader") &&
                            oneOfRule.include === paths.appSrc
                        ) {
                            oneOfRule.exclude = /node_modules/;
                        }
                    }
                    rule.oneOf.unshift(glslLoader);
                    break;
                }
            }

            webpackConfig.module.rules.push({
                resourceQuery: /url/,
                type: "asset/resource",
            });
            webpackConfig.module.rules.push({
                resourceQuery: /source/,
                type: "asset/source",
            });

            webpackConfig.resolve.fallback = {
                fs: false,
            };

            webpackConfig.resolve.extensions = [".web.js", ...webpackConfig.resolve.extensions];

            webpackConfig.optimization.minimizer.push(new JsonMinimizerPlugin());
            webpackConfig.ignoreWarnings = [
                ...(webpackConfig.ignoreWarnings ?? []),
                (warning) =>
                    typeof warning?.message === "string" &&
                    warning.message.includes("Failed to parse source map") &&
                    typeof warning?.module?.resource === "string" &&
                    (warning.module.resource.includes(
                        `${path.sep}node_modules${path.sep}js-xxhash${path.sep}`,
                    ) ||
                        warning.module.resource.includes(
                            `${path.sep}node_modules${path.sep}wasm-gzip${path.sep}`,
                        )),
            ];

            return webpackConfig;
        },
    },
    devServer: (devServerConfig) => {
        delete devServerConfig.onBeforeSetupMiddleware;
        delete devServerConfig.onAfterSetupMiddleware;

        const cachesDir = path.resolve(appRoot, "../server/caches");

        return {
            ...devServerConfig,
            hot: false,
            liveReload: false,
            headers: {
                "Cross-Origin-Opener-Policy": "same-origin",
                "Cross-Origin-Embedder-Policy": "require-corp",
                "Cross-Origin-Resource-Policy": "same-origin",
            },
            client: {
                ...devServerConfig.client,
                overlay: {
                    ...devServerConfig.client?.overlay,
                    errors: true,
                    warnings: false,
                    runtimeErrors: (error) => {
                        if (error instanceof DOMException && error.name === "AbortError") {
                            return false;
                        }
                        return true;
                    },
                },
            },
            setupMiddlewares: (middlewares, devServer) => {
                if (!devServer) {
                    throw new Error("webpack-dev-server is not defined");
                }

                devServer.app.use(evalSourceMapMiddleware(devServer));

                if (fs.existsSync(paths.proxySetup)) {
                    require(paths.proxySetup)(devServer.app);
                }

                devServer.app.use(redirectServedPath(paths.publicUrlOrPath));
                devServer.app.use(noopServiceWorkerMiddleware(paths.publicUrlOrPath));
                if (fs.existsSync(cachesDir)) {
                    devServer.app.use("/caches", express.static(cachesDir));
                }

                return middlewares;
            },
        };
    },
};
