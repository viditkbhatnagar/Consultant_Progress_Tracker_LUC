// Ambient context for the "Ask me" chat drawer. Components that know
// what the user is looking at (most commonly a Student detail drawer)
// call setAskMeContext({ studentId }) while mounted and setAskMeContext(null)
// on unmount / close. The chat panel reads the current value at send time
// to auto-scope docs-chat queries by program.
//
// Kept deliberately tiny so it doesn't need a React Context — a single
// mutable ref is plenty for one active detail drawer at a time.

let current = null;

export const setAskMeContext = (ctx) => {
    current = ctx || null;
};

export const getAskMeContext = () => current;

export const clearAskMeContext = () => {
    current = null;
};
