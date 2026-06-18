import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#f8f5ec",
        foreground: "#102016",
        card: "#fffdf7",
        "card-foreground": "#102016",
        muted: "#eef1e6",
        "muted-foreground": "#607064",
        border: "#dfe5d8",
        input: "#dfe5d8",
        primary: "#17643b",
        "primary-foreground": "#fbfff8",
        secondary: "#e8f3df",
        "secondary-foreground": "#193b28",
        accent: "#d7ead3",
        "accent-foreground": "#173c29",
        destructive: "#a83d2f",
        "destructive-foreground": "#fff8f4",
      },
      boxShadow: {
        soft: "0 24px 70px rgba(24, 51, 32, 0.10)",
        lift: "0 34px 90px rgba(23, 100, 59, 0.16)",
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "Segoe UI", "sans-serif"],
        serif: ["IBM Plex Serif", "Georgia", "serif"],
      },
    },
  },
};

export default config;
