import { SessionData } from "../types/types";
/**
 * 事件管理类
 * 负责处理会话相关的事件生成和管理
 */
export declare class EventManager {
    /**
     * 创建会话开始事件
     * @param session 会话数据
     */
    createSessionStartEvent(session: SessionData): object;
    /**
     * 创建提示开始事件
     * @param session 会话数据
     * @param audioOutputConfig 音频输出配置
     */
    createPromptStartEvent(session: SessionData, audioOutputConfig: any): object;
    /**
     * 创建系统提示事件
     * @param session 会话数据
     * @param textConfig 文本配置
     * @param content 提示内容
     */
    createSystemPromptEvents(session: SessionData, textConfig: any, content: string): object[];
    /**
     * 创建开始音频事件
     * @param session 会话数据
     * @param audioConfig 音频配置
     */
    createStartAudioEvent(session: SessionData, audioConfig: any): object;
    /**
     * 创建音频输入事件
     * @param session 会话数据
     * @param base64AudioData Base64编码的音频数据
     */
    createAudioInputEvent(session: SessionData, base64AudioData: string): object;
    /**
     * 创建内容结束事件
     * @param session 会话数据
     */
    createContentEndEvent(session: SessionData): object;
    /**
     * 创建提示结束事件
     * @param session 会话数据
     */
    createPromptEndEvent(session: SessionData): object;
    /**
     * 创建会话结束事件
     */
    createSessionEndEvent(): object;
    /**
     * 创建工具结果事件
     * @param session 会话数据
     * @param toolUseId 工具使用ID
     * @param result 工具结果
     */
    createToolResultEvents(session: SessionData, toolUseId: string, result: any): object[];
}
