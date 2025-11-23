"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpConfigLoader = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class McpConfigLoader {
    /**
     * 加载 MCP 配置
     */
    static loadConfig() {
        // 默认空配置
        const defaultConfig = {
            mcpServers: {},
        };
        // 尝试从各个可能的路径加载配置
        for (const configPath of this.CONFIG_PATHS) {
            if (configPath && fs_1.default.existsSync(configPath)) {
                try {
                    const configContent = fs_1.default.readFileSync(configPath, "utf-8");
                    const config = JSON.parse(configContent);
                    console.log(`Loaded MCP config from`);
                    return config;
                }
                catch (error) {
                    console.error(`加载 MCP 配置文件 ${configPath} 失败: ${error}`);
                }
            }
        }
        console.log("未找到 MCP 配置文件，使用默认空配置");
        return defaultConfig;
    }
    /**
     * 保存 MCP 配置
     */
    static saveConfig(config, configPath) {
        const savePath = configPath || this.CONFIG_PATHS[0];
        if (!savePath) {
            console.error("未指定配置保存路径");
            return false;
        }
        try {
            // 确保目录存在
            const dirPath = path_1.default.dirname(savePath);
            if (!fs_1.default.existsSync(dirPath)) {
                fs_1.default.mkdirSync(dirPath, { recursive: true });
            }
            fs_1.default.writeFileSync(savePath, JSON.stringify(config, null, 2), "utf-8");
            console.log(`MCP 配置已保存到 ${savePath}`);
            return true;
        }
        catch (error) {
            console.error(`保存 MCP 配置到 ${savePath} 失败: ${error}`);
            return false;
        }
    }
}
exports.McpConfigLoader = McpConfigLoader;
McpConfigLoader.CONFIG_PATHS = [
    // 项目配置路径
    path_1.default.join(process.cwd(), "mcp_config.json"),
    // 后端根路径配置
    path_1.default.join(__dirname, "../../mcp_config.json"),
    // 环境变量指定的配置路径
    process.env.MCP_CONFIG_PATH,
];
//# sourceMappingURL=mcp-config.js.map