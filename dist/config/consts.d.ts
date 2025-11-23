import { AudioType, AudioMediaType, TextMediaType } from "../types/types";
export declare const DefaultInferenceConfiguration: {
    maxTokens: number;
    topP: number;
    temperature: number;
};
export declare const DefaultAudioInputConfiguration: {
    audioType: AudioType;
    encoding: string;
    mediaType: AudioMediaType;
    sampleRateHertz: number;
    sampleSizeBits: number;
    channelCount: number;
};
export declare const DefaultToolSchema: string;
export declare const WeatherToolSchema: string;
export declare const DefaultTextConfiguration: {
    mediaType: TextMediaType;
};
export declare const DefaultSystemPrompt: string;
export declare const DefaultAudioOutputConfiguration: {
    sampleRateHertz: number;
    voiceId: string;
    audioType: AudioType;
    encoding: string;
    mediaType: AudioMediaType;
    sampleSizeBits: number;
    channelCount: number;
};
