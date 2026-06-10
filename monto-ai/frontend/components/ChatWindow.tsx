"use client";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Sparkles } from "lucide-react";
import { ChatMessage } from "@/types";
import { formatTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface ChatWindowProps {
  messages: ChatMessage[];
}

export function ChatWindow({ messages }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-center p-8">
        <div>
          <p className="text-4xl mb-3">👋</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm">
            Say hello to start a conversation!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scroll-smooth">
      <AnimatePresence initial={false}>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className={cn(
              "flex gap-2",
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            )}
          >
            {/* Avatar icon */}
            <div
              className={cn(
                "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
                msg.role === "user"
                  ? "bg-primary-100 dark:bg-primary-900/40"
                  : "bg-gradient-to-br from-primary-500 to-secondary-500"
              )}
            >
              {msg.role === "user" ? (
                <User className="w-3.5 h-3.5 text-primary-600 dark:text-primary-300" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-white" />
              )}
            </div>

            {/* Bubble */}
            <div
              className={cn(
                "max-w-[75%] rounded-2xl px-3.5 py-2.5",
                msg.role === "user"
                  ? "bg-gradient-to-br from-primary-500 to-secondary-500 text-white rounded-tr-sm"
                  : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-sm shadow-sm"
              )}
            >
              <p className="text-sm leading-relaxed">{msg.text}</p>
              <p
                className={cn(
                  "text-[10px] mt-1",
                  msg.role === "user"
                    ? "text-primary-200 text-right"
                    : "text-gray-400 dark:text-gray-500"
                )}
              >
                {formatTime(msg.timestamp)}
              </p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      <div ref={bottomRef} />
    </div>
  );
}
