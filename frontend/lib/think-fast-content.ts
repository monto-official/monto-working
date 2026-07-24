// ── "Think Fast with Monto" — category word-recall game ──────────────────────
// A static word-list game (matches the Songs/Stories/Yoga/Freeze-Dance
// architecture — no LLM involved in gameplay): the child names N items of a
// category within a time limit; answers are checked against these lists, and
// a wrong answer that belongs to a DIFFERENT category gets a friendly
// "X is actually a Y" correction instead of a flat "wrong".

export type CategoryId =
  | "animals" | "fruits" | "colors" | "birds" | "seaAnimals"
  | "vegetables" | "insects" | "flowers"
  | "countries" | "bodyParts" | "professions";

export type Difficulty = "easy" | "medium" | "hard";

export type Category = {
  id: CategoryId;
  label: string;         // "animals" — used in prompts: "Tell me 3 animals!"
  singular: string;      // "an animal" is built from this + article()
  emoji: string;
  words: string[];       // accepted answers, lowercase singular
  // Known mix-ups that deserve a specific, teachable correction rather than
  // the generic "X is actually a Y" — e.g. a bat isn't filed under any other
  // game category, it's just a classic bird mix-up.
  traps?: Record<string, string>;
};

export const CATEGORIES: Record<CategoryId, Category> = {
  animals: {
    id: "animals", label: "animals", singular: "animal", emoji: "🦁",
    words: [
      "lion", "tiger", "dog", "cat", "elephant", "giraffe", "zebra", "monkey",
      "bear", "wolf", "fox", "deer", "rabbit", "horse", "cow", "goat", "sheep",
      "pig", "kangaroo", "panda", "camel", "donkey", "hippo", "hippopotamus",
      "rhino", "rhinoceros", "leopard", "cheetah", "squirrel", "mouse", "rat",
      "buffalo", "otter", "raccoon", "hedgehog", "koala", "gorilla", "chimpanzee",
    ],
    traps: {
      tomato: "Haha! Tomato is a fruit, not an animal. Let's try another animal!",
      carrot: "Carrot is a vegetable, not an animal. Try another animal!",
      bat: "Many people think a bat is just a flying creature, but it IS an animal — nice one! Let's keep going.",
    },
  },
  fruits: {
    id: "fruits", label: "fruits", singular: "fruit", emoji: "🍎",
    words: [
      "apple", "mango", "banana", "orange", "grape", "grapes", "watermelon",
      "pineapple", "strawberry", "papaya", "guava", "kiwi", "peach", "pear",
      "cherry", "lemon", "coconut", "plum", "fig", "lychee", "pomegranate",
      "blueberry", "raspberry", "melon", "apricot", "tomato",
    ],
    traps: {
      carrot: "Carrot is a vegetable. Can you think of another fruit?",
      potato: "Potato is a vegetable, not a fruit. Try another fruit!",
      onion: "Onion is a vegetable. Let's name another fruit!",
    },
  },
  colors: {
    id: "colors", label: "colors", singular: "color", emoji: "🌈",
    words: [
      "red", "blue", "green", "yellow", "orange", "purple", "pink", "black",
      "white", "brown", "gray", "grey", "gold", "silver", "cyan", "magenta",
      "maroon", "navy", "beige", "turquoise", "violet", "indigo", "teal",
    ],
  },
  birds: {
    id: "birds", label: "birds", singular: "bird", emoji: "🦅",
    words: [
      "eagle", "crow", "parrot", "pigeon", "sparrow", "owl", "peacock", "duck",
      "swan", "penguin", "ostrich", "hen", "chicken", "dove", "hawk", "flamingo",
      "woodpecker", "kingfisher", "vulture", "falcon", "cuckoo", "stork", "crane",
    ],
    traps: {
      bat: "Many people think a bat is a bird, but it's actually a mammal.",
      butterfly: "A butterfly is an insect, not a bird. Try another bird!",
    },
  },
  seaAnimals: {
    id: "seaAnimals", label: "sea animals", singular: "sea animal", emoji: "🐠",
    words: [
      "shark", "whale", "dolphin", "octopus", "jellyfish", "starfish",
      "seahorse", "crab", "lobster", "squid", "turtle", "clownfish", "stingray",
      "eel", "seal", "walrus", "orca", "sardine", "tuna", "prawn", "shrimp",
    ],
    traps: {
      crocodile: "Crocodiles usually live in rivers and swamps. Can you name another sea animal?",
      frog: "A frog lives in ponds, not the sea. Try another sea animal!",
      penguin: "Penguins are birds that swim! Let's find a proper sea animal.",
    },
  },
  vegetables: {
    id: "vegetables", label: "vegetables", singular: "vegetable", emoji: "🥕",
    words: [
      "carrot", "potato", "onion", "cabbage", "cauliflower", "spinach",
      "brinjal", "eggplant", "pumpkin", "cucumber", "peas", "beans", "radish",
      "broccoli", "garlic", "ginger", "corn", "beetroot", "lettuce", "okra",
      "capsicum", "pepper", "zucchini", "turnip",
    ],
    traps: {
      apple: "Apple is a fruit. Let's replace it with a vegetable.",
      mango: "Mango is a fruit, not a vegetable. Try another vegetable!",
      tomato: "Tomato actually counts as a fruit! Try another vegetable.",
    },
  },
  insects: {
    id: "insects", label: "insects", singular: "insect", emoji: "🐝",
    words: [
      "ant", "bee", "butterfly", "mosquito", "fly", "beetle", "grasshopper",
      "cockroach", "dragonfly", "ladybug", "moth", "cricket", "termite", "wasp",
      "firefly", "caterpillar", "locust",
    ],
    traps: {
      spider: "A spider is actually an arachnid, not an insect — close though!",
      worm: "A worm isn't an insect at all. Try another insect!",
    },
  },
  flowers: {
    id: "flowers", label: "flowers", singular: "flower", emoji: "🌸",
    words: [
      "rose", "lily", "sunflower", "tulip", "daisy", "orchid", "jasmine",
      "marigold", "lotus", "hibiscus", "daffodil", "carnation", "lavender",
      "poppy", "iris", "petunia", "dahlia", "magnolia",
    ],
  },
  countries: {
    id: "countries", label: "countries", singular: "country", emoji: "🌍",
    words: [
      "india", "nepal", "usa", "america", "china", "japan", "france", "germany",
      "brazil", "canada", "australia", "russia", "italy", "spain", "mexico",
      "england", "uk", "egypt", "korea", "thailand", "nigeria", "kenya",
      "indonesia", "bhutan", "pakistan", "bangladesh", "argentina", "greece",
      "portugal", "netherlands", "switzerland", "vietnam", "turkey", "sweden",
    ],
  },
  bodyParts: {
    id: "bodyParts", label: "body parts", singular: "body part", emoji: "🖐️",
    words: [
      "head", "hand", "leg", "arm", "eye", "ear", "nose", "mouth", "foot",
      "finger", "knee", "shoulder", "elbow", "chest", "back", "hair", "teeth",
      "tongue", "neck", "stomach", "chin", "cheek", "lip", "toe", "ankle",
      "wrist", "eyebrow", "forehead",
    ],
  },
  professions: {
    id: "professions", label: "professions", singular: "profession", emoji: "👩‍⚕️",
    words: [
      "doctor", "teacher", "engineer", "police", "farmer", "pilot", "nurse",
      "chef", "lawyer", "singer", "dancer", "driver", "scientist", "firefighter",
      "artist", "actor", "soldier", "plumber", "electrician", "dentist",
      "carpenter", "photographer", "journalist", "athlete", "musician",
    ],
  },
};

export const DIFFICULTY_CONFIG: Record<Difficulty, { count: number; seconds: number; categories: CategoryId[] }> = {
  easy:   { count: 3,  seconds: 15, categories: ["animals", "fruits", "colors", "birds", "seaAnimals"] },
  medium: { count: 5,  seconds: 20, categories: ["vegetables", "insects", "flowers"] },
  hard:   { count: 10, seconds: 30, categories: ["countries", "bodyParts", "professions"] },
};

export type AnswerResult = {
  word: string;
  status: "correct" | "duplicate" | "wrong";
  message?: string; // spoken correction for a wrong answer
};

// Reverse lookup: every accepted word across every category → the category
// it belongs to, used to generate "X is actually a Y" corrections.
const WORD_TO_CATEGORY: Map<string, CategoryId> = new Map();
for (const category of Object.values(CATEGORIES)) {
  for (const word of category.words) {
    if (!WORD_TO_CATEGORY.has(word)) WORD_TO_CATEGORY.set(word, category.id);
  }
}

function normalize(raw: string): string {
  const w = raw.toLowerCase().trim().replace(/[^a-z\s-]/g, "");
  if (w.length > 3 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 3 && w.endsWith("es") && !w.endsWith("ss")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** Splits a spoken transcript like "Lion, Tiger and Cat" into individual words. */
export function splitAnswers(transcript: string): string[] {
  return transcript
    .split(/,|\band\b|\n/gi)
    .map(s => s.trim())
    .filter(Boolean);
}

/** Scores a full transcript against one category, in the order spoken. */
export function evaluateAnswers(categoryId: CategoryId, transcript: string): AnswerResult[] {
  const category = CATEGORIES[categoryId];
  const accepted = new Set(category.words.map(normalize));
  const seen = new Set<string>();
  const results: AnswerResult[] = [];

  for (const raw of splitAnswers(transcript)) {
    const word = normalize(raw);
    if (!word) continue;

    if (accepted.has(word)) {
      if (seen.has(word)) {
        results.push({ word: raw.trim(), status: "duplicate" });
      } else {
        seen.add(word);
        results.push({ word: raw.trim(), status: "correct" });
      }
      continue;
    }

    const trapMessage = category.traps?.[word];
    if (trapMessage) {
      results.push({ word: raw.trim(), status: "wrong", message: trapMessage });
      continue;
    }

    const trueCategory = WORD_TO_CATEGORY.get(word);
    if (trueCategory && trueCategory !== categoryId) {
      const other = CATEGORIES[trueCategory];
      results.push({
        word: raw.trim(),
        status: "wrong",
        message: `${capitalize(raw.trim())} is actually ${article(other.label)} ${other.label.replace(/s$/, "")}, not ${article(category.label)} ${category.label.replace(/s$/, "")}. Let's try another!`,
      });
      continue;
    }

    results.push({
      word: raw.trim(),
      status: "wrong",
      message: `Hmm, I don't think ${raw.trim()} is ${article(category.label)} ${category.label.replace(/s$/, "")}. Can you think of another one?`,
    });
  }

  return results;
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
