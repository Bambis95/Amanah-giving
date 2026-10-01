import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { loadRuntimeConfig } from './lib/config.ts';

// After a new deployment, a tab opened earlier asks for page files that no longer exist:
// reload once to get the new version instead of showing a blank page
window.addEventListener('vite:preloadError', (event) => {
  try {
    if (sessionStorage.getItem('reloaded-for-update')) return;
    sessionStorage.setItem('reloaded-for-update', '1');
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

// Load runtime configuration before rendering the app
async function initializeApp() {
  try {
    await loadRuntimeConfig();
    console.log('Runtime configuration loaded successfully');
  } catch (error) {
    console.warn(
      'Failed to load runtime configuration, using defaults:',
      error
    );
  }

  // Render the app
  createRoot(document.getElementById('root')!).render(<App />);
}

// Initialize the app
initializeApp();
