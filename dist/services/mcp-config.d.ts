import { McpConfig } from "../types/types";
export declare class McpConfigLoader {
    private static CONFIG_PATHS;
    /**
     * 加载 MCP 配置
     */
    static loadConfig(): McpConfig;
    /**
     * 保存 MCP 配置
     */
    static saveConfig(config: McpConfig, configPath?: string): boolean;
}
