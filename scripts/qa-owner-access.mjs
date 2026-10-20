// Live-server QA reads saved research through the owner access boundary. Set
// SIGNAL_QA_OWNER_SECRET to that server's OWNER_ACCESS_SECRET; it is sent only to the QA base URL.
const cookieName = 'signal_owner';
const sessions = new Map();

const ownerToken = (base) => {
    if (!sessions.has(base)) {
        sessions.set(base, (async () => {
            const secret = process.env.SIGNAL_QA_OWNER_SECRET;
            if (!secret) return null;
            const response = await fetch(`${base}/api/owner/session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret }),
            });
            if (!response.ok) throw new Error(`Owner unlock failed with ${response.status}.`);
            const match = (response.headers.get('set-cookie') ?? '').match(new RegExp(`${cookieName}=([^;]+)`));
            if (!match) throw new Error('Owner unlock returned no session cookie.');
            return match[1];
        })());
    }
    return sessions.get(base);
};

export const ownerHeaders = async (base) => {
    const token = await ownerToken(base);
    return token ? { cookie: `${cookieName}=${token}` } : {};
};

export const addOwnerCookie = async (context, base) => {
    const token = await ownerToken(base);
    if (token) await context.addCookies([{ name: cookieName, value: token, url: base, httpOnly: true, sameSite: 'Lax' }]);
};
