import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#f7fbf7",
        foreground: "#0f1f14",
        card: "#ffffff",
        "card-foreground": "#0f1f14",
        muted: "#eef5ef",
        "muted-foreground": "#5d6e62",
        border: "#dce9de",
        input: "#dce9de",
        primary: "#1e7a46",
        "primary-foreground": "#f8fff9",
        secondary: "#edf7ef",
        "secondary-foreground": "#19452b",
        accent: "#d9f0df",
        "accent-foreground": "#1c5e36",
        destructive: "#b33a2b",
        "destructive-foreground": "#fff9f7",
      },
      boxShadow: {
        soft: "0 24px 60px rgba(26, 60, 37, 0.08)",
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "Segoe UI", "sans-serif"],
        serif: ["IBM Plex Serif", "Georgia", "serif"],
      },
    },
  },
};

export default config;
