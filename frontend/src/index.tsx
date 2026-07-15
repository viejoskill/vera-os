import React from 'react';
import ReactDOM from 'react-dom/client';
import { injectDesignTokens } from '@vera/design-tokens';
import './index.css';
import { VeraOS } from '@app/VeraOS';

injectDesignTokens();

const container = document.getElementById('root');
if (!container) throw new Error('Root container #root not found');

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <VeraOS />
  </React.StrictMode>,
);
