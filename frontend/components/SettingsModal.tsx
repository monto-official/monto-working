"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X, Globe, Volume2, Mic, Moon, Sun, Users } from "lucide-react";
import { Character, Settings } from "@/types";
import { cn } from "@/lib/utils";

interface SettingsModalProps {
  isOpen: boolean;
  settings: Settings;
  onClose: () => void;
  onChange: (s: Partial<Settings>) => void;
  noiseFloor?: number | null;
  calibrating?: boolean;
  onCalibrate?: () => void;
}

export function SettingsModal({
  isOpen,
  settings,
  onClose,
  onChange,
  noiseFloor,
  calibrating,
  onCalibrate,
}: SettingsModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Settings
                </h2>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Close settings"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="p-5 space-y-6">
                {/* Language */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="w-4 h-4 text-primary-500" />
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      Language
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["english", "nepali"] as const).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => onChange({ language: lang })}
                        className={cn(
                          "py-2.5 rounded-xl text-sm font-medium capitalize transition-all",
                          settings.language === lang
                            ? "bg-gradient-to-r from-primary-500 to-secondary-500 text-white shadow-md"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                        )}
                      >
                        {lang === "english" ? "🇺🇸 English" : "🇳🇵 Nepali"}
                      </button>
                    ))}
                  </div>
                </div>


                {/* AI friend */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-primary-500" />
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Choose your friend</label>
                  </div>
                  <select
                    value={settings.character}
                    onChange={(event) => onChange({ character: event.target.value as Character })}
                    className="w-full py-2.5 px-3 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700"
                    aria-label="Choose your AI friend"
                  >
                    <option value="spiderman">Spider-Man</option>
                    <option value="messi">Messi</option>
                    <option value="nani">Nani - नानी</option>
                    <option value="babu">Babu - बाबु</option>
                    <option value="nepali">Nepali Duo - नेपाली साथी</option>
                  </select>
                </div>

                {/* Voice */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Volume2 className="w-4 h-4 text-primary-500" />
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      Voice
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["male", "female"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => onChange({ voice: v })}
                        className={cn(
                          "py-2.5 rounded-xl text-sm font-medium capitalize transition-all",
                          settings.voice === v
                            ? "bg-gradient-to-r from-primary-500 to-secondary-500 text-white shadow-md"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                        )}
                      >
                        {v === "male" ? "👨 Male" : "👩 Female"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Auto Speak */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-primary-500" />
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        Auto Speak
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Speak responses automatically
                      </p>
                    </div>
                  </div>
                  <button
                    role="switch"
                    aria-checked={settings.autoSpeak}
                    onClick={() => onChange({ autoSpeak: !settings.autoSpeak })}
                    className={cn(
                      "relative w-11 h-6 rounded-full transition-colors focus:outline-none",
                      settings.autoSpeak
                        ? "bg-gradient-to-r from-primary-500 to-secondary-500"
                        : "bg-gray-200 dark:bg-gray-700"
                    )}
                  >
                    <motion.div
                      animate={{ x: settings.autoSpeak ? 20 : 2 }}
                      transition={{ type: "spring", damping: 20, stiffness: 300 }}
                      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                    />
                  </button>
                </div>

                {/* Mic calibration */}
                {onCalibrate && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Mic className="w-4 h-4 text-primary-500" />
                      <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        Background noise
                      </label>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                      Stay quiet for a second so Monto can learn this room&apos;s noise and filter it out while listening.
                    </p>
                    <button
                      onClick={onCalibrate}
                      disabled={calibrating}
                      className={cn(
                        "w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2",
                        calibrating
                          ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500"
                          : "bg-gradient-to-r from-primary-500 to-secondary-500 text-white shadow-md hover:opacity-90"
                      )}
                    >
                      {calibrating ? (
                        <>
                          <motion.span
                            className="w-2 h-2 rounded-full bg-current"
                            animate={{ opacity: [1, 0.2, 1] }}
                            transition={{ duration: 0.8, repeat: Infinity }}
                          />
                          Listening…
                        </>
                      ) : noiseFloor != null ? (
                        "Re-calibrate mic"
                      ) : (
                        "Calibrate mic"
                      )}
                    </button>
                    {!calibrating && noiseFloor != null && (
                      <p className="text-[11px] text-emerald-500 dark:text-emerald-400 font-medium mt-2">
                        ✓ Calibrated — background noise will be filtered out
                      </p>
                    )}
                  </div>
                )}

                {/* Dark Mode */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {settings.darkMode ? (
                      <Moon className="w-4 h-4 text-primary-500" />
                    ) : (
                      <Sun className="w-4 h-4 text-primary-500" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        Dark Mode
                      </p>
                    </div>
                  </div>
                  <button
                    role="switch"
                    aria-checked={settings.darkMode}
                    onClick={() => onChange({ darkMode: !settings.darkMode })}
                    className={cn(
                      "relative w-11 h-6 rounded-full transition-colors focus:outline-none",
                      settings.darkMode
                        ? "bg-gradient-to-r from-primary-500 to-secondary-500"
                        : "bg-gray-200 dark:bg-gray-700"
                    )}
                  >
                    <motion.div
                      animate={{ x: settings.darkMode ? 20 : 2 }}
                      transition={{ type: "spring", damping: 20, stiffness: 300 }}
                      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                    />
                  </button>
                </div>
              </div>

              <div className="px-5 pb-5">
                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-primary-500 to-secondary-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  Save & Close
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
