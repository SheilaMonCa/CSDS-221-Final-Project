import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// The browser automatically logs 4xx responses to the console when they come
// from fetch — this can't be stopped with console.error patching because the
// browser's devtools do it natively. Wrapping window.fetch and re-constructing
// the response object breaks that native logging while keeping the response data
// intact so Supabase can still read the error body normally.
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const url = typeof args[0] === 'string' ? args[0] : args[0]?.url ?? '';
  const response = await originalFetch(...args);
  if (url.includes('supabase.co') && response.status >= 400 && response.status < 500) {
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }
  return response;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();