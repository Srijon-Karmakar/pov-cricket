// /** @type {import('tailwindcss').Config} */
// export default {
//   content: [],
//   theme: {
//     extend: {},
//   },
//   plugins: [],
// }




/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],

  darkMode: "class",

  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.25rem",
        lg: "1.5rem",
        xl: "2rem",
      },
      screens: {
        xl: "1280px",
        "2xl": "1440px",
      },
    },

    extend: {
      colors: {
        /* Base */
        bg: "#020617",          // slate-950 like
        surface: "#020617cc",
        glass: "rgba(255,255,255,0.06)",

        /* Accents */
        primary: "#22c55e",     // green (cricket vibe)
        accent: "#0ea5e9",      // cyan
        danger: "#ef4444",
        warning: "#f97316",

        /* Text */
        muted: "#94a3b8",
      },

      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },

      boxShadow: {
        glass:
          "0 20px 50px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
        glow:
          "0 0 0 1px rgba(255,255,255,0.08), 0 0 40px rgba(34,197,94,0.35)",
        hud:
          "0 10px 30px rgba(0,0,0,0.55)",
      },

      backdropBlur: {
        glass: "12px",
      },

      animation: {
        float: "float 4s ease-in-out infinite",
        pulseSoft: "pulseSoft 2.5s ease-in-out infinite",
      },

      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.85" },
          "50%": { opacity: "1" },
        },
      },
    },
  },

  plugins: [],
};
