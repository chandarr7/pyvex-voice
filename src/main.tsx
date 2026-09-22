import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Suppress benign browser ResizeObserver loop notification messages
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (
      event.message &&
      (event.message.includes('ResizeObserver loop completed with undelivered notifications') ||
        event.message.includes('ResizeObserver loop limit exceeded'))
    ) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  });
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
