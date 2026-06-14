---
name: iframe cookie sameSite
description: Why session/OIDC cookies must use sameSite none in the Replit preview iframe.
---

Session and OIDC cookies in this app must be set with `sameSite: "none"` and `secure: true` (not `sameSite: "lax"`).

**Why:** The app runs inside the Replit preview iframe, which is a cross-site context. `lax` cookies are not sent on the cross-site navigations/requests the auth flow relies on, causing an endless login loop (user logs in, lands back on login).

**How to apply:** Any place that sets auth cookies — both Replit-OIDC admin auth and the HR username/password auth — must use `sameSite:"none"` + `secure:true`. Look for the cookie-setting helpers in the api-server auth and hrAuth routes.
