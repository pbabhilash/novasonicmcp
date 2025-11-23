"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpManager = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
const mcp_config_1 = require("./mcp-config");
const stdio_js_2 = require("@modelcontextprotocol/sdk/client/stdio.js");
class McpManager {
    constructor(toolHandler) {
        this.clients = new Map();
        this.transports = new Map();
        this.tools = new Map();
        this.toolHandler = toolHandler;
        this.config = mcp_config_1.McpConfigLoader.loadConfig();
    }
    /**
     * 初始化所有启用的 MCP 服务器
     */
    async initializeServers() {
        const servers = Object.entries(this.config.mcpServers);
        console.log(`Found MCP server configs`);
        await Promise.all(servers.map(async ([serverName, serverConfig]) => {
            if (serverConfig.disabled !== true) {
                try {
                    await this.connectToServer(serverName, serverConfig);
                }
                catch (error) {
                    console.error(`Failed to connect to MCP server: ${error}`);
                }
            }
            else {
                console.log(`MCP 服务器 ${serverName} 已禁用，跳过连接`);
            }
        }));
    }
    /**
     * 连接到指定的 MCP 服务器
     */
    async connectToServer(serverName, config) {
        console.log(`Connecting to MCP server: ${serverName}`);
        try {
            // 创建客户端
            const client = new index_js_1.Client({
                name: `nova-sonic-mcp-client-${serverName}`,
                version: "1.0.0",
                capabilities: {
                    prompts: {},
                    resources: {},
                    tools: {},
                },
            });
            // 创建传输
            // 处理特殊命令
            let command = config.command;
            let args = [...config.args]; // 复制数组以避免修改原始配置
            if (config.command === "node") {
                // 使用process.execPath以确保使用正确的Node.js路径
                command = process.execPath;
            }
            else if (config.command === "npx") {
                // 对于npx命令，保持原样，因为npx通常需要在命令行中运行
                // 不需要特殊处理
            }
            console.log("MCP Server Config", JSON.stringify(config));
            console.log(`使用命令: ${command} 连接到 ${serverName}`);
            const transport = new stdio_js_1.StdioClientTransport({
                command: command,
                args: args,
                env: {
                    ...(0, stdio_js_2.getDefaultEnvironment)(),
                    ...config.env,
                },
                stderr: "pipe",
            });
            transport.stderr?.on("data", (data) => console.info(`[MCP] Stdio stderr for server: `, data.toString()));
            // 连接到服务器
            await client.connect(transport);
            // 保存客户端和传输
            this.clients.set(serverName, client);
            this.transports.set(serverName, transport);
            // 获取工具列表
            const toolsResult = await client.listTools();
            const serverTools = toolsResult.tools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema,
                serverName: serverName, // 记录工具来自哪个服务器
            }));
            // 保存工具列表
            this.tools.set(serverName, serverTools);
            // Registering MCP tool到 ToolHandler
            this.registerServerTools(serverName, serverTools, config.autoApprove || []);
            console.log(`Connected to MCP server ${serverName}，available tools: ${serverTools.map(({ name }) => name).join(", ")}`);
            return serverTools;
        }
        catch (error) {
            console.error(`Failed to connect to MCP server: ${error}`);
            throw error;
        }
    }
    /**
     * Registering MCP tool到 ToolHandler
     */
    registerServerTools(serverName, tools, autoApproveList) {
        tools.forEach((tool) => {
            // 修改: 默认所有工具都是auto-approve的，不再根据 autoApproveList 判断
            const isAutoApproved = true;
            this.toolHandler.registerMcpTool(tool.name, this.callMcpTool.bind(this, serverName, tool.name), serverName, tool.description, isAutoApproved);
        });
    }
    /**
     * 调用 MCP 工具
     */
    async callMcpTool(serverName, toolName, toolUseContent) {
        const client = this.clients.get(serverName);
        if (!client) {
            throw new Error(`MCP 服务器 ${serverName} 未连接`);
        }
        try {
            console.log(`调用 MCP 工具: ${serverName}/${toolName}`);
            // 解析工具参数
            let toolArgs = {};
            if (toolUseContent && typeof toolUseContent.content === "string") {
                try {
                    toolArgs = JSON.parse(toolUseContent.content);
                }
                catch (e) {
                    console.error("解析工具参数失败:", e);
                }
            }
            // 调用 MCP 工具
            const result = await client.callTool({
                name: toolName,
                arguments: toolArgs,
            });
            return result.content;
        }
        catch (error) {
            console.error(`调用 MCP 工具 ${serverName}/${toolName} 失败: ${error}`);
            throw error;
        }
    }
    /**
     * 获取所有available tools
     */
    getAllTools() {
        const allTools = [];
        for (const tools of this.tools.values()) {
            allTools.push(...tools);
        }
        return allTools;
    }
    /**
     * 获取特定服务器的工具
     */
    getServerTools(serverName) {
        return this.tools.get(serverName) || [];
    }
    /**
     * 获取所有服务器的配置信息
     */
    getAllServersInfo() {
        // 返回所有服务器的配置信息
        return new Map(Object.entries(this.config.mcpServers));
    }
    /**
     * 关闭所有 MCP 客户端连接
     */
    async closeAll() {
        for (const [serverName, client] of this.clients.entries()) {
            try {
                await client.close();
                console.log(`MCP 客户端 ${serverName} 已关闭`);
            }
            catch (error) {
                console.error(`关闭 MCP 客户端 ${serverName} 失败: ${error}`);
            }
        }
        this.clients.clear();
        this.transports.clear();
    }
}
exports.McpManager = McpManager;
//# sourceMappingURL=mcp-manager.js.map