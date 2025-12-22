export type SlideTheme = "indigo";

export type ContentPosition = "left" | "right";

export interface SlideData {
  id: number;
  theme: SlideTheme;
  background: string;
  /** Chapter label (e.g., "Chapter I") */
  chapter?: string;
  /** Title with \n for line breaks */
  title?: string;
  /** Bullet points - supports HTML for <strong>, <code> */
  bullets?: string[];
  /** Position of the content panel */
  contentPosition?: ContentPosition;
}

export const slides: SlideData[] = [
  {
    id: 1,
    theme: "indigo",
    background: "/thread/header.webp",
    // Title slide - no content panel
  },
  // {
  //   id: 2,
  //   theme: "indigo",
  //   background: "/thread/background1.jpg",
  //   chapter: "Chapter I",
  //   title: "The Async\nAdvantage",
  //   bullets: [
  //     "Offload cheat detection to <strong>cloud services</strong>. Zero impact on your server's TPS.",
  //     "Your Minecraft server captures relevant packets and sends them to external modules that analyze player behavior.",
  //     "AsyncAnticheat gives you enterprise-grade protection without compromising performance.",
  //   ],
  //   contentPosition: "right",
  // },
  // {
  //   id: 3,
  //   theme: "indigo",
  //   background: "/thread/background2.jpg",
  //   chapter: "Chapter II",
  //   title: "Battle-Tested\nDetection",
  //   bullets: [
  //     "<strong>Combat detection:</strong> aim assistance, killaura, autoclicker, reach violations.",
  //     "<strong>Movement detection:</strong> fly, speed, timer, no-fall, velocity abuse.",
  //     "<strong>Player detection:</strong> bad packets, scaffold, fast break/place.",
  //     "<strong>Two-tier system:</strong> Core checks for blatant cheats, Advanced for subtle patterns.",
  //   ],
  //   contentPosition: "left",
  // },
  // {
  //   id: 4,
  //   theme: "indigo",
  //   background: "/thread/background3.jpg",
  //   chapter: "Chapter III",
  //   title: "Modular\nArchitecture",
  //   bullets: [
  //     "Register <strong>external check modules</strong> that process packet data independently.",
  //     "Modules are HTTP services that receive packet batches and return findings—write them in any language.",
  //     "Lightweight, production-proven core running on real servers with minimal overhead.",
  //   ],
  //   contentPosition: "right",
  // },
  // {
  //   id: 5,
  //   theme: "indigo",
  //   background: "/thread/background4.jpg",
  //   chapter: "Chapter IV",
  //   title: "Real-Time\nMonitoring",
  //   bullets: [
  //     "<strong>Central dashboard</strong> visualizes threats across your entire network in real-time.",
  //     "Staff get instant alerts plus optional auto-bans and configurable commands when violations occur.",
  //     "In-game and console checks via simple commands for quick reviews.",
  //   ],
  //   contentPosition: "left",
  // },
  // {
  //   id: 6,
  //   theme: "indigo",
  //   background: "/thread/background5.jpg",
  //   chapter: "Chapter V",
  //   title: "Built For\nProduction",
  //   bullets: [
  //     "Supports <strong>Paper, Spigot, BungeeCord, and Velocity</strong> via PacketEvents.",
  //     "Fully <strong>open source</strong>—inspect the code, contribute improvements.",
  //     "If you want an anticheat that scales, performs, and evolves with your network, <strong>build on AsyncAnticheat</strong>.",
  //   ],
  //   contentPosition: "right",
  // },
];
