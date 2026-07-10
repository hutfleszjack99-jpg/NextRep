import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0C0D11",
        card: "#17181F",
        line: "#282A34",
        dim: "#8A8798",
        accent: "#C9C0F5",
        accentText: "#2A2264",
        accent2: "#3DDC84",
        danger: "#FF6B6B"
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"]
      }
    }
  },
  plugins: []
};
export default config;
