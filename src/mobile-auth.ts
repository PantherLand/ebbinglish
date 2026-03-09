import { createHash, randomBytes } from "crypto";
import { encode } from "@auth/core/jwt";
import { OAuth2Client, type TokenPayload } from "google-auth-library";
import { prisma } from "@/src/prisma";

const MOBILE_API_TOKEN_LABEL = "iOS App";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const googleClient = new OAuth2Client();

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function requireAuthSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }
  return secret;
}

function getAuthUrl(): URL {
  const raw =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000";

  try {
    return new URL(raw);
  } catch {
    return new URL("http://localhost:3000");
  }
}

export function getSessionCookieConfig() {
  const authUrl = getAuthUrl();
  const secure = authUrl.protocol === "https:";
  const cookieName = secure ? "__Secure-authjs.session-token" : "authjs.session-token";

  return {
    cookieName,
    secure,
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

function getGoogleAudiences(): string[] {
  return [
    process.env.GOOGLE_CLIENT_ID?.trim(),
    process.env.GOOGLE_IOS_CLIENT_ID?.trim(),
  ].filter((value): value is string => Boolean(value));
}

export async function verifyGoogleMobileIdToken(idToken: string): Promise<TokenPayload> {
  const audiences = getGoogleAudiences();
  if (audiences.length === 0) {
    throw new Error("Google OAuth audiences are not configured");
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: audiences,
  });

  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email) {
    throw new Error("Google token payload is missing required fields");
  }

  if (payload.email_verified === false) {
    throw new Error("Google account email is not verified");
  }

  return payload;
}

export async function issueMobileAuthSession(payload: TokenPayload, idToken?: string) {
  const normalizedEmail = payload.email!.toLowerCase();
  const googleSubject = payload.sub!;

  const user = await prisma.$transaction(async (tx) => {
    const existingAccount = await tx.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: googleSubject,
        },
      },
      include: { user: true },
    });

    if (existingAccount) {
      return tx.user.update({
        where: { id: existingAccount.userId },
        data: {
          email: normalizedEmail,
          name: payload.name ?? existingAccount.user.name,
          image: payload.picture ?? existingAccount.user.image,
          emailVerified:
            payload.email_verified === false
              ? existingAccount.user.emailVerified
              : existingAccount.user.emailVerified ?? new Date(),
        },
      });
    }

    const existingUser = await tx.user.findUnique({
      where: { email: normalizedEmail },
    });

    const userRecord =
      existingUser ??
      (await tx.user.create({
        data: {
          email: normalizedEmail,
          name: payload.name ?? normalizedEmail.split("@")[0],
          image: payload.picture,
          emailVerified: payload.email_verified === false ? null : new Date(),
        },
      }));

    await tx.account.create({
      data: {
        userId: userRecord.id,
        type: "oauth",
        provider: "google",
        providerAccountId: googleSubject,
        id_token: idToken,
        scope: "openid email profile",
      },
    });

    return userRecord;
  });

  const rawApiToken = `ebl_ios_${randomBytes(32).toString("hex")}`;
  const tokenHash = hashToken(rawApiToken);

  await prisma.$transaction([
    prisma.apiToken.deleteMany({
      where: {
        userId: user.id,
        label: MOBILE_API_TOKEN_LABEL,
      },
    }),
    prisma.apiToken.create({
      data: {
        userId: user.id,
        tokenHash,
        label: MOBILE_API_TOKEN_LABEL,
      },
    }),
  ]);

  const { cookieName, secure, maxAge } = getSessionCookieConfig();
  const expiresAt = new Date(Date.now() + maxAge * 1000);
  const sessionToken = await encode({
    secret: requireAuthSecret(),
    salt: cookieName,
    maxAge,
    token: {
      sub: user.id,
      email: user.email,
      name: user.name,
      picture: user.image,
    },
  });

  return {
    apiToken: rawApiToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    },
    webSession: {
      cookieName,
      cookieValue: sessionToken,
      expiresAt: expiresAt.toISOString(),
      secure,
    },
  };
}

export async function revokeMobileApiToken(rawApiToken: string) {
  const deleted = await prisma.apiToken.deleteMany({
    where: {
      tokenHash: hashToken(rawApiToken),
      label: MOBILE_API_TOKEN_LABEL,
    },
  });

  return deleted.count > 0;
}
