/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#2FE070',
          greendeep: '#17C75F',
          ink: '#0B0C0A',
          yellow: '#F6E94E',
          cream: '#F5F6F1'
        }
      },
      fontFamily: {
        display: ['"Archivo Black"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif']
      },
      boxShadow: {
        pop: '4px 4px 0px 0px rgba(11,12,10,1)',
        popsm: '2px 2px 0px 0px rgba(11,12,10,1)'
      },
      backgroundImage: {
        grid: 'linear-gradient(rgba(11,12,10,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(11,12,10,0.08) 1px, transparent 1px)'
      },
      backgroundSize: {
        grid: '40px 40px'
      }
    }
  },
  plugins: []
}
