module.exports = {
    root: true,
    // This config file isn't part of server/tsconfig.json, so type-aware linting can't parse it.
    ignorePatterns: [".eslintrc.cjs"],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        project: "./tsconfig.json",
        // Resolve project relative to this config, not the workspace cwd.
        tsconfigRootDir: __dirname,
    },
    plugins: ["@typescript-eslint"],
    rules: {
        "@typescript-eslint/no-explicit-any": "warn",
        "no-console": ["warn", { allow: ["warn", "error"] }],
    },
    overrides: [
        {
            files: ["src/network/ServiceWiring.ts"],
            rules: {
                "@typescript-eslint/no-explicit-any": "off",
            },
        },
    ],
};
