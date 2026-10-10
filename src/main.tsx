import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept lightweight-charts unmount/paint disposal errors gracefully
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event?.message && (event.message.includes('Object is disposed') || event.message.includes('DevicePixelContentBoxBinding'))) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
  window.addEventListener('unhandledrejection', (event) => {
    if (event?.reason && String(event.reason).includes('Object is disposed')) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);

