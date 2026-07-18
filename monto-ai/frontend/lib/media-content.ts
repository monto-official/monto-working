export interface Song {
  id: string;
  title: string;
  lang: "ne" | "hi" | "en";
  emoji: string;
  color: string;
  file: string;   // path under /songs/
}

export interface Story {
  id: string;
  title: string;
  lang: "ne" | "hi" | "en";
  emoji: string;
  color: string;
  file: string;   // path under /stories/
}

export const SONGS: Song[] = [
  { id: "s1",  title: "A Bata Anar (अ बट अनर)",                       lang: "ne", emoji: "🍎", color: "#EF4444", file: "A bata Anar  अ बट अनर  Nepali Rhymes for Children बल गत.mp3" },
  { id: "s2",  title: "Aitabar Bihanai (ऐतबर बिहनै)",                 lang: "ne", emoji: "🌅", color: "#F59E0B", file: "Aitabar Bihanai - Saata Baar Saatai Din  Balgeet  Lyrics_ Rambabu Subedi  Music_ Ramesh Shrestha.mp3" },
  { id: "s3",  title: "Aloo Kachaloo (आलू कचालू)",                     lang: "hi", emoji: "🥔", color: "#10B981", file: "Aloo Kachaloo Beta Kahan Gaye They  आल कचल  - Popular Hindi Song.mp3" },
  { id: "s4",  title: "Chi Musi Chi (चि मुसि चि)",                     lang: "ne", emoji: "🐭", color: "#8B5CF6", file: "Chi Musi Chi च मस च  Nepali Rhymes and Baby Songs.mp3" },
  { id: "s5",  title: "Johny Johny Yes Papa",                           lang: "en", emoji: "👶", color: "#EC4899", file: "Johny Johny Yes Papa.mp3" },
  { id: "s6",  title: "ABC Alphabet Phonics Song",                      lang: "en", emoji: "🔤", color: "#3B82F6", file: "Learn A to Z Alphabet   ABC Phonics Song, Letter Sounds & Nursery Rhymes   ABC Baby.mp3" },
  { id: "s7",  title: "Meow Meow Biralo (म्याउ म्याउ बिरालो)",         lang: "ne", emoji: "🐱", color: "#F97316", file: "Meow Meow Biralo  Myau Myau Biralo  Nepali Rhymes for Kids  बल गत  मयऊ मयऊ बरल.mp3" },
  { id: "s8",  title: "Nani Teri Morni (नानी तेरी मोरनी)",             lang: "hi", emoji: "🦚", color: "#06B6D4", file: "Nani Teri Morni  नन तर मरन  Nani Teri Morni Ko Mor Le Gaye  Hindi Rhyme By Jingle Toons.mp3" },
  { id: "s9",  title: "Tara Baji Lai Lai (तारा बाजी लै लै)",           lang: "ne", emoji: "⭐", color: "#FBBF24", file: "Tara Baji Lai Lai  तरबज लल  Playtime Song  Ribu Rhymes - Nepali Rhyme.mp3" },
  { id: "s10", title: "Twinkle Twinkle Little Star",                    lang: "en", emoji: "🌟", color: "#A78BFA", file: "Twinkle Twinkle Little Star  @CoComelon Nursery Rhymes & Kids Songs.mp3" },
  { id: "s11", title: "Aaha Tamatar Badi Mazedaar (आह टमाटर)",         lang: "hi", emoji: "🍅", color: "#EF4444", file: "आह टमटर बड मजदर  New Hindi Kids Song 2026  Aaha Tamatar Nursery Rhyme #lallupallurhymes.mp3" },
];

export interface YogaPose {
  id: string;
  name: string;
  sanskrit: string;
  emoji: string;
  color: string;
  instruction: string;
  durationSec: number; // how long this pose is held before auto-advancing
}

export const YOGA_POSES: YogaPose[] = [
  { id: "mountain",  name: "Mountain Pose",   sanskrit: "Tadasana",         emoji: "🏔️", color: "#38BDF8", instruction: "Stand tall, feet together, arms relaxed by your sides. Breathe deeply and feel strong like a mountain!", durationSec: 30 },
  { id: "tree",      name: "Tree Pose",       sanskrit: "Vrikshasana",      emoji: "🌳", color: "#22C55E", instruction: "Balance on one foot, press the other foot to your inner leg, and bring your palms together above your head.", durationSec: 30 },
  { id: "cat",       name: "Cat Pose",        sanskrit: "Marjaryasana",     emoji: "🐱", color: "#F97316", instruction: "On hands and knees, round your back up to the sky like a scared kitty. Tuck your chin to your chest.", durationSec: 30 },
  { id: "cow",       name: "Cow Pose",        sanskrit: "Bitilasana",       emoji: "🐄", color: "#FBBF24", instruction: "On hands and knees, let your belly sink down, lift your chest and tailbone up, and look gently forward.", durationSec: 30 },
  { id: "downdog",   name: "Downward Dog",    sanskrit: "Adho Mukha Svanasana", emoji: "🐶", color: "#A78BFA", instruction: "Push your hips up and back to make an upside-down V shape, like a happy puppy stretching.", durationSec: 30 },
  { id: "cobra",     name: "Cobra Pose",      sanskrit: "Bhujangasana",     emoji: "🐍", color: "#EF4444", instruction: "Lie on your tummy, place your hands under your shoulders, and gently lift your chest like a cobra rising up.", durationSec: 30 },
  { id: "butterfly", name: "Butterfly Pose",  sanskrit: "Baddha Konasana",  emoji: "🦋", color: "#EC4899", instruction: "Sit down, bring the soles of your feet together, and gently flap your knees like butterfly wings.", durationSec: 30 },
  { id: "childpose", name: "Child's Pose",    sanskrit: "Balasana",         emoji: "🧘", color: "#06B6D4", instruction: "Kneel down, sit back on your heels, and stretch your arms forward on the floor. Rest and breathe.", durationSec: 30 },
];

export const STORIES: Story[] = [
  { id: "st1",  title: "कमिला र फट्याङग्रा — Ant & Grasshopper", lang: "ne", emoji: "🐜", color: "#10B981", file: "कमल अन फटयडगर कथ Ant & Grasshopper - Story In Nepali  Nepali Fairy Tales  Nepali Cartoons.mp3" },
  { id: "st2",  title: "कमिला र परेवा — Ant and Pigeon",          lang: "ne", emoji: "🕊️", color: "#3B82F6", file: "कमल र परव  नपल कथ  Ant and Pigeon Moral Story  Nepali Story.mp3" },
  { id: "st3",  title: "तीन सानो सुँगुर — Three Little Pigs",    lang: "ne", emoji: "🐷", color: "#F97316", file: "तन सन सगर  Three Little Pigs in Nepali  Nepali Story  Nepali Fairy Tales.mp3" },
  { id: "st4",  title: "तरकारीहरूको रमाइलो कथा",                 lang: "ne", emoji: "🥦", color: "#22C55E", file: "तरकरहरक रमइल कथ.mp3" },
  { id: "st5",  title: "तिर्खाएको कागले — Thirsty Crow",         lang: "ne", emoji: "🐦", color: "#6366F1", file: "तरखएक कग  A Thirsty Crow  Moral Story  Cartoon Stories - Nepali.mp3" },
  { id: "st6",  title: "सात बाख्रा र जंगली भ्वाँसो",            lang: "ne", emoji: "🐐", color: "#84CC16", file: "सत बखर र जगल बवस ll नपल लक कथ ll Saat Bakhra Ra Jangali Bwaaso ll Nepali Folk Story ..mp3" },
  { id: "st7",  title: "सुनौलो अण्डा — Golden Egg",              lang: "ne", emoji: "🥚", color: "#FBBF24", file: "सनल अनड - Nepali Story  Nepali Fairy Tales  Nepali Cartoon  Moral Stories In Nepali.mp3" },
  { id: "st8",  title: "समयको पालना — Value of Time",            lang: "ne", emoji: "⏰", color: "#EC4899", file: "समयक पलन  नपल एनमसन बल कथसमयक सह परयग गरन बनल जवनम सफलत लयउछ.mp3" },
  { id: "st9",  title: "स्याल र अंगुर — Fox and Grapes",          lang: "ne", emoji: "🦊", color: "#A855F7", file: "सयल र अगर  नपल बल कथ  Nepali Stories for Kids.mp3" },
  { id: "st10", title: "होशियार बाँदर र मूर्ख गधा",             lang: "ne", emoji: "🐒", color: "#F59E0B", file: "हशयर बदर र मरख गह  Nepali Katha  Nepali Story  Nepali Horror story  Nepali Kahani.mp3" },
];
