import type { BedtimeStory } from "@/types";

// ── Bedtime story library ───────────────────────────────────────────────────
// Narrated in-browser via the Web Speech API (see hooks/useStoryPlayer.ts) —
// no audio files or network calls needed.

export const STORIES: BedtimeStory[] = [
  {
    id: "sleepy-star",
    title: "The Sleepy Little Star",
    blurb: "A tiny star who twinkles too brightly learns how to rest.",
    gradient: "from-indigo-500 to-purple-700",
    paragraphs: [
      "High above the sleeping town, a tiny star named Nima twinkled brighter than all the others. She loved to shine, and she never wanted to stop.",
      "\"Nima,\" whispered the Moon gently, \"even stars need to rest their light, or they burn out too soon.\"",
      "But Nima just twinkled harder, racing across the sky, chasing shooting stars and giggling at the clouds.",
      "By the time the sun began to rise, Nima felt her sparkle fading. She was too tired to twinkle at all.",
      "The Moon tucked her behind a soft grey cloud. \"Rest now, little one. Tomorrow night, you'll shine even brighter.\"",
      "Nima closed her tiny points of light and drifted into a warm, quiet sleep, dreaming of all the stories she would twinkle about tomorrow.",
      "And from that night on, Nima always rested when the Moon told her to — because the brightest stars are the ones who know when to sleep.",
    ],
  },
  {
    id: "sleepy-star-2",
    title: "The Whispering Forest",
    blurb: "A curious fox discovers why the forest goes quiet at night.",
    gradient: "from-emerald-500 to-teal-700",
    paragraphs: [
      "Deep in the Whispering Forest, a young fox named Bramble could never understand why the trees grew so quiet each night.",
      "\"Why does everyone stop talking?\" Bramble asked the old owl perched above him.",
      "The owl blinked slowly. \"The trees aren't quiet, little fox. They're humming a lullaby — you just have to listen softly.\"",
      "Bramble sat very still and closed his eyes. At first he heard nothing. Then, slowly, he heard the leaves rustling in a gentle rhythm, like a heartbeat.",
      "The wind hummed low through the branches, the crickets added a soft chirp, and somewhere a stream trickled a quiet, steady tune.",
      "Bramble yawned, curled his tail around his nose, and let the forest's lullaby carry him off to sleep, warm and safe beneath the old oak tree.",
      "From then on, every night, Bramble listened for the forest's whisper — and every night, it sang him gently to sleep.",
    ],
  },
  {
    id: "paper-boat",
    title: "The Little Paper Boat",
    blurb: "A paper boat sails a puddle and finds its way home by moonlight.",
    gradient: "from-sky-500 to-blue-700",
    paragraphs: [
      "After the rain, a small paper boat named Wren floated bravely into the biggest puddle she had ever seen.",
      "She sailed past floating leaves, around little pebble islands, and under a bridge made of two twigs.",
      "As the sky turned orange and then a deep, dreamy blue, Wren began to worry. \"How will I find my way home in the dark?\"",
      "Just then, the moon rose and laid a silver path across the water, glowing softly from edge to edge.",
      "Wren followed the moonlight, gliding gently along the silver trail, past sleepy ducks tucking their heads under their wings.",
      "At last, she drifted back to the garden step where she began, right as the stars came out to keep watch over the quiet night.",
      "Safe and still, Wren rested on the water, rocking softly, until sleep carried her off just like the moonlit tide.",
    ],
  },
  {
    id: "cloud-sheep",
    title: "The Sheep Who Counted Clouds",
    blurb: "A sheep who can't fall asleep decides to count clouds instead.",
    gradient: "from-rose-400 to-orange-500",
    paragraphs: [
      "Down on Featherfield Farm, a woolly sheep named Pippin simply could not fall asleep, no matter how many fences she jumped.",
      "\"Maybe I'm counting the wrong thing,\" Pippin thought, and she wandered out to the meadow to look up at the sky instead.",
      "One cloud drifted by shaped like a teapot. Two clouds floated past that looked like sleepy rabbits. Three clouds curled together like a soft grey blanket.",
      "Pippin counted the clouds slowly — one, two, three — feeling her eyelids grow heavier with every fluffy shape that passed overhead.",
      "By the time she reached ten clouds, her legs had folded beneath her in the soft grass, and her counting had turned into a quiet hum.",
      "The stars blinked on one by one, watching over Pippin as she drifted to sleep, still dreaming of clouds shaped like teapots and rabbits.",
      "And every night after that, whenever Pippin couldn't sleep, she counted clouds instead of fences — and it always worked.",
    ],
  },
  {
    id: "lighthouse-keeper",
    title: "The Lighthouse Keeper's Lullaby",
    blurb: "An old lighthouse keeper sings the ships and the sea to sleep.",
    gradient: "from-amber-500 to-pink-600",
    paragraphs: [
      "At the edge of a quiet harbor stood a tall lighthouse, and inside lived old Mr. Finch, who had kept its light burning for forty years.",
      "Every evening, as the fishing boats sailed home, Mr. Finch would light his lamp and hum a slow, gentle tune out over the water.",
      "\"Why do you sing to the sea?\" a young sailor once asked him.",
      "\"Because the sea gets restless, just like little ones do,\" Mr. Finch said with a smile. \"A soft song helps the waves lie down for the night.\"",
      "Sure enough, as his lullaby drifted out over the harbor, the waves grew smaller and slower, rocking gently like a cradle.",
      "The boats bobbed softly at their ropes, the gulls tucked their heads beneath their wings, and the whole harbor grew calm and still.",
      "High in his lighthouse, Mr. Finch dimmed his lamp to a warm, glowing gold and, humming softly still, closed his own eyes to sleep.",
    ],
  },
];

export function getStoryById(id: string): BedtimeStory | undefined {
  return STORIES.find((s) => s.id === id);
}
