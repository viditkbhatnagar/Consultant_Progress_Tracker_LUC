import axios from 'axios';
import { getAdminOrgScope } from './adminOrgScope';

// Global axios request interceptor: when the logged-in user is an admin,
// automatically append `organization=<scope>` to every GET request so LUC
// vs Skillhub bifurcation applies across every admin-accessible page
// (Student Database, Hourly Tracker, etc.) without per-page plumbing.
//
// Respected rules:
//   - Only applies to GET requests.
//   - Only applies when role === 'admin' (other roles are already scoped
//     server-side by their own organization).
//   - Does not overwrite an explicit `organization` param the caller already
//     set (e.g. the admin dashboard's LUC/Skillhub panel or the
//     AdminSkillhubView which pass organization explicitly).
let installed = false;
export const installAdminOrgInterceptor = () => {
    if (installed) return;
    installed = true;

    axios.interceptors.request.use((config) => {
        try {
            const method = (config.method || 'get').toLowerCase();
            if (method !== 'get') return config;

            const userStr = localStorage.getItem('user');
            if (!userStr) return config;

            const user = JSON.parse(userStr);
            if (!user || user.role !== 'admin') return config;

            // Don't clobber explicit params already set by callers.
            config.params = config.params || {};
            if (config.params.organization) return config;

            // Also check the URL — some callers append ?organization=...
            // as a query string directly.
            if (
                typeof config.url === 'string' &&
                /[?&]organization=/.test(config.url)
            ) {
                return config;
            }

            config.params.organization = getAdminOrgScope();
        } catch {
            // fail open — never block a request because the interceptor
            // threw
        }
        return config;
    });
};
