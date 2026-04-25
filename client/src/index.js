import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { installAdminOrgInterceptor } from './utils/axiosAdminOrgInterceptor';

installAdminOrgInterceptor();

// react-data-grid v7 fires ResizeObserver to compute column widths. When
// it's nested in a CSS Grid column whose width depends on its children,
// the layout can ping-pong and the browser emits the harmless spec warning
// "ResizeObserver loop completed with undelivered notifications." CRA's
// + webpack-dev-server's overlays both promote that warning to a runtime
// error. Production builds are unaffected.
//
// Two-layer fix:
// 1. Wrap ResizeObserver so its callback runs inside requestAnimationFrame.
//    This breaks the synchronous loop the spec warns about, so the warning
//    is never emitted in the first place.
// 2. Capture-phase error listeners as a belt-and-braces against any
//    remaining stragglers (third-party libs that grab ResizeObserver early).
if (typeof window !== 'undefined') {
    if (typeof window.ResizeObserver === 'function') {
        const NativeResizeObserver = window.ResizeObserver;
        class PatchedResizeObserver extends NativeResizeObserver {
            constructor(callback) {
                let frame = 0;
                super((entries, observer) => {
                    if (frame) return;
                    frame = window.requestAnimationFrame(() => {
                        frame = 0;
                        try {
                            callback(entries, observer);
                        } catch (err) {
                            if (!/ResizeObserver loop/i.test(err?.message || '')) throw err;
                        }
                    });
                });
            }
        }
        window.ResizeObserver = PatchedResizeObserver;
    }

    const RESIZE_OBSERVER_ERR = /ResizeObserver loop/i;
    window.addEventListener('error', (e) => {
        if (e?.message && RESIZE_OBSERVER_ERR.test(e.message)) {
            e.stopImmediatePropagation();
            e.preventDefault();
        }
    }, true);
    window.addEventListener('unhandledrejection', (e) => {
        const msg = e?.reason?.message || '';
        if (RESIZE_OBSERVER_ERR.test(msg)) {
            e.stopImmediatePropagation();
            e.preventDefault();
        }
    }, true);
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
