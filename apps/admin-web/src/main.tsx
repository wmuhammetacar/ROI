import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './app/auth-context';
import { BranchProvider } from './app/branch-context';
import { App } from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <BranchProvider>
          <App />
        </BranchProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
