/// <reference types="node" />
/// <reference types="node" />
import { Buffer } from "node:buffer";
import { NovaSonicBidirectionalStreamClientConfig } from "../types/types";
import { StreamSession } from "./session";
import { ToolHandler } from "../services/tools";
/**
 * Nova Sonic Bidirectional Stream Client
 * Manages audio stream sessions, tool calls, and event handling
 */
export declare class NovaSonicBidirectionalStreamClient {
    private bedrockRuntimeClient;
    private inferenceConfig;
    private activeSessions;
    private sessionLastActivity;
    private sessionCleanupInProgress;
    private toolHandler;
    private eventManager;
    constructor(config: NovaSonicBidirectionalStreamClientConfig, toolHandler?: ToolHandler);
    /**
     * Check if session is active
     */
    isSessionActive(sessionId: string): boolean;
    /**
     * Get all active session IDs
     */
    getActiveSessions(): string[];
    /**
     * Get session last activity time
     */
    getLastActivityTime(sessionId: string): number;
    /**
     * Update session activity time
     */
    private updateSessionActivity;
    /**
     * Check if session cleanup is in progress
     */
    isCleanupInProgress(sessionId: string): boolean;
    /**
     * Create new stream session
     */
    createStreamSession(sessionId?: string, config?: NovaSonicBidirectionalStreamClientConfig): StreamSession;
    /**
     * 初始化会话
     */
    initiateSession(sessionId: string): Promise<void>;
    /**
     * 为会话分发事件
     */
    private dispatchEventForSession;
    /**
     * 创建会话的异步迭代器
     */
    private createSessionAsyncIterable;
    /**
     * 处理响应流
     */
    private processResponseStream;
    /**
     * 处理响应事件
     */
    private handleResponseEvent;
    /**
     * 处理工具使用
     */
    private handleToolUse;
    /**
     * 处理工具结束
     */
    private handleToolEnd;
    /**
     * 处理其他事件
     */
    private handleOtherEvents;
    /**
     * 处理模型错误
     */
    private handleModelError;
    /**
     * 处理服务器错误
     */
    private handleServerError;
    /**
     * 处理流错误
     */
    private handleStreamError;
    /**
     * 向会话队列添加事件
     */
    private addEventToSessionQueue;
    /**
     * 设置会话开始事件
     */
    private setupSessionStartEvent;
    /**
     * 设置提示开始事件
     */
    setupPromptStartEvent(sessionId: string, audioOutputConfig: any): void;
    /**
     * 设置系统提示事件
     */
    setupSystemPromptEvent(sessionId: string, textConfig: any, systemPromptContent: string): void;
    /**
     * 设置开始音频事件
     */
    setupStartAudioEvent(sessionId: string, audioConfig: any): void;
    /**
     * 流式传输音频数据块
     */
    streamAudioChunk(sessionId: string, audioData: Buffer): Promise<void>;
    /**
     * 发送工具结果
     */
    private sendToolResult;
    /**
     * 发送内容结束事件
     */
    sendContentEnd(sessionId: string): Promise<void>;
    /**
     * 发送提示结束事件
     */
    sendPromptEnd(sessionId: string): Promise<void>;
    /**
     * 发送会话结束事件
     */
    sendSessionEnd(sessionId: string): Promise<void>;
    /**
     * 注册事件处理器
     */
    registerEventHandler(sessionId: string, eventType: string, handler: (data: any) => void): void;
    /**
     * 分发事件
     */
    private dispatchEvent;
    /**
     * 关闭会话
     */
    closeSession(sessionId: string): Promise<void>;
    /**
     * 强制关闭会话
     */
    forceCloseSession(sessionId: string): void;
}
