import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { ProgressBar } from './ProgressBar';

const roots = new Map<string, Root>();

function mount(containerId: string, props: any) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Required by Lens — must be set before createRoot
  container.setAttribute('data-zone-ignore', '');

  if (roots.has(containerId)) {
    roots.get(containerId)!.unmount();
    roots.delete(containerId);
  }

  const root = createRoot(container);
  roots.set(containerId, root);
  root.render(React.createElement(ProgressBar, props));
}

function update(containerId: string, props: any) {
  const root = roots.get(containerId);
  if (!root) return;
  root.render(React.createElement(ProgressBar, props));
}

function unmount(containerId: string) {
  const root = roots.get(containerId);
  if (!root) return;
  root.unmount();
  roots.delete(containerId);
}

(window as any).ReactWidgets = (window as any).ReactWidgets ?? {};
(window as any).ReactWidgets['ProgressBar'] = { mount, update, unmount };
