"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolHandler = void 0;
const axios_1 = __importDefault(require("axios"));
const https_1 = __importDefault(require("https"));
/**
 * 工具处理类
 * 负责处理各种工具的调用和响应
 */
class ToolHandler {
    constructor() {
        // 存储 MCP 工具信息
        this.mcpTools = new Map();
    }
    /**
     * 处理工具调用
     * @param toolName 工具名称
     * @param toolUseContent 工具使用内容
     */
    async processToolUse(toolName, toolUseContent) {
        // 检查是否是 MCP 工具
        if (this.mcpTools.has(toolName)) {
            console.log(`处理 MCP 工具调用: ${toolName}`);
            const toolInfo = this.mcpTools.get(toolName);
            if (toolInfo) {
                try {
                    return await toolInfo.handler(toolUseContent);
                }
                catch (error) {
                    console.error(`MCP 工具 ${toolName} 调用失败:`, String(error));
                    throw new Error(`MCP 工具 ${toolName} 调用失败: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }
        // 处理内置工具
        const tool = toolName.toLowerCase();
        switch (tool) {
            case "getdateandtimetool":
                return this.getDateAndTime();
            case "getweathertool":
                console.log("处理天气工具调用");
                const parsedContent = await this.parseToolUseContentForWeather(toolUseContent);
                if (!parsedContent) {
                    throw new Error("解析内容为空");
                }
                return this.fetchWeatherData(parsedContent.latitude, parsedContent.longitude);
            default:
                console.log(`不支持的工具 ${tool}`);
                throw new Error(`不支持的工具 ${tool}`);
        }
    }
    /**
     * Registering MCP tool
     * @param toolName 工具名称
     * @param handler 处理函数
     * @param serverName 服务器名称
     * @param description 工具描述
     * @param isAutoApproved 是否auto-approve
     */
    registerMcpTool(toolName, handler, serverName, description = "", isAutoApproved = false) {
        console.log(`Registering MCP tool: ${serverName}/${toolName} (auto-approve: ${isAutoApproved})`);
        this.mcpTools.set(toolName, {
            handler,
            serverName,
            description,
            isAutoApproved,
        });
    }
    /**
     * 获取所有已Registering MCP tool信息
     */
    getRegisteredMcpTools() {
        return this.mcpTools;
    }
    /**
     * 获取所有已Registering MCP tool名称
     */
    getRegisteredMcpToolNames() {
        return Array.from(this.mcpTools.keys());
    }
    /**
     * 获取工具的服务器名称
     */
    getToolServerName(toolName) {
        const toolInfo = this.mcpTools.get(toolName);
        return toolInfo ? toolInfo.serverName : null;
    }
    /**
     * 检查工具是否auto-approve
     */
    isToolAutoApproved(toolName) {
        const toolInfo = this.mcpTools.get(toolName);
        return toolInfo ? toolInfo.isAutoApproved : false;
    }
    /**
     * 获取日期和时间信息
     */
    getDateAndTime() {
        const date = new Date().toLocaleString("en-US", {
            timeZone: "America/Los_Angeles",
        });
        const pstDate = new Date(date);
        return {
            date: pstDate.toISOString().split("T")[0],
            year: pstDate.getFullYear(),
            month: pstDate.getMonth() + 1,
            day: pstDate.getDate(),
            dayOfWeek: pstDate
                .toLocaleString("en-US", { weekday: "long" })
                .toUpperCase(),
            timezone: "PST",
            formattedTime: pstDate.toLocaleTimeString("en-US", {
                hour12: true,
                hour: "2-digit",
                minute: "2-digit",
            }),
        };
    }
    /**
     * 解析天气工具的使用内容
     * @param toolUseContent 工具使用内容
     */
    async parseToolUseContentForWeather(toolUseContent) {
        try {
            if (toolUseContent && typeof toolUseContent.content === "string") {
                const parsedContent = JSON.parse(toolUseContent.content);
                console.log(`解析的内容: ${parsedContent}`);
                return {
                    latitude: parsedContent.latitude,
                    longitude: parsedContent.longitude,
                };
            }
            return null;
        }
        catch (error) {
            console.error("解析工具使用内容失败:", error);
            return null;
        }
    }
    /**
     * 获取天气数据
     * @param latitude 纬度
     * @param longitude 经度
     */
    async fetchWeatherData(latitude, longitude) {
        const ipv4Agent = new https_1.default.Agent({ family: 4 });
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
        try {
            const response = await axios_1.default.get(url, {
                httpsAgent: ipv4Agent,
                timeout: 5000,
                headers: {
                    "User-Agent": "MyApp/1.0",
                    Accept: "application/json",
                },
            });
            const weatherData = response.data;
            console.log("天气数据:", weatherData);
            return {
                weather_data: weatherData,
            };
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                console.error(`获取天气数据失败: ${error.message}`, String(error));
            }
            else {
                console.error(`意外错误: ${error instanceof Error ? error.message : String(error)}`, String(error));
            }
            throw error;
        }
    }
}
exports.ToolHandler = ToolHandler;
//# sourceMappingURL=tools.js.map