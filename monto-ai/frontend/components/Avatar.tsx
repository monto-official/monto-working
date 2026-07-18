"use client";
import { Character, Emotion } from "@/types";
import { SpidermanAvatar } from "@/components/SpidermanAvatar";
import { MessiAvatar } from "@/components/MessiAvatar";

interface AvatarProps {
  emotion: Emotion;
  character?: Character;
  size?: number;
}

export function Avatar({ emotion, character = "spiderman", size = 320 }: AvatarProps) {
  if (character === "messi") {
    return <MessiAvatar emotion={emotion} size={size} />;
  }
  return <SpidermanAvatar emotion={emotion} size={size} />;
}
