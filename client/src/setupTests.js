// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// react-data-grid uses ResizeObserver for sizing — jsdom doesn't ship one.
class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
}
if (typeof global.ResizeObserver === 'undefined') {
    global.ResizeObserver = ResizeObserverMock;
}

// file-saver indirectly touches URL.createObjectURL / revokeObjectURL.
// jsdom omits both — stub so download paths don't blow up in tests.
if (typeof global.URL.createObjectURL === 'undefined') {
    global.URL.createObjectURL = () => 'blob:mock-url';
}
if (typeof global.URL.revokeObjectURL === 'undefined') {
    global.URL.revokeObjectURL = () => {};
}
