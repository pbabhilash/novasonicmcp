import { ToolHandler } from "./tools";
import { McpServerConfig, McpTool } from "../types/types";
export declare class McpManager {
    private clients;
    private transports;
    private tools;
    private toolHandler;
    private config;
    constructor(toolHandler: ToolHandler);
    /**
     * 初始化所有启用的 MCP 服务器
     */
    initializeServers(): Promise<void>;
    /**
     * 连接到指定的 MCP 服务器
     */
    connectToServer(serverName: string, config: McpServerConfig): Promise<McpTool[]>;
    /**
     * Registering MCP tool到 ToolHandler
     */
    private registerServerTools;
    /**
     * 调用 MCP 工具
     */
    callMcpTool(serverName: string, toolName: string, toolUseContent: any): Promise<any>;
    /**
     * 获取所有available tools
     */
    getAllTools(): McpTool[];
    /**
     * 获取特定服务器的工具
     */
    getServerTools(serverName: string): McpTool[];
    /**
     * 获取所有服务器的配置信息
     */
    getAllServersInfo(): Map<string, McpServerConfig>;
    /**
     * 关闭所有 MCP 客户端连接
     */
    closeAll(): Promise<void>;
}
