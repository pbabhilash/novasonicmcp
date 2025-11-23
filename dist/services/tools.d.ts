export type McpToolHandler = (toolUseContent: any) => Promise<any>;
export interface McpToolInfo {
    handler: McpToolHandler;
    serverName: string;
    description: string;
    isAutoApproved: boolean;
}
/**
 * 工具处理类
 * 负责处理各种工具的调用和响应
 */
export declare class ToolHandler {
    private mcpTools;
    /**
     * 处理工具调用
     * @param toolName 工具名称
     * @param toolUseContent 工具使用内容
     */
    processToolUse(toolName: string, toolUseContent: object): Promise<Object>;
    /**
     * Registering MCP tool
     * @param toolName 工具名称
     * @param handler 处理函数
     * @param serverName 服务器名称
     * @param description 工具描述
     * @param isAutoApproved 是否auto-approve
     */
    registerMcpTool(toolName: string, handler: McpToolHandler, serverName: string, description?: string, isAutoApproved?: boolean): void;
    /**
     * 获取所有已Registering MCP tool信息
     */
    getRegisteredMcpTools(): Map<string, McpToolInfo>;
    /**
     * 获取所有已Registering MCP tool名称
     */
    getRegisteredMcpToolNames(): string[];
    /**
     * 获取工具的服务器名称
     */
    getToolServerName(toolName: string): string | null;
    /**
     * 检查工具是否auto-approve
     */
    isToolAutoApproved(toolName: string): boolean;
    /**
     * 获取日期和时间信息
     */
    private getDateAndTime;
    /**
     * 解析天气工具的使用内容
     * @param toolUseContent 工具使用内容
     */
    private parseToolUseContentForWeather;
    /**
     * 获取天气数据
     * @param latitude 纬度
     * @param longitude 经度
     */
    private fetchWeatherData;
}
