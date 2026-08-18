import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import App from './App.tsx';
import './index.css';

// Initialize GoogleAuth native plugin safely on Native platforms only
if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
  try {
    const initPromise = GoogleAuth.initialize({
      clientId: '890842275987-ukel5gkqsojkuk24n5kbikjau8hqpr1j.apps.googleusercontent.com',
      scopes: ['profile', 'email'],
      grantOfflineAccess: true,
    });
    if (initPromise && typeof (initPromise as any).catch === 'function') {
      (initPromise as any).catch((err: any) => console.warn('GoogleAuth init notice:', err));
    }
  } catch (e) {
    console.warn('GoogleAuth early initialize notice:', e);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
