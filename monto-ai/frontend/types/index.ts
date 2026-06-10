export type Emotion =
  | "happy"
  | "thinking"
  | "excited"
  | "sad"
  | "surprised"
  | "neutral"
  | "talking";

export type Animation =
  | "smile"
  | "thinking"
  | "talking"
  | "excited"
  | "sad"
  | "blink";

export type Intent =
  | "GENERAL_QUESTION"
  | "HOMEWORK"
  | "STORY"
  | "JOKE"
  | "GREETING"
  | "UNKNOWN";

export interface VoiceQueryResponse {
  transcript: string;
  intent: Intent;
  emotion: Emotion;
  animation: Animation;
  response: string;
  confidence: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  emotion?: Emotion;
  intent?: Intent;
  timestamp: Date;
}

export interface Settings {
  language: "english" | "nepali";
  voice: "male" | "female";
  autoSpeak: boolean;
  darkMode: boolean;
}

export type RecordingState =
  | "idle"
  | "requesting"
  | "recording"
  | "processing"
  | "speaking"
  | "error";
