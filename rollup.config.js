import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";

/**
 * @type { import("rollup").RollupOptions }
 */
export default {
    input: "index.js",
    output: {
        file: "index.cjs",
        format: "cjs"
    },
    plugins: [nodeResolve(), commonjs(), json()]
};