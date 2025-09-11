
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Add global error handler for better debugging
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
});

// Enable React strict mode for better debugging
const root = createRoot(document.getElementById("root")!);
root.render(<App />);
