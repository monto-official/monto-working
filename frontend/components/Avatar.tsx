"use client";
import { Character, Emotion } from "@/types";
import { Monto3DAvatar } from "@/components/Monto3DAvatar";
import { MessiAvatar } from "@/components/MessiAvatar";
import { Nani, type NaniExpression } from "@/components/characters/Nani";
import { Babu, type BabuExpression } from "@/components/characters/Babu";

interface AvatarProps {
  emotion: Emotion;
  character?: Character;
  size?: number;
}

export function Avatar({ emotion, character = "spiderman", size = 320 }: AvatarProps) {
  if (character === "messi") return <MessiAvatar emotion={emotion} size={size} />;

  const expression: NaniExpression & BabuExpression =
    emotion === "talking" ? "explaining" :
    emotion === "neutral" || emotion === "sad" ? "happy" : emotion;

  if (character === "nani") return <Nani expression={expression} size={size * 0.72} animate />;
  if (character === "babu") return <Babu expression={expression} size={size * 0.72} animate />;
  if (character === "nepali") return (
    <div className="flex items-end justify-center" style={{ width: size, height: size, gap: size * 0.01 }} aria-label="Nani and Babu, Nepali friends">
      <Nani expression={expression} size={size * 0.42} animate />
      <Babu expression={expression} size={size * 0.42} animate />
    </div>
  );
  return <Monto3DAvatar emotion={emotion} size={size} />;
}

