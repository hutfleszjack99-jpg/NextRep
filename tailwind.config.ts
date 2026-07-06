import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0B0C0E",
        card: "#17181C",
        line: "#26282E",
        dim: "#8A919E",
        accent: "#53DDE3",
        accent2: "#3DDC84",
        danger: "#FF5C5C"
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"]
      }
    }
  },
  plugins: []
};
export default config;
