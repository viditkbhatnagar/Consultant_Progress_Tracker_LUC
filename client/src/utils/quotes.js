// Shared motivational quotes — used by the sidebars and the Consultant
// Performance leaderboard highlight band.
export const MOTIVATIONAL_QUOTES = [
    "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    "The only way to do great work is to love what you do.",
    "Believe you can and you're halfway there.",
    "The future belongs to those who believe in the beauty of their dreams.",
    "Don't watch the clock; do what it does. Keep going.",
    "The harder you work for something, the greater you'll feel when you achieve it.",
    "Success doesn't just find you. You have to go out and get it.",
    "Dream it. Wish it. Do it.",
    "Great things never come from comfort zones.",
    "Success is the sum of small efforts repeated day in and day out.",
    "Push yourself, because no one else is going to do it for you.",
    "The key to success is to focus on goals, not obstacles.",
    "Dream bigger. Do bigger.",
    "Wake up with determination. Go to bed with satisfaction.",
    "Do something today that your future self will thank you for.",
    "Little things make big days.",
    "It's going to be hard, but hard does not mean impossible.",
    "Don't stop when you're tired. Stop when you're done.",
    "Work hard in silence, let your success be the noise.",
    "The only impossible journey is the one you never begin.",
    "Opportunities don't happen, you create them.",
    "Your limitation—it's only your imagination.",
    "Sometimes later becomes never. Do it now.",
    "The expert in anything was once a beginner.",
    "If you're not willing to risk, you cannot grow.",
    "Success is what comes after you stop making excuses.",
    "Make each day your masterpiece.",
    "The difference between ordinary and extraordinary is that little extra.",
];

// Deterministic pick (no Math.random — keeps SSR/test stable). Rotate by
// passing an incrementing index.
export function quoteAt(index = 0) {
    return MOTIVATIONAL_QUOTES[index % MOTIVATIONAL_QUOTES.length];
}

export default MOTIVATIONAL_QUOTES;
