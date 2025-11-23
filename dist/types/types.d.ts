import { BedrockRuntimeClientConfig } from "@aws-sdk/client-bedrock-runtime";
import { NodeHttp2HandlerOptions } from "@smithy/node-http-handler";
import { Provider } from "@smithy/types";
import { Subject } from "rxjs";
import { ToolHandler } from "../services/tools";
export type AudioType = "wav" | "mp3" | "pcm";
export type AudioMediaType = "audio/wav" | "audio/mp3" | "audio/pcm";
export type TextMediaType = "text/plain" | "application/json";
export interface McpServerConfig {
    command: string;
    args: string[];
    env?: Record<string, string>;
    autoApprove?: string[];
    disabled?: boolean;
    transportType?: "stdio" | "sse" | "streamable_http";
    sseUrl?: string;
    baseUrl?: string;
    headers?: Record<string, string>;
}
export interface McpConfig {
    mcpServers: Record<string, McpServerConfig>;
}
export interface McpTool {
    name: string;
    description?: string;
    inputSchema: any;
    serverName: string;
}
export interface NovaSonicBidirectionalStreamClientConfig {
    requestHandlerConfig?: NodeHttp2HandlerOptions | Provider<NodeHttp2HandlerOptions | void>;
    clientConfig: Partial<BedrockRuntimeClientConfig>;
    inferenceConfig?: InferenceConfig;
    mcpConfig?: McpConfig;
}
export interface InferenceConfig {
    maxTokens: number;
    topP: number;
    temperature: number;
}
export interface SessionData {
    queue: Array<any>;
    queueSignal: Subject<void>;
    closeSignal: Subject<void>;
    responseSubject: Subject<any>;
    toolUseContent: any;
    toolUseId: string;
    toolName: string;
    responseHandlers: Map<string, (data: any) => void>;
    promptName: string;
    inferenceConfig: InferenceConfig;
    isActive: boolean;
    isPromptStartSent: boolean;
    isAudioContentStartSent: boolean;
    audioContentId: string;
    toolHandler?: ToolHandler;
}
export interface WeatherParseResult {
    latitude: number;
    longitude: number;
}
