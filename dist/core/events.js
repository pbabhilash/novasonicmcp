"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventManager = void 0;
const node_crypto_1 = require("node:crypto");
const consts_1 = require("../config/consts");
/**
 * 事件管理类
 * 负责处理会话相关的事件生成和管理
 */
class EventManager {
    /**
     * 创建会话开始事件
     * @param session 会话数据
     */
    createSessionStartEvent(session) {
        return {
            event: {
                sessionStart: {
                    inferenceConfiguration: session.inferenceConfig,
                },
            },
        };
    }
    /**
     * 创建提示开始事件
     * @param session 会话数据
     * @param audioOutputConfig 音频输出配置
     */
    createPromptStartEvent(session, audioOutputConfig) {
        // 获取已Registering MCP tool
        const toolHandler = session.toolHandler;
        const mcpTools = [];
        if (toolHandler) {
            const mcpToolsMap = toolHandler.getRegisteredMcpTools();
            mcpToolsMap.forEach((info, name) => {
                mcpTools.push({
                    name,
                    description: info.description || `MCP 工具: ${name}`,
                    schema: consts_1.DefaultToolSchema, // 可以改为从 toolHandler 获取实际的 schema
                });
            });
        }
        // 基本工具配置
        const baseTools = [
            {
                toolSpec: {
                    name: "getDateAndTimeTool",
                    description: "获取当前日期和时间信息。",
                    inputSchema: {
                        json: consts_1.DefaultToolSchema,
                    },
                },
            },
            {
                toolSpec: {
                    name: "getWeatherTool",
                    description: "根据WGS84坐标获取指定位置的当前天气。",
                    inputSchema: {
                        json: consts_1.WeatherToolSchema,
                    },
                },
            },
        ];
        // 添加 MCP 工具
        const mcpToolSpecs = mcpTools.map((tool) => {
            return {
                toolSpec: {
                    name: tool.name,
                    description: tool.description,
                    inputSchema: {
                        json: tool.schema,
                    },
                },
            };
        });
        console.log("****", mcpToolSpecs);
        return {
            event: {
                promptStart: {
                    promptName: session.promptName,
                    textOutputConfiguration: {
                        mediaType: "text/plain",
                    },
                    audioOutputConfiguration: {
                        ...audioOutputConfig,
                    },
                    toolUseOutputConfiguration: {
                        mediaType: "application/json",
                    },
                    toolConfiguration: {
                        tools: [...baseTools, ...mcpToolSpecs],
                    },
                },
            },
        };
    }
    /**
     * 创建系统提示事件
     * @param session 会话数据
     * @param textConfig 文本配置
     * @param content 提示内容
     */
    createSystemPromptEvents(session, textConfig, content) {
        const textPromptID = (0, node_crypto_1.randomUUID)();
        return [
            {
                event: {
                    contentStart: {
                        promptName: session.promptName,
                        contentName: textPromptID,
                        type: "TEXT",
                        interactive: true,
                        role: "SYSTEM",
                        textInputConfiguration: textConfig,
                    },
                },
            },
            {
                event: {
                    textInput: {
                        promptName: session.promptName,
                        contentName: textPromptID,
                        content: content,
                    },
                },
            },
            {
                event: {
                    contentEnd: {
                        promptName: session.promptName,
                        contentName: textPromptID,
                    },
                },
            },
        ];
    }
    /**
     * 创建开始音频事件
     * @param session 会话数据
     * @param audioConfig 音频配置
     */
    createStartAudioEvent(session, audioConfig) {
        return {
            event: {
                contentStart: {
                    promptName: session.promptName,
                    contentName: session.audioContentId,
                    type: "AUDIO",
                    interactive: true,
                    role: "USER",
                    audioInputConfiguration: audioConfig,
                },
            },
        };
    }
    /**
     * 创建音频输入事件
     * @param session 会话数据
     * @param base64AudioData Base64编码的音频数据
     */
    createAudioInputEvent(session, base64AudioData) {
        return {
            event: {
                audioInput: {
                    promptName: session.promptName,
                    contentName: session.audioContentId,
                    content: base64AudioData,
                },
            },
        };
    }
    /**
     * 创建内容结束事件
     * @param session 会话数据
     */
    createContentEndEvent(session) {
        return {
            event: {
                contentEnd: {
                    promptName: session.promptName,
                    contentName: session.audioContentId,
                },
            },
        };
    }
    /**
     * 创建提示结束事件
     * @param session 会话数据
     */
    createPromptEndEvent(session) {
        return {
            event: {
                promptEnd: {
                    promptName: session.promptName,
                },
            },
        };
    }
    /**
     * 创建会话结束事件
     */
    createSessionEndEvent() {
        return {
            event: {
                sessionEnd: {},
            },
        };
    }
    /**
     * 创建工具结果事件
     * @param session 会话数据
     * @param toolUseId 工具使用ID
     * @param result 工具结果
     */
    createToolResultEvents(session, toolUseId, result) {
        const contentId = (0, node_crypto_1.randomUUID)();
        console.log("**********", result);
        // 确保结果符合 Nova-Sonic API 期望的格式
        // 提取文本内容，避免嵌套的JSON序列化问题
        // let textContent = "";
        // if (typeof result === "string") {
        //   textContent = result;
        // } else if (Array.isArray(result)) {
        //   // 如果是数组，尝试找到第一个text类型的内容
        //   const textItem = result.find((item) => item.type === "text");
        //   if (textItem && textItem.text) {
        //     textContent = textItem.text;
        //   } else {
        //     textContent = JSON.stringify(result);
        //   }
        // } else if (result && typeof result === "object") {
        //   // 如果是对象，尝试提取text字段
        //   if (result.text) {
        //     textContent = result.text;
        //   } else {
        //     textContent = JSON.stringify(result);
        //   }
        // } else {
        //   textContent = JSON.stringify(result);
        // }
        const textContent = Array.isArray(result) && result.length > 0
            ? JSON.stringify(result[0])
            : typeof result === "string"
                ? result
                : JSON.stringify(result);
        console.log("------Tool result received:------", textContent);
        return [
            {
                event: {
                    contentStart: {
                        promptName: session.promptName,
                        contentName: contentId,
                        interactive: false,
                        type: "TOOL",
                        role: "TOOL",
                        toolResultInputConfiguration: {
                            toolUseId: toolUseId,
                            type: "TEXT",
                            textInputConfiguration: {
                                mediaType: "text/plain",
                            },
                        },
                    },
                },
            },
            {
                event: {
                    toolResult: {
                        promptName: session.promptName,
                        contentName: contentId,
                        content: textContent,
                    },
                },
            },
            {
                event: {
                    contentEnd: {
                        promptName: session.promptName,
                        contentName: contentId,
                    },
                },
            },
        ];
    }
}
exports.EventManager = EventManager;
//# sourceMappingURL=events.js.map