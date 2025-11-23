/// <reference types="node" />
/// <reference types="node" />
import { Buffer } from "node:buffer";
import { NovaSonicBidirectionalStreamClient } from "./client";
import { DefaultAudioInputConfiguration, DefaultTextConfiguration, DefaultAudioOutputConfiguration } from "../config/consts";
/**
 * StreamSession 类
 * 负责管理单个音频流会话,包括音频缓冲、事件处理等
 */
export declare class StreamSession {
    private sessionId;
    private client;
    private audioBufferQueue;
    private maxQueueSize;
    private isProcessingAudio;
    private isActive;
    private voiceId;
    constructor(sessionId: string, client: NovaSonicBidirectionalStreamClient);
    /**
     * 设置语音ID
     * @param voiceId 语音ID
     */
    setVoiceId(voiceId: string): void;
    /**
     * 获取当前语音ID
     */
    getVoiceId(): string;
    /**
     * 注册事件处理器
     * @param eventType 事件类型
     * @param handler 处理函数
     */
    onEvent(eventType: string, handler: (data: any) => void): StreamSession;
    /**
     * 设置提示开始事件
     */
    setupPromptStart(audioOutputConfig?: typeof DefaultAudioOutputConfiguration): Promise<void>;
    /**
     * 设置系统提示事件
     * @param textConfig 文本配置
     * @param systemPromptContent 系统提示内容
     */
    setupSystemPrompt(textConfig?: typeof DefaultTextConfiguration, systemPromptContent?: string): Promise<void>;
    /**
     * 设置开始音频事件
     * @param audioConfig 音频配置
     */
    setupStartAudio(audioConfig?: typeof DefaultAudioInputConfiguration): Promise<void>;
    /**
     * 流式传输音频数据
     * @param audioData 音频数据
     */
    streamAudio(audioData: Buffer): Promise<void>;
    /**
     * 处理音频队列
     */
    private processAudioQueue;
    /**
     * 获取会话ID
     */
    getSessionId(): string;
    /**
     * 结束音频内容
     */
    endAudioContent(): Promise<void>;
    /**
     * 结束提示
     */
    endPrompt(): Promise<void>;
    /**
     * 关闭会话
     */
    close(): Promise<void>;
}
