// Exposes the eve HTTP channel. Accepts the username and password from ANALYST_USER and ANALYST_PASSWORD, plus Vercel OIDC and local development.
import { httpBasic, localDev, vercelOidc } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

export default eveChannel({
  auth: [
    ...(process.env.ANALYST_USER && process.env.ANALYST_PASSWORD
      ? [httpBasic({ username: process.env.ANALYST_USER, password: process.env.ANALYST_PASSWORD })]
      : []),
    vercelOidc(),
    localDev(),
  ],
});