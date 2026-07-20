"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight, MessageCircleQuestion } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { PageHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Input } from "@/components/ui/input";
import { loadPairing, type PairingData } from "@/lib/pairing-storage";
import { getQuestions, type Question } from "@/lib/api-client";
import { formatQuestionStamp } from "@/lib/utils";

export function QuestionsScreen() {
  // undefined = pairing not checked yet, null = checked and none saved
  const [pairing, setPairing] = useState<PairingData | null | undefined>(undefined);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setPairing(loadPairing());
  }, []);

  useEffect(() => {
    if (!pairing) return;
    let active = true;
    getQuestions(pairing)
      .then((data) => {
        if (active) setQuestions(data.questions);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pairing]);

  const filteredQuestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? questions.filter((item) => item.question.toLowerCase().includes(q)) : questions;
  }, [questions, search]);

  return (
    <PhoneShell>
      <PageHeader title="Questions Asked" />

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
        <div className="relative">
          <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search questions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl bg-muted border-0"
          />
        </div>

        {pairing === null ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">Pair with your child's Monto box to see questions.</p>
            <Link href="/call" className="text-xs text-primary font-semibold mt-2 inline-block">Pair now</Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {filteredQuestions.length === 0 && (
              <li className="text-sm text-muted-foreground py-6 text-center">
                {pairing === undefined ? "Loading…" : search ? "No matching questions." : "No questions yet."}
              </li>
            )}
            {filteredQuestions.map((q) => {
              const { date, time } = formatQuestionStamp(q.timestamp);
              return (
                <li key={q.id} className="flex items-start gap-3 p-3 rounded-2xl bg-card border shadow-card">
                  <div className="size-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <MessageCircleQuestion className="size-4 text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug">{q.question}</p>
                    {q.answer && (
                      <p className="text-xs text-muted-foreground mt-1 leading-snug">{q.answer}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-1">{date} • {time}</p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground mt-2" />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <BottomNav />
    </PhoneShell>
  );
}
