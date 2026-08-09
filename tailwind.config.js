/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'erp': {
          'bg': '#f8f9fb',
          'sidebar': '#1a1d29',
          'sidebar-hover': '#2a2d3d',
          'sidebar-active': '#3a3d55',
          'header': '#ffffff',
          'card': '#ffffff',
          'border': '#e2e8f0',
          'text': '#1e293b',
          'text-muted': '#64748b',
          'primary': '#2563eb',
          'primary-hover': '#1d4ed8',
          'success': '#16a34a',
          'danger': '#dc2626',
          'warning': '#f59e0b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        'table': '0.8125rem',
      },
    },
  },
  plugins: [],
};
