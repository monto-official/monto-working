/** Subset of the child app's story metadata (`frontend/lib/media-content.ts`)
 * needed to render the remote-control story picker — just the display
 * fields, no file paths, since playback itself happens on the child device. */
export interface Story {
  id: string;
  title: string;
  lang: "ne" | "hi" | "en";
  emoji: string;
  thumbnail?: string; // path under /stories/thumbs/ — not every story has one
}

export const STORIES: Story[] = [
  { id: "st1",  title: "कमिला र फट्याङग्रा — Ant & Grasshopper", lang: "ne", emoji: "🐜", thumbnail: "st1.png" },
  { id: "st2",  title: "कमिला र परेवा — Ant and Pigeon",          lang: "ne", emoji: "🕊️", thumbnail: "st2.png" },
  { id: "st3",  title: "तीन सानो सुँगुर — Three Little Pigs",    lang: "ne", emoji: "🐷", thumbnail: "st3.png" },
  { id: "st4",  title: "तरकारीहरूको रमाइलो कथा",                 lang: "ne", emoji: "🥦", thumbnail: "st4.png" },
  { id: "st5",  title: "तिर्खाएको कागले — Thirsty Crow",         lang: "ne", emoji: "🐦", thumbnail: "st5.png" },
  { id: "st6",  title: "सात बाख्रा र जंगली भ्वाँसो",            lang: "ne", emoji: "🐐", thumbnail: "st6.png" },
  { id: "st7",  title: "सुनौलो अण्डा — Golden Egg",              lang: "ne", emoji: "🥚", thumbnail: "st7.png" },
  { id: "st8",  title: "समयको पालना — Value of Time",            lang: "ne", emoji: "⏰", thumbnail: "st8.png" },
  { id: "st9",  title: "स्याल र अंगुर — Fox and Grapes",          lang: "ne", emoji: "🦊", thumbnail: "st9.png" },
  { id: "st10", title: "होशियार बाँदर र मूर्ख गधा",             lang: "ne", emoji: "🐒", thumbnail: "st10.png" },
];
