"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NovaSonicBidirectionalStreamClient = void 0;
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
const node_http_handler_1 = require("@smithy/node-http-handler");
const node_crypto_1 = require("node:crypto");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const rxjs_2 = require("rxjs");
const session_1 = require("./session");
const tools_1 = require("../services/tools");
const events_1 = require("./events");
/**
 * Nova Sonic Bidirectional Stream Client
 * Manages audio stream sessions, tool calls, and event handling
 */
class NovaSonicBidirectionalStreamClient {
    constructor(config, toolHandler) {
        this.activeSessions = new Map();
        this.sessionLastActivity = new Map();
        this.sessionCleanupInProgress = new Set();
        // Initialize HTTP2 handler
        const nodeHttp2Handler = new node_http_handler_1.NodeHttp2Handler({
            requestTimeout: 300000,
            sessionTimeout: 600000,
            disableConcurrentStreams: false,
            maxConcurrentStreams: 20,
            ...config.requestHandlerConfig,
        });
        // AWS SDK will automatically discover credentials in this order:
        // 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
        // 2. IAM role (App Runner, EC2, ECS, Lambda) - Used in production
        // 3. Credentials file (~/.aws/credentials) - Used in local development
        // No need to throw error if credentials are undefined
        // Initialize Bedrock runtime client
        this.bedrockRuntimeClient = new client_bedrock_runtime_1.BedrockRuntimeClient({
            ...config.clientConfig,
            region: config.clientConfig.region || "eu-west-1",
            requestHandler: nodeHttp2Handler,
            // credentials will be auto-discovered if not provided
        });
        this.inferenceConfig = config.inferenceConfig ?? {
            maxTokens: 1024,
            topP: 0.9,
            temperature: 1,
        };
        this.toolHandler = toolHandler || new tools_1.ToolHandler();
        this.eventManager = new events_1.EventManager();
    }
    /**
     * Check if session is active
     */
    isSessionActive(sessionId) {
        const session = this.activeSessions.get(sessionId);
        return !!session && session.isActive;
    }
    /**
     * Get all active session IDs
     */
    getActiveSessions() {
        return Array.from(this.activeSessions.keys());
    }
    /**
     * Get session last activity time
     */
    getLastActivityTime(sessionId) {
        return this.sessionLastActivity.get(sessionId) || 0;
    }
    /**
     * Update session activity time
     */
    updateSessionActivity(sessionId) {
        this.sessionLastActivity.set(sessionId, Date.now());
    }
    /**
     * Check if session cleanup is in progress
     */
    isCleanupInProgress(sessionId) {
        return this.sessionCleanupInProgress.has(sessionId);
    }
    /**
     * Create new stream session
     */
    createStreamSession(sessionId = (0, node_crypto_1.randomUUID)(), config) {
        if (this.activeSessions.has(sessionId)) {
            throw new Error(`会话 ${sessionId} 已存在`);
        }
        const session = {
            queue: [],
            queueSignal: new rxjs_2.Subject(),
            closeSignal: new rxjs_2.Subject(),
            responseSubject: new rxjs_2.Subject(),
            toolUseContent: null,
            toolUseId: "",
            toolName: "",
            responseHandlers: new Map(),
            promptName: (0, node_crypto_1.randomUUID)(),
            inferenceConfig: config?.inferenceConfig ?? this.inferenceConfig,
            isActive: true,
            isPromptStartSent: false,
            isAudioContentStartSent: false,
            audioContentId: (0, node_crypto_1.randomUUID)(),
            toolHandler: this.toolHandler, // 添加工具处理器到会话
        };
        this.activeSessions.set(sessionId, session);
        return new session_1.StreamSession(sessionId, this);
    }
    /**
     * 初始化会话
     */
    async initiateSession(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`会话 ${sessionId} 不存在`);
        }
        try {
            this.setupSessionStartEvent(sessionId);
            const asyncIterable = this.createSessionAsyncIterable(sessionId);
            console.log(`Starting bidirectional stream for session...`);
            const response = await this.bedrockRuntimeClient.send(new client_bedrock_runtime_1.InvokeModelWithBidirectionalStreamCommand({
                modelId: "amazon.nova-sonic-v1:0",
                body: asyncIterable,
            }));
            console.log(`会话 ${sessionId} stream established, processing response...`);
            await this.processResponseStream(sessionId, response);
        }
        catch (error) {
            console.error(`会话 ${sessionId} 出错:`, error);
            this.dispatchEventForSession(sessionId, "error", {
                source: "bidirectionalStream",
                error,
            });
            if (session.isActive) {
                this.closeSession(sessionId);
            }
        }
    }
    /**
     * 为会话分发事件
     */
    dispatchEventForSession(sessionId, eventType, data) {
        const session = this.activeSessions.get(sessionId);
        if (!session)
            return;
        const handler = session.responseHandlers.get(eventType);
        if (handler) {
            try {
                handler(data);
            }
            catch (e) {
                console.error(`会话 ${sessionId} 的 ${eventType} 处理器出错: `, e);
            }
        }
        const anyHandler = session.responseHandlers.get("any");
        if (anyHandler) {
            try {
                anyHandler({ type: eventType, data });
            }
            catch (e) {
                console.error(`会话 ${sessionId} 的通用处理器出错: `, e);
            }
        }
    }
    /**
     * 创建会话的异步迭代器
     */
    createSessionAsyncIterable(sessionId) {
        if (!this.isSessionActive(sessionId)) {
            console.log(`无法创建异步迭代器: 会话 ${sessionId} 不活跃`);
            return {
                [Symbol.asyncIterator]: () => ({
                    next: async () => ({ value: undefined, done: true }),
                }),
            };
        }
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`无法创建异步迭代器: 会话 ${sessionId} 不存在`);
        }
        let eventCount = 0;
        return {
            [Symbol.asyncIterator]: () => {
                console.log(`Requesting async iterator for session`);
                return {
                    next: async () => {
                        try {
                            if (!session.isActive || !this.activeSessions.has(sessionId)) {
                                console.log(`会话 ${sessionId} 的迭代器关闭`);
                                return { value: undefined, done: true };
                            }
                            if (session.queue.length === 0) {
                                try {
                                    await Promise.race([
                                        (0, rxjs_1.firstValueFrom)(session.queueSignal.pipe((0, operators_1.take)(1))),
                                        (0, rxjs_1.firstValueFrom)(session.closeSignal.pipe((0, operators_1.take)(1))).then(() => {
                                            throw new Error("Stream closed");
                                        }),
                                    ]);
                                }
                                catch (error) {
                                    if (error instanceof Error) {
                                        if (error.message === "Stream closed" ||
                                            !session.isActive) {
                                            if (this.activeSessions.has(sessionId)) {
                                                console.log(`会话 ${sessionId} 在等待时关闭`);
                                            }
                                            return { value: undefined, done: true };
                                        }
                                    }
                                    else {
                                        console.error(`事件关闭时出错`, error);
                                    }
                                }
                            }
                            if (session.queue.length === 0 || !session.isActive) {
                                console.log(`队列为空或会话不活跃: ${sessionId}`);
                                return { value: undefined, done: true };
                            }
                            const nextEvent = session.queue.shift();
                            eventCount++;
                            return {
                                value: {
                                    chunk: {
                                        bytes: new TextEncoder().encode(JSON.stringify(nextEvent)),
                                    },
                                },
                                done: false,
                            };
                        }
                        catch (error) {
                            console.error(`会话 ${sessionId} 迭代器出错: `, error);
                            session.isActive = false;
                            return { value: undefined, done: true };
                        }
                    },
                    return: async () => {
                        console.log(`调用会话 ${sessionId} 迭代器的 return()`);
                        session.isActive = false;
                        return { value: undefined, done: true };
                    },
                    throw: async (error) => {
                        console.log(`调用会话 ${sessionId} 迭代器的 throw() 错误: `, error);
                        session.isActive = false;
                        throw error;
                    },
                };
            },
        };
    }
    /**
     * 处理响应流
     */
    async processResponseStream(sessionId, response) {
        const session = this.activeSessions.get(sessionId);
        if (!session)
            return;
        try {
            for await (const event of response.body) {
                if (!session.isActive) {
                    console.log(`会话 ${sessionId} 不再活跃,停止处理响应`);
                    break;
                }
                if (event.chunk?.bytes) {
                    try {
                        this.updateSessionActivity(sessionId);
                        const textResponse = new TextDecoder().decode(event.chunk.bytes);
                        try {
                            const jsonResponse = JSON.parse(textResponse);
                            await this.handleResponseEvent(sessionId, jsonResponse, session);
                        }
                        catch (e) {
                            console.log(`会话 ${sessionId} 的原始文本响应(解析错误): ${textResponse}`);
                        }
                    }
                    catch (e) {
                        console.error(`处理会话 ${sessionId} 的响应块时出错:`, e);
                    }
                }
                else if (event.modelStreamErrorException) {
                    this.handleModelError(sessionId, event.modelStreamErrorException);
                }
                else if (event.internalServerException) {
                    this.handleServerError(sessionId, event.internalServerException);
                }
            }
            console.log(`会话 ${sessionId} 的响应流处理完成`);
            this.dispatchEvent(sessionId, "streamComplete", {
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            this.handleStreamError(sessionId, error);
        }
    }
    /**
     * 处理响应事件
     */
    async handleResponseEvent(sessionId, jsonResponse, session) {
        if (jsonResponse.event?.contentStart) {
            this.dispatchEvent(sessionId, "contentStart", jsonResponse.event.contentStart);
        }
        else if (jsonResponse.event?.textOutput) {
            this.dispatchEvent(sessionId, "textOutput", jsonResponse.event.textOutput);
        }
        else if (jsonResponse.event?.audioOutput) {
            this.dispatchEvent(sessionId, "audioOutput", jsonResponse.event.audioOutput);
        }
        else if (jsonResponse.event?.toolUse) {
            await this.handleToolUse(sessionId, jsonResponse.event.toolUse, session);
        }
        else if (jsonResponse.event?.contentEnd &&
            jsonResponse.event?.contentEnd?.type === "TOOL") {
            await this.handleToolEnd(sessionId, session);
        }
        else if (jsonResponse.event?.contentEnd) {
            this.dispatchEvent(sessionId, "contentEnd", jsonResponse.event.contentEnd);
        }
        else {
            this.handleOtherEvents(sessionId, jsonResponse);
        }
    }
    /**
     * 处理工具使用
     */
    async handleToolUse(sessionId, toolUse, session) {
        this.dispatchEvent(sessionId, "toolUse", toolUse);
        session.toolUseContent = toolUse;
        session.toolUseId = toolUse.toolUseId;
        session.toolName = toolUse.toolName;
    }
    /**
     * 处理工具结束
     */
    async handleToolEnd(sessionId, session) {
        console.log(`处理会话 ${sessionId} 的工具使用`);
        this.dispatchEvent(sessionId, "toolEnd", {
            toolUseContent: session.toolUseContent,
            toolUseId: session.toolUseId,
            toolName: session.toolName,
        });
        const toolResult = await this.toolHandler.processToolUse(session.toolName, session.toolUseContent);
        this.sendToolResult(sessionId, session.toolUseId, toolResult);
        this.dispatchEvent(sessionId, "toolResult", {
            toolUseId: session.toolUseId,
            result: toolResult,
        });
    }
    /**
     * 处理其他事件
     */
    handleOtherEvents(sessionId, jsonResponse) {
        const eventKeys = Object.keys(jsonResponse.event || {});
        if (eventKeys.length > 0) {
            this.dispatchEvent(sessionId, eventKeys[0], jsonResponse.event);
        }
        else if (Object.keys(jsonResponse).length > 0) {
            this.dispatchEvent(sessionId, "unknown", jsonResponse);
        }
    }
    /**
     * 处理模型错误
     */
    handleModelError(sessionId, error) {
        console.error(`会话 ${sessionId} 的模型流错误:`, error);
        this.dispatchEvent(sessionId, "error", {
            type: "modelStreamErrorException",
            details: error,
        });
    }
    /**
     * 处理服务器错误
     */
    handleServerError(sessionId, error) {
        console.error(`会话 ${sessionId} 的内部服务器错误:`, error);
        this.dispatchEvent(sessionId, "error", {
            type: "internalServerException",
            details: error,
        });
    }
    /**
     * 处理流错误
     */
    handleStreamError(sessionId, error) {
        console.error(`Error processing response stream for session:`, error);
        this.dispatchEvent(sessionId, "error", {
            source: "responseStream",
            message: "Error processing response stream",
            details: error instanceof Error ? error.message : String(error),
        });
    }
    /**
     * 向会话队列添加事件
     */
    addEventToSessionQueue(sessionId, event) {
        const session = this.activeSessions.get(sessionId);
        if (!session || !session.isActive)
            return;
        this.updateSessionActivity(sessionId);
        session.queue.push(event);
        session.queueSignal.next();
    }
    /**
     * 设置会话开始事件
     */
    setupSessionStartEvent(sessionId) {
        console.log(`Setting initial event for session...`);
        const session = this.activeSessions.get(sessionId);
        if (!session)
            return;
        this.addEventToSessionQueue(sessionId, this.eventManager.createSessionStartEvent(session));
    }
    /**
     * 设置提示开始事件
     */
    setupPromptStartEvent(sessionId, audioOutputConfig) {
        console.log(`设置会话 ${sessionId} 的提示开始事件...`);
        const session = this.activeSessions.get(sessionId);
        if (!session)
            return;
        this.addEventToSessionQueue(sessionId, this.eventManager.createPromptStartEvent(session, audioOutputConfig));
        session.isPromptStartSent = true;
    }
    /**
     * 设置系统提示事件
     */
    setupSystemPromptEvent(sessionId, textConfig, systemPromptContent) {
        console.log(`设置会话 ${sessionId} 的系统提示事件...`);
        const session = this.activeSessions.get(sessionId);
        if (!session)
            return;
        const events = this.eventManager.createSystemPromptEvents(session, textConfig, systemPromptContent);
        events.forEach((event) => this.addEventToSessionQueue(sessionId, event));
    }
    /**
     * 设置开始音频事件
     */
    setupStartAudioEvent(sessionId, audioConfig) {
        console.log(`设置会话 ${sessionId} 的开始音频事件...`);
        const session = this.activeSessions.get(sessionId);
        if (!session)
            return;
        this.addEventToSessionQueue(sessionId, this.eventManager.createStartAudioEvent(session, audioConfig));
        session.isAudioContentStartSent = true;
    }
    /**
     * 流式传输音频数据块
     */
    async streamAudioChunk(sessionId, audioData) {
        const session = this.activeSessions.get(sessionId);
        if (!session || !session.isActive || !session.audioContentId) {
            throw new Error(`会话 ${sessionId} 无效,无法传输音频`);
        }
        const base64Data = audioData.toString("base64");
        this.addEventToSessionQueue(sessionId, this.eventManager.createAudioInputEvent(session, base64Data));
    }
    /**
     * 发送工具结果
     */
    async sendToolResult(sessionId, toolUseId, result) {
        const session = this.activeSessions.get(sessionId);
        if (!session || !session.isActive)
            return;
        console.log(`发送会话 ${sessionId} 的工具结果, 工具使用ID: ${toolUseId}`);
        const events = this.eventManager.createToolResultEvents(session, toolUseId, result);
        events.forEach((event) => this.addEventToSessionQueue(sessionId, event));
    }
    /**
     * 发送内容结束事件
     */
    async sendContentEnd(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session || !session.isAudioContentStartSent)
            return;
        this.addEventToSessionQueue(sessionId, this.eventManager.createContentEndEvent(session));
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    /**
     * 发送提示结束事件
     */
    async sendPromptEnd(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session || !session.isPromptStartSent)
            return;
        this.addEventToSessionQueue(sessionId, this.eventManager.createPromptEndEvent(session));
        await new Promise((resolve) => setTimeout(resolve, 300));
    }
    /**
     * 发送会话结束事件
     */
    async sendSessionEnd(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session)
            return;
        this.addEventToSessionQueue(sessionId, this.eventManager.createSessionEndEvent());
        await new Promise((resolve) => setTimeout(resolve, 300));
        session.isActive = false;
        session.closeSignal.next();
        session.closeSignal.complete();
        this.activeSessions.delete(sessionId);
        this.sessionLastActivity.delete(sessionId);
        console.log(`会话 ${sessionId} 已关闭并从活跃会话中移除`);
    }
    /**
     * 注册事件处理器
     */
    registerEventHandler(sessionId, eventType, handler) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`会话 ${sessionId} 不存在`);
        }
        session.responseHandlers.set(eventType, handler);
    }
    /**
     * 分发事件
     */
    dispatchEvent(sessionId, eventType, data) {
        const session = this.activeSessions.get(sessionId);
        if (!session)
            return;
        const handler = session.responseHandlers.get(eventType);
        if (handler) {
            try {
                handler(data);
            }
            catch (e) {
                console.error(`会话 ${sessionId} 的 ${eventType} 处理器出错:`, e);
            }
        }
        const anyHandler = session.responseHandlers.get("any");
        if (anyHandler) {
            try {
                anyHandler({ type: eventType, data });
            }
            catch (e) {
                console.error(`会话 ${sessionId} 的通用处理器出错:`, e);
            }
        }
    }
    /**
     * 关闭会话
     */
    async closeSession(sessionId) {
        if (this.sessionCleanupInProgress.has(sessionId)) {
            console.log(`会话 ${sessionId} 的清理正在进行,跳过`);
            return;
        }
        this.sessionCleanupInProgress.add(sessionId);
        try {
            console.log(`开始关闭会话 ${sessionId}`);
            await this.sendContentEnd(sessionId);
            await this.sendPromptEnd(sessionId);
            await this.sendSessionEnd(sessionId);
            console.log(`会话 ${sessionId} 清理完成`);
        }
        catch (error) {
            console.error(`会话 ${sessionId} 的关闭序列出错:`, error);
            const session = this.activeSessions.get(sessionId);
            if (session) {
                session.isActive = false;
                this.activeSessions.delete(sessionId);
                this.sessionLastActivity.delete(sessionId);
            }
        }
        finally {
            this.sessionCleanupInProgress.delete(sessionId);
        }
    }
    /**
     * 强制关闭会话
     */
    forceCloseSession(sessionId) {
        if (this.sessionCleanupInProgress.has(sessionId) ||
            !this.activeSessions.has(sessionId)) {
            console.log(`会话 ${sessionId} 已在清理中或不活跃`);
            return;
        }
        this.sessionCleanupInProgress.add(sessionId);
        try {
            const session = this.activeSessions.get(sessionId);
            if (!session)
                return;
            console.log(`强制关闭会话 ${sessionId}`);
            session.isActive = false;
            session.closeSignal.next();
            session.closeSignal.complete();
            this.activeSessions.delete(sessionId);
            this.sessionLastActivity.delete(sessionId);
            console.log(`会话 ${sessionId} 已强制关闭`);
        }
        finally {
            this.sessionCleanupInProgress.delete(sessionId);
        }
    }
}
exports.NovaSonicBidirectionalStreamClient = NovaSonicBidirectionalStreamClient;
//# sourceMappingURL=client.js.map