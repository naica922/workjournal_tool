import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { sendVerificationCodeEmail } from "@/lib/mail";

const googleEnabled =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

// Email verification only works when an SMTP server is configured; without
// one, sign-ups stay usable instead of locking everyone out.
const mailConfigured = !!process.env.SMTP_HOST;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: mailConfigured,
  },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : undefined,
  user: {
    additionalFields: {
      // A host role grants nothing by itself: hosts only ever see calendars
      // of apprentices that explicitly invited them.
      role: {
        type: "string",
        defaultValue: "apprentice",
        input: true,
      },
      firstName: { type: "string", required: false, input: true },
      lastName: { type: "string", required: false, input: true },
      // Dates as YYYY-MM-DD strings (matching the date columns)
      birthday: { type: "string", required: false, input: true },
      apprenticeshipStart: { type: "string", required: false, input: true },
    },
  },
  plugins: [
    emailOTP({
      sendVerificationOnSignUp: mailConfigured,
      overrideDefaultEmailVerification: true,
      async sendVerificationOTP({ email, otp }) {
        await sendVerificationCodeEmail({ to: email, otp });
      },
    }),
    nextCookies(),
  ],
});

export { googleEnabled };
