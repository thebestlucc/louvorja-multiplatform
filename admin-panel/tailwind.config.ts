// Tailwind v4: configuration is handled via @theme in globals.css
// This file is kept for tooling compatibility only.
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
};
export default config;
