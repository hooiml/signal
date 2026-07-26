# Private Research Sync

Signal's optional sync vault is a single-user continuity surface for a privately operated deployment. It is not a multi-user account or identity system.

Configure a cryptographically random `RESEARCH_SYNC_BEARER_SECRET` of at least 32 characters on the server. Do not commit or paste the real value into source, logs, screenshots, or support messages. The same token must be entered on each trusted device when checking, pushing, or pulling.

The browser encrypts the bounded research backup with the user's separate passphrase before `PUT /api/research/sync`. The server validates the AES-GCM envelope structure but cannot decrypt it. It stores one ciphertext snapshot for the default user. `GET /api/research/sync` returns that ciphertext only after bearer authorization and always uses `Cache-Control: no-store`.

Every push supplies the revision observed by the last check. A changed remote revision returns `409`; the user must check again and explicitly confirm replacement. A pull decrypts locally and enters the existing add-only import preview. Replacing matching local records still requires the normal separate acknowledgement.

Limitations:

- no multi-user authorization, account recovery, sharing, merge engine, or background auto-sync;
- losing the encryption passphrase makes the remote ciphertext unrecoverable;
- rotating the server bearer secret requires entering the new token on every trusted device;
- an XSS compromise in an already-open page could access mounted secrets, so the token and passphrase are never persisted and the application security boundary remains critical.
