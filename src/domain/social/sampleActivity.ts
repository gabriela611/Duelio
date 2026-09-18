export interface SampleProfile { name: string; address: string; initials: string; wins: number; duels: number; rank: number; elo: number }
export const sampleProfiles: SampleProfile[] = [
  { name: "Felipe", address: `0x${"11".repeat(20)}`, initials: "FE", wins: 300, duels: 380, rank: 12, elo: 1845 },
  { name: "Juana", address: `0x${"22".repeat(20)}`, initials: "JU", wins: 68, duels: 82, rank: 8, elo: 1890 },
  { name: "Jose", address: `0x${"33".repeat(20)}`, initials: "JO", wins: 420, duels: 470, rank: 1, elo: 1980 },
];
export const sampleActivity = [
  { id: "felipe-300", profile: sampleProfiles[0], kind: "milestones", eyebrow: "A little dedication. A big milestone.", title: "300 wins.\nStill hungry.", description: "Felipe just joined the 300-win club. Give your rival some love.", reactions: 24, theme: "lime" },
  { id: "juana-pepe", profile: sampleProfiles[1], kind: "duels", eyebrow: "Juana × Pepe", title: "A good rivalry\nnever gets old.", description: "Juana took the win against Pepe. The rematch? That's another story.", reactions: 18, theme: "lilac" },
  { id: "jose-first", profile: sampleProfiles[2], kind: "milestones", eyebrow: "A new name at the top", title: "Meet your\nnew number 1.", description: "Jose climbed to the top of the rankings. Who's coming for the crown?", reactions: 42, theme: "peach" },
] as const;
