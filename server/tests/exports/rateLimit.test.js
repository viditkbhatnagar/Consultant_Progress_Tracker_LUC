// Rate-limit spec — plan §13.9. Builds a tiny Express app, mounts the
// limiter against a stub handler, hammers it with supertest, and asserts
// the 6th request returns 429 with the canonical error envelope.

const express = require('express');
const request = require('supertest');
const { makeExportPivotLimiter } = require('../../middleware/exportRateLimit');

function makeApp(limiter) {
    const app = express();
    // No trust-proxy configured — supertest uses 127.0.0.1 so keying on
    // req.ip is deterministic across requests in this test.
    app.use(express.json());
    // Mock `protect` — set req.user so the keyGenerator picks up the
    // user-scoped path (matches the production order: protect → limiter).
    app.use((req, _res, next) => {
        req.user = { _id: { toString: () => 'test-user-1' }, role: 'admin' };
        next();
    });
    app.post('/api/exports/pivot', limiter, (req, res) => res.json({ success: true }));
    return app;
}

describe('Export rate limiter (5 req/min/user)', () => {
    test('first 5 requests pass; 6th returns 429 with the canonical message', async () => {
        const limiter = makeExportPivotLimiter();
        const app = makeApp(limiter);

        for (let i = 1; i <= 5; i++) {
            const res = await request(app).post('/api/exports/pivot').send({});
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        }
        const blocked = await request(app).post('/api/exports/pivot').send({});
        expect(blocked.status).toBe(429);
        expect(blocked.body).toMatchObject({
            success: false,
            message: expect.stringMatching(/limit is 5 per minute/i),
        });
    });

    test('the limiter scopes per user — a different `req.user._id` gets a fresh budget', async () => {
        const limiter = makeExportPivotLimiter();
        const app = express();
        app.use(express.json());
        let userId = 'alpha';
        app.use((req, _res, next) => {
            req.user = { _id: { toString: () => userId }, role: 'admin' };
            next();
        });
        app.post('/api/exports/pivot', limiter, (_req, res) => res.json({ success: true }));

        // Burn alpha's 5 requests + verify the 6th is blocked.
        for (let i = 1; i <= 5; i++) {
            const res = await request(app).post('/api/exports/pivot').send({});
            expect(res.status).toBe(200);
        }
        const blocked = await request(app).post('/api/exports/pivot').send({});
        expect(blocked.status).toBe(429);

        // Switch user — should be allowed.
        userId = 'bravo';
        const fresh = await request(app).post('/api/exports/pivot').send({});
        expect(fresh.status).toBe(200);
    });

    test('429 body uses the standard {success:false,message} envelope', async () => {
        const limiter = makeExportPivotLimiter({ max: 1 });
        const app = makeApp(limiter);
        await request(app).post('/api/exports/pivot').send({}); // burn budget
        const blocked = await request(app).post('/api/exports/pivot').send({});
        expect(blocked.status).toBe(429);
        expect(typeof blocked.body.success).toBe('boolean');
        expect(blocked.body.success).toBe(false);
        expect(typeof blocked.body.message).toBe('string');
    });
});
