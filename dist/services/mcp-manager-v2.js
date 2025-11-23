"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpManager = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/client/streamableHttp.js"); // 新增导入
const mcp_config_1 = require("./mcp-config");
const stdio_js_2 = require("@modelcontextprotocol/sdk/client/stdio.js");
const url_1 = require("url");
const crypto_1 = require("crypto");
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
            let transport;
            // 根据 command 类型选择不同的 transport
            if (config.command === "restful") {
                // 使用 StreamableHTTPClientTransport
                if (!config.baseUrl) {
                    throw new Error("使用 restful 模式时必须提供 baseUrl");
                }
                const sessionId = (0, crypto_1.randomUUID)();
                transport = new streamableHttp_js_1.StreamableHTTPClientTransport(new url_1.URL(config.baseUrl), {
                    sessionId: sessionId
                });
            }
            else {
                // 使用原有的 StdioClientTransport
                let command = config.command;
                let args = [...config.args];
                if (config.command === "node") {
                    command = process.execPath;
                }
                transport = new stdio_js_1.StdioClientTransport({
                    command: command,
                    args: args,
                    env: {
                        ...(0, stdio_js_2.getDefaultEnvironment)(),
                        ...config.env,
                    },
                    stderr: "pipe",
                });
                transport.stderr?.on("data", (data) => console.info(`[MCP] Stdio stderr for server: `, data.toString()));
            }
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
                serverName: serverName,
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
//# sourceMappingURL=mcp-manager-v2.js.map