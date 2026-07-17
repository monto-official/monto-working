export interface Song {
  id: string;
  title: string;
  artist: string;
  duration: string;
  emoji: string;
  color: string;
  url: string;   // free-to-use audio URL
}

export interface Story {
  id: string;
  title: string;
  description: string;
  duration: string;
  emoji: string;
  color: string;
  url: string;
}

// Free kids songs from archive.org / public domain
export const SONGS: Song[] = [
  { id: "s1", title: "Twinkle Twinkle Little Star", artist: "Classic Nursery", duration: "1:45", emoji: "⭐", color: "#FBBF24", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { id: "s2", title: "Old MacDonald Had a Farm",   artist: "Classic Nursery", duration: "2:10", emoji: "🐄", color: "#34D399", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
  { id: "s3", title: "Wheels on the Bus",           artist: "Classic Nursery", duration: "2:05", emoji: "🚌", color: "#60A5FA", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
  { id: "s4", title: "If You're Happy and You Know", artist: "Classic Nursery", duration: "1:55", emoji: "😊", color: "#F472B6", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" },
  { id: "s5", title: "Row Row Row Your Boat",        artist: "Classic Nursery", duration: "1:30", emoji: "⛵", color: "#A78BFA", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3" },
  { id: "s6", title: "Head Shoulders Knees & Toes",  artist: "Classic Nursery", duration: "1:40", emoji: "🕺", color: "#FB923C", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3" },
  { id: "s7", title: "Baa Baa Black Sheep",          artist: "Classic Nursery", duration: "1:20", emoji: "🐑", color: "#6EE7B7", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3" },
  { id: "s8", title: "Itsy Bitsy Spider",            artist: "Classic Nursery", duration: "1:35", emoji: "🕷️", color: "#FCA5A5", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3" },
];

// Stories — text read by browser TTS (no audio file needed)
export const STORIES: Story[] = [
  {
    id: "st1", title: "The Brave Little Tortoise", description: "A slow but determined tortoise learns that patience and courage always win.", duration: "3 min", emoji: "🐢", color: "#34D399",
    url: "Once upon a time, in a beautiful forest, there lived a little tortoise named Tommy. All the other animals could run fast, but Tommy was very slow. One day, a rabbit challenged Tommy to a race. Everyone laughed, but Tommy said yes with a big smile. The race began! The rabbit ran so fast that he decided to take a nap under a shady tree. Tommy kept walking... slowly... steadily... never giving up. When Tommy finally crossed the finish line, the rabbit was still sleeping! Tommy had won! Everyone cheered. Tommy smiled and said: 'Slow and steady wins the race!' The end.",
  },
  {
    id: "st2", title: "The Magic Paintbrush", description: "A kind girl discovers a magical paintbrush that brings her drawings to life.", duration: "4 min", emoji: "🎨", color: "#F472B6",
    url: "There was once a girl named Lily who loved to paint. One day, she found a golden paintbrush in the forest. She painted a butterfly — and it flew right off the paper! She painted flowers, and they grew in her garden. She used her magic brush to help everyone in her village. She painted food for the hungry, warm blankets for the cold, and toys for children who had none. The whole village bloomed with color and happiness. Lily learned that the greatest magic is kindness. The end.",
  },
  {
    id: "st3", title: "The Cloud Who Was Afraid of Rain", description: "A little cloud discovers that his greatest fear is actually his greatest gift.", duration: "3 min", emoji: "⛅", color: "#60A5FA",
    url: "High above the world, a little cloud named Cloudy was afraid of something — rain. All the other clouds loved to make rain, but whenever Cloudy tried, he cried instead. One hot summer day, all the flowers and trees were very thirsty. They looked up at the sky and asked for rain. Cloudy was scared, but he loved the flowers. He took a deep breath... and cried big, beautiful raindrops. The flowers bloomed, the trees clapped their leaves, and all the animals danced. Cloudy realized his tears were a gift! From that day on, Cloudy was the happiest cloud of all. The end.",
  },
  {
    id: "st4", title: "The Friendly Dragon", description: "Everyone is afraid of the dragon, until they discover he just wants a friend.", duration: "4 min", emoji: "🐉", color: "#FBBF24",
    url: "In a kingdom far away, lived a big purple dragon named Drago. People were scared of him, so he lived alone in a cave. Every night, Drago would look at the village lights and wish he had a friend. One day, a little girl named Mia wandered near his cave. She wasn't scared — she was curious. 'Hello!' she said. Drago was so surprised that he almost fell over. They talked all day. Drago was funny, kind, and loved telling jokes. Soon, Mia brought her friends. Then the whole village came. They discovered that Drago's fire breath was perfect for baking cookies! The best friends are sometimes the most unexpected ones. The end.",
  },
  {
    id: "st5", title: "The Star Who Couldn't Shine", description: "A small star learns that everyone has their own special kind of light.", duration: "3 min", emoji: "✨", color: "#A78BFA",
    url: "Up in the night sky, all the stars shone brightly — except one little star named Pip. Pip tried and tried, but could only make a tiny flicker. The other stars were much brighter. Pip felt sad. But one stormy night, all the big stars were covered by clouds. Only Pip's tiny light peeked through. A little boy lost in the forest looked up and saw Pip's flicker. He followed it all the way home safely. When the storm cleared, all the stars asked: 'How did you do that?' Pip smiled. Even the smallest light can guide someone home. The end.",
  },
  {
    id: "st6", title: "The Elephant Who Forgot", description: "Ellie the elephant forgets everything — until her heart remembers what matters.", duration: "4 min", emoji: "🐘", color: "#FB923C",
    url: "Everyone knows elephants never forget — except Ellie. She forgot where she put her trunk (it was on her face!), forgot breakfast (her tummy reminded her!), and forgot her friend's birthday. She felt terrible. She picked flowers and baked a cake — even though she forgot how many eggs to add. Her friend Ben opened the door and saw the lopsided cake. He burst out laughing, then hugged Ellie tight. 'You forgot my birthday,' said Ben, 'but you still came.' Ellie realized she might forget small things, but she never forgot the people she loved. And that was the most important thing of all. The end.",
  },
];
