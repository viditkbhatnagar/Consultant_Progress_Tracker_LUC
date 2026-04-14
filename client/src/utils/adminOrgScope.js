import { useState, useEffect } from 'react';

const STORAGE_KEY = 'adminOrgScope';
const EVENT = 'adminOrgScopeChange';

// Returns the currently selected admin org scope. Defaults to 'luc'.
// Only meaningful when the logged-in user is an admin.
export const getAdminOrgScope = () => {
    return localStorage.getItem(STORAGE_KEY) || 'luc';
};

export const setAdminOrgScope = (org) => {
    if (org) {
        localStorage.setItem(STORAGE_KEY, org);
    } else {
        localStorage.removeItem(STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: org || 'luc' }));
};

// React hook: returns [currentScope, setScope]. Re-renders whenever the
// scope changes (including across browser tabs — listens to storage event).
export const useAdminOrgScope = () => {
    const [org, setOrg] = useState(getAdminOrgScope());

    useEffect(() => {
        const onCustom = (e) => setOrg(e.detail || getAdminOrgScope());
        const onStorage = (e) => {
            if (e.key === STORAGE_KEY) setOrg(getAdminOrgScope());
        };
        window.addEventListener(EVENT, onCustom);
        window.addEventListener('storage', onStorage);
        return () => {
            window.removeEventListener(EVENT, onCustom);
            window.removeEventListener('storage', onStorage);
        };
    }, []);

    return [org, setAdminOrgScope];
};
