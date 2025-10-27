"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vite_plugin_1 = require("@sentry/vite-plugin");
const vite_1 = require("vite");
const plugin_react_1 = __importDefault(require("@vitejs/plugin-react"));
// https://vitejs.dev/config/
exports.default = (0, vite_1.defineConfig)({
    build: {
        target: 'esnext',
        sourcemap: false, // Disable source maps for production
        outDir: '../../../dist/react/pdfme',
        emptyOutDir: true
    },
    plugins: [
        (0, plugin_react_1.default)(),
        // Only include Sentry in production builds
        ...(process.env.NODE_ENV === 'production' ? [(0, vite_plugin_1.sentryVitePlugin)({
                org: "hand-dot",
                project: "playground-pdfme"
            })] : [])
    ],
    base: '/api/pdfme-static/',
});
