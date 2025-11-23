"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBinaryExists = exports.getBinaryPath = exports.getBinaryName = exports.runInstallScript = void 0;
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
function runInstallScript(scriptPath) {
    return new Promise((resolve, reject) => {
        const sanitizedBinaryName = scriptPath.replace(/\.\.\//g, '').replace(/\\/g, '');
        const installScriptPath = path_1.default.join(getResourcePath(), "scripts", sanitizedBinaryName);
        const nodeProcess = (0, child_process_1.spawn)(process.execPath, [installScriptPath], {
            env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
        });
        nodeProcess.stdout.on("data", (data) => {
            console.info(`Script output: ${data}`);
        });
        nodeProcess.stderr.on("data", (data) => {
            console.error(`Script error: ${data}`);
        });
        nodeProcess.on("close", (code) => {
            if (code === 0) {
                console.info("Script completed successfully");
                resolve();
            }
            else {
                console.error(`Script exited with code ${code}`);
                reject(new Error(`Process exited with code ${code}`));
            }
        });
    });
}
exports.runInstallScript = runInstallScript;
async function getBinaryName(name) {
    if (process.platform === "win32") {
        return `${name}.exe`;
    }
    return name;
}
exports.getBinaryName = getBinaryName;
async function getBinaryPath(name) {
    if (!name) {
        return path_1.default.join(os_1.default.homedir(), ".cherrystudio", "bin");
    }
    const binaryName = await getBinaryName(name);
    const binariesDir = path_1.default.join(os_1.default.homedir(), ".cherrystudio", "bin");
    const binariesDirExists = await fs_1.default.existsSync(binariesDir);
    //return binariesDirExists ? path.join(binariesDir, binaryName) : binaryName;
    // Sanitize the input to prevent path traversal
    const sanitizedBinaryName = binaryName.replace(/\.\.\//g, '').replace(/\\/g, '');
    return binariesDirExists ? path_1.default.join(binariesDir, sanitizedBinaryName) : sanitizedBinaryName;
}
exports.getBinaryPath = getBinaryPath;
async function isBinaryExists(name) {
    const cmd = await getBinaryPath(name);
    return await fs_1.default.existsSync(cmd);
}
exports.isBinaryExists = isBinaryExists;
function getResourcePath() {
    const appPath = process.env.APP_PATH || process.cwd();
    return path_1.default.join(appPath, "resources");
}
//# sourceMappingURL=process.js.map