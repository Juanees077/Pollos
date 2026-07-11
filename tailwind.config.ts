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
        /* Neutral slate — text, borders, surfaces */
        soil: {
          50:  "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a"
        },
        /* Primary brand — corporate blue */
        leaf: {
          50:  "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          900: "#1e3a8a"
        },
        /* Accent green — reserved for KPIs / success states */
        mint: {
          50:  "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          500: "#16a34a",
          600: "#15803d",
          700: "#166534",
          900: "#14532d"
        },
        ember: {
          100: "#fef3c7",
          400: "#f59e0b",
          500: "#d97706",
          800: "#78350f"
        },
        /* Dark navy — sidebar & dark panels */
        forest: {
          950: "#0b1220",
          900: "#111827",
          800: "#1e293b"
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
        button: "0 4px 14px rgba(37,99,235,0.32), 0 1px 3px rgba(37,99,235,0.2)",
        modal:  "0 20px 60px rgba(11,18,32,0.30), 0 4px 16px rgba(11,18,32,0.18)"
      },
      transitionTimingFunction: {
        "spring": "cubic-bezier(0.16, 1, 0.3, 1)"
      },
      backgroundImage: {
        "kpi-green":  "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
        "kpi-soil":   "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
        "kpi-amber":  "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
        "kpi-profit": "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)"
      }
    }
  },
  plugins: []
};

export default config;
