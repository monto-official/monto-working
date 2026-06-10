"use client";
import { useState, useCallback } from "react";
import { ChatMessage, VoiceQueryResponse } from "@/types";
import { generateId } from "@/lib/utils";

const STORAGE_KEY = "monto_chat_history";

function loadHistory(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    return parsed.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [];
  }
}

function saveHistory(messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // storage full or unavailable — ignore
  }
}

export function useConversation() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory());

  const addUserMessage = useCallback((text: string): ChatMessage => {
    const msg: ChatMessage = {
      id: generateId(),
      role: "user",
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => {
      const updated = [...prev, msg];
      saveHistory(updated);
      return updated;
    });
    return msg;
  }, []);

  const addAssistantMessage = useCallback(
    (response: VoiceQueryResponse): ChatMessage => {
      const msg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        text: response.response,
        emotion: response.emotion,
        intent: response.intent,
        timestamp: new Date(),
      };
      setMessages((prev) => {
        const updated = [...prev, msg];
        saveHistory(updated);
        return updated;
      });
      return msg;
    },
    []
  );

  const clearHistory = useCallback(() => {
    setMessages([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return { messages, addUserMessage, addAssistantMessage, clearHistory };
}
