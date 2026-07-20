/** Subset of the child app's song metadata (`frontend/lib/media-content.ts`)
 * needed to render the remote-control song picker — just the display fields,
 * no file paths, since playback itself happens on the child device. */
export interface Song {
  id: string;
  title: string;
  lang: "ne" | "hi" | "en";
  emoji: string;
  thumbnail?: string; // path under /songs/thumbs/ — not every song has one
}

export const SONGS: Song[] = [
  { id: "s1", title: "A Bata Anar (अ बट अनर)", lang: "ne", emoji: "🍎", thumbnail: "s1.png" },
  { id: "s2", title: "Aitabar Bihanai (ऐतबर बिहनै)", lang: "ne", emoji: "🌅", thumbnail: "s2.png" },
  { id: "s3", title: "Aloo Kachaloo (आलू कचालू)", lang: "hi", emoji: "🥔", thumbnail: "s3.png" },
  { id: "s4", title: "Chi Musi Chi (चि मुसि चि)", lang: "ne", emoji: "🐭", thumbnail: "s4.png" },
  { id: "s5", title: "Johny Johny Yes Papa", lang: "en", emoji: "👶", thumbnail: "s5.png" },
  { id: "s6", title: "ABC Alphabet Phonics Song", lang: "en", emoji: "🔤", thumbnail: "s6.png" },
  { id: "s7", title: "Meow Meow Biralo (म्याउ म्याउ बिरालो)", lang: "ne", emoji: "🐱", thumbnail: "s7.png" },
  { id: "s8", title: "Nani Teri Morni (नानी तेरी मोरनी)", lang: "hi", emoji: "🦚", thumbnail: "s8.png" },
  { id: "s9", title: "Tara Baji Lai Lai (तारा बाजी लै लै)", lang: "ne", emoji: "⭐", thumbnail: "s9.png" },
  { id: "s10", title: "Twinkle Twinkle Little Star", lang: "en", emoji: "🌟", thumbnail: "s10.png" },
  { id: "s11", title: "Aaha Tamatar Badi Mazedaar (आह टमाटर)", lang: "hi", emoji: "🍅", thumbnail: "s11.jpg" },
];
