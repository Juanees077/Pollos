import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        soil: {
          50:  "#f7f3ea",
          100: "#ebe1cf",
          200: "#d8c9ae",
          500: "#8b6b3f",
          700: "#524027",
          900: "#2b2418"
        },
        leaf: {
          50:  "#eff8ef",
          100: "#dcefd8",
          200: "#b8e0b2",
          500: "#438b4a",
          600: "#357040",
          700: "#2b6334",
          900: "#17371f"
        },
        ember: {
          100: "#fae8d4",
          400: "#d99145",
          500: "#bd6f28",
          800: "#7a3e10"
        },
        forest: {
          950: "#0f2318",
          900: "#142c1e",
          800: "#1a3826"
        }
      },
      fontFamily: {
        sans:    ["var(--font-body)", "Plus Jakarta Sans", "ui-sans-serif", "system-ui"],
        display: ["var(--font-display)", "Fraunces", "ui-serif", "Georgia"]
      },
      fontSize: {
        "2xs": ["11px", { lineHeight: "1.4", letterSpacing: "0.04em" }]
      },
      borderRadius: {
        DEFAULT: "10px",
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "18px"
      },
      boxShadow: {
        panel:  "0 1px 3px rgba(20,18,12,0.06), 0 8px 24px rgba(20,18,12,0.07), 0 24px 56px rgba(20,18,12,0.05)",
        card:   "0 1px 3px rgba(20,18,12,0.05), 0 4px 12px rgba(20,18,12,0.06)",
        button: "0 4px 14px rgba(43,99,52,0.32), 0 1px 3px rgba(43,99,52,0.2)",
        modal:  "0 20px 60px rgba(15,35,24,0.30), 0 4px 16px rgba(15,35,24,0.18)"
      },
      transitionTimingFunction: {
        "spring": "cubic-bezier(0.16, 1, 0.3, 1)"
      },
      backgroundImage: {
        "kpi-green":  "linear-gradient(135deg, #f0f8f0 0%, #e8f5e8 100%)",
        "kpi-soil":   "linear-gradient(135deg, #f7f3ea 0%, #ede8dc 100%)",
        "kpi-amber":  "linear-gradient(135deg, #fef8f0 0%, #fae8d4 100%)",
        "kpi-profit": "linear-gradient(135deg, #e8f5e8 0%, #dcefd8 100%)"
      }
    }
  },
  plugins: []
};

export default config;
