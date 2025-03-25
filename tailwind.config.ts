import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "14px",
        md: "12px",
        sm: "10px"
      }
    }
  },
  plugins: [require("@tailwindcss/forms")]
};

export default config;


