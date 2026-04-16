/**
 * App.tsx — Dev preview harness (dev-only, not a webpack entry in prod).
 *
 * Simulates Lens production behaviour:
 *  - Renders config panel + widget side by side
 *  - Wires config panel onChange → widget update()
 *  - All lifecycle calls go through window.ReactWidgets (same as prod)
 *
 * Auth:
 *  - Prod: Lens passes JWT as `authentication` prop
 *  - Dev:  Append ?token=<sso_token> to URL → stored in localStorage as bearer_token
 */
import React, { useState, useEffect, useRef } from 'react';
import './components/ProgressBar/index';              // triggers self-registration
import './components/ProgressBarConfiguration/index'; // triggers self-registration
import '@faclon-labs/design-sdk/styles.css';
import type { ProgressBarConfig } from './iosense-sdk/types';
import { validateSSOToken } from './iosense-sdk/api';

const WIDGET_ID = 'pb-widget-preview';
const CONFIG_ID = 'pb-config-preview';

export default function App() {
  const [config, setConfig] = useState<ProgressBarConfig | undefined>(undefined);
  const [authentication, setAuthentication] = useState<string>('');
  const [authReady, setAuthReady] = useState(false);

  const widgetMountedRef = useRef(false);
  const configMountedRef = useRef(false);

  // ── Resolve auth on startup ──────────────────────────────────────────────
  useEffect(() => {
    async function resolveAuth() {
      const urlParams = new URLSearchParams(window.location.search);
      const ssoToken = urlParams.get('token');

      if (ssoToken) {
        // Validate SSO token → receive JWT → store in localStorage
        const jwt = await validateSSOToken(ssoToken);
        if (jwt) {
          setAuthentication(jwt);
          setAuthReady(true);
          return;
        }
      }

      // Fallback: use JWT already stored in localStorage (from a previous session)
      const stored = localStorage.getItem('bearer_token');
      if (stored) {
        setAuthentication(stored);
        setAuthReady(true);
        return;
      }

      // No token found — show guidance
      setAuthReady(true);
    }

    resolveAuth();
  }, []);

  // ── Mount / update via window.ReactWidgets (mimics Lens lifecycle) ───────
  useEffect(() => {
    if (!authReady) return;

    const ReactWidgets = (window as any).ReactWidgets;

    const sharedConfigProps = {
      config,
      authentication,
      onChange: (updatedConfig: ProgressBarConfig) => {
        setConfig(updatedConfig);
      },
    };

    const sharedWidgetProps = {
      config,
      authentication,
    };

    if (!configMountedRef.current) {
      ReactWidgets?.ProgressBarConfiguration?.mount(CONFIG_ID, sharedConfigProps);
      configMountedRef.current = true;
    } else {
      ReactWidgets?.ProgressBarConfiguration?.update(CONFIG_ID, sharedConfigProps);
    }

    if (!widgetMountedRef.current) {
      ReactWidgets?.ProgressBar?.mount(WIDGET_ID, sharedWidgetProps);
      widgetMountedRef.current = true;
    } else {
      ReactWidgets?.ProgressBar?.update(WIDGET_ID, sharedWidgetProps);
    }
  }, [authReady, authentication, config]);

  // ── Cleanup on unmount
  useEffect(() => {
    return () => {
      (window as any).ReactWidgets?.ProgressBarConfiguration?.unmount(CONFIG_ID);
      (window as any).ReactWidgets?.ProgressBar?.unmount(WIDGET_ID);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (!authReady) {
    return (
      <div style={styles.centered}>
        <p style={styles.hint}>Initialising…</p>
      </div>
    );
  }

  if (!authentication) {
    return (
      <div style={styles.centered}>
        <h2 style={{ color: '#fff', marginBottom: 12 }}>ProgressBar Widget — Dev Preview</h2>
        <p style={styles.hint}>
          Append <code style={styles.code}>?token=&lt;sso_token&gt;</code> to the URL to authenticate.
        </p>
        <p style={styles.hint}>
          Or set <code style={styles.code}>bearer_token</code> in localStorage directly.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.shell}>
      {/* Config panel — 35% width */}
      <div style={styles.configPane}>
        <div id={CONFIG_ID} style={{ height: '100%' }} />
      </div>

      {/* Divider */}
      <div style={styles.divider} />

      {/* Widget preview — 65% width */}
      <div style={styles.widgetPane}>
        <div style={styles.widgetLabel}>Widget Preview</div>
        <div id={WIDGET_ID} style={{ width: '100%', height: 'calc(100% - 28px)' }} />
      </div>
    </div>
  );
}

// ─── Inline styles (dev harness only) ────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    background: '#121212',
    overflow: 'hidden',
  },
  configPane: {
    width: '35%',
    height: '100%',
    overflowY: 'auto',
    flexShrink: 0,
  },
  divider: {
    width: '1px',
    background: '#2a2a2a',
    flexShrink: 0,
  },
  widgetPane: {
    flex: 1,
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  widgetLabel: {
    color: '#666',
    fontSize: '11px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '8px',
  },
  centered: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: '#121212',
    gap: 12,
  },
  hint: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 500,
  },
  code: {
    background: '#2a2a2a',
    padding: '2px 6px',
    borderRadius: 4,
    fontFamily: 'monospace',
    color: '#7eb8f7',
  },
};
