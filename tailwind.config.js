/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.ejs",
    "./public/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          main: "#4E342E",      // Coffee brown
          accent: "#C19A6B",    // Gold/latte tone
          light: "#FDF5E6",     // Cream background
        }
      },
      fontFamily: {
        playfair: ['"Playfair Display"', 'serif'],
        poppins: ['Poppins', 'sans-serif'],
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,0.05)",
        premium: "0 20px 60px rgba(0,0,0,0.1)",
      },
      borderRadius: {
        xl2: "1.5rem",
        xl3: "2rem",
        xl4: "2.5rem",
      }
    },
  },
  plugins: [],
};