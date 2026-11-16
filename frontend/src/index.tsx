import React from 'react';
import ReactDOM from 'react-dom/client';
import { injectDesignTokens } from '@vera/design-tokens';
import './index.css';
import { VeraOS } from '@app/VeraOS';
import { ErrorBoundary } from '@app/ErrorBoundary';
import { installFetchInterceptor } from '@app/auth/fetch-interceptor';

injectDesignTokens();
installFetchInterceptor();

const container = document.getElementById('root');
if (!container) throw new Error('Root container #root not found');

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      <VeraOS />
    </ErrorBoundary>
  </React.StrictMode>,
);
