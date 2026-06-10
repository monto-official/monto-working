"use client";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquarePlus,
  History,
  Settings,
  Moon,
  Sun,
  X,
  Info,
  Sparkles,
} from "lucide-react";
import { ChatMessage } from "@/types";
import { formatTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  darkMode: boolean;
  onToggleDark: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  activeTab: "history" | "about";
  onTabChange: (tab: "history" | "about") => void;
}

export function Sidebar({
  isOpen,
  onClose,
  messages,
  darkMode,
  onToggleDark,
  onNewChat,
  onOpenSettings,
  activeTab,
  onTabChange,
}: SidebarProps) {
  const userMessages = messages.filter((m) => m.role === "user");

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-30 lg:hidden"
            onClick={onClose}
          />

          {/* Sidebar panel */}
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed left-0 top-0 h-full w-72 bg-white dark:bg-gray-900 shadow-2xl z-40 flex flex-col border-r border-gray-200 dark:border-gray-800"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-gray-900 dark:text-white">
                  Monto AI
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Close sidebar"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* New Chat button */}
            <div className="p-3">
              <button
                onClick={() => { onNewChat(); onClose(); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-secondary-500 text-white font-medium text-sm hover:opacity-90 transition-opacity"
              >
                <MessageSquarePlus className="w-4 h-4" />
                New Chat
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-800 mx-3">
              {(["history", "about"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => onTabChange(tab)}
                  className={cn(
                    "flex-1 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors",
                    activeTab === tab
                      ? "text-primary-600 dark:text-primary-400 border-b-2 border-primary-500"
                      : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-3">
              {activeTab === "history" ? (
                <div className="space-y-1">
                  {userMessages.length === 0 ? (
                    <div className="text-center py-8">
                      <History className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-400 dark:text-gray-500 text-xs">
                        No conversations yet
                      </p>
                    </div>
                  ) : (
                    userMessages.slice().reverse().map((msg) => (
                      <div
                        key={msg.id}
                        className="px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                      >
                        <p className="text-sm text-gray-700 dark:text-gray-200 truncate">
                          {msg.text}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {formatTime(msg.timestamp)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-4 p-2">
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center mx-auto mb-3">
                      <Sparkles className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Monto AI</h3>
                    <p className="text-xs text-gray-400 mt-1">Version 1.0.0</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed text-center">
                    Monto is a child-safe AI companion designed for children aged 5–15. Powered by Groq Whisper and Qwen3-32B.
                  </p>
                  <div className="rounded-xl bg-primary-50 dark:bg-primary-900/20 p-3 text-xs text-primary-700 dark:text-primary-300">
                    <p className="font-semibold mb-1">🛡️ Child Safe</p>
                    <p>All responses are filtered and age-appropriate.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom actions */}
            <div className="p-3 border-t border-gray-200 dark:border-gray-800 space-y-1">
              <button
                onClick={() => { onOpenSettings(); onClose(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm text-gray-700 dark:text-gray-200"
              >
                <Settings className="w-4 h-4 text-gray-400" />
                Settings
              </button>
              <button
                onClick={onToggleDark}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm text-gray-700 dark:text-gray-200"
              >
                {darkMode ? (
                  <Sun className="w-4 h-4 text-yellow-400" />
                ) : (
                  <Moon className="w-4 h-4 text-gray-400" />
                )}
                {darkMode ? "Light Mode" : "Dark Mode"}
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
