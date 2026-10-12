/**
 * Firebase App Check for creating share links. The server refuses a creation
 * without a valid token (functions/src/index.ts verifies it).
 *
 * The Firebase SDK and reCAPTCHA Enterprise load only on the first token
 * request - that is, when someone presses Create link - so the editor, the
 * share pages and every visitor who never shares pay nothing for them.
 *
 * The config is public by design (it ships in this bundle), but comes from
 * build-time env rather than source: GitHub secret scanning flags the API key
 * pattern. The staging workflow reads it from repository Actions variables;
 * locally it lives in the gitignored `.env.local`.
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
};
const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;

/** False on a build without App Check config: Create link is then unavailable, not attempted. */
export function appCheckConfigured(): boolean {
  return Boolean(config.apiKey && config.appId && config.projectId && siteKey);
}

let tokenSource: Promise<() => Promise<string>> | null = null;

/** A current App Check token, or null if this browser could not get one. */
export async function getAppCheckToken(): Promise<string | null> {
  if (!appCheckConfigured()) return null;
  tokenSource ??= (async () => {
    const [{ initializeApp }, { initializeAppCheck, ReCaptchaEnterpriseProvider, getLimitedUseToken }] = await Promise.all([
      import('firebase/app'), import('firebase/app-check'),
    ]);
    const app = initializeApp({ apiKey: config.apiKey, appId: config.appId, projectId: config.projectId }, 'axe-sharing');
    // No background refresh: a token is only needed at the moment of creation.
    const appCheck = initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey!), isTokenAutoRefreshEnabled: false });
    // Limited-use: the server consumes each token, so a captured one cannot be replayed.
    return async () => (await getLimitedUseToken(appCheck)).token;
  })().catch((error: unknown) => {
    // A failed SDK load must not stick for the rest of the session. A failed
    // token request alone keeps the initialised app: initialising it again
    // under the same name would throw.
    tokenSource = null;
    throw error;
  });
  try {
    return await (await tokenSource)();
  } catch (error) {
    // The caller shows a fixed message; the cause (a blocked reCAPTCHA script,
    // an unregistered domain, throttling) is only diagnosable from here.
    console.warn('App Check token unavailable:', error);
    return null;
  }
}
