import NextAuth, { NextAuthOptions } from "next-auth";
import KeycloakProvider from "next-auth/providers/keycloak";
import { prisma } from "@/lib/prisma";
import { verifyDeviceWithFleet } from "@/server/services/fleet-dm.service";

export const authOptions: NextAuthOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_ID || "",
      clientSecret: process.env.KEYCLOAK_SECRET || "",
      issuer: process.env.KEYCLOAK_ISSUER || "",
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false;

      // ── Step 1: FleetDM device verification ─────────────────────────────
      // The Keycloak custom authenticator extracts the CN from the mTLS
      // client certificate and exposes it as `machine_cn` in the OIDC profile.
      const machineCn = (profile as any)?.machine_cn as string | undefined;
      console.log(
        `[auth] Sign-in attempt: email=${user.email}, machine_cn=${machineCn || "NONE"}`
      );

      // const fleetResult = await verifyDeviceWithFleet(machineCn || "");

      // if (!fleetResult.verified) {
      //   console.warn(
      //     `[auth] ❌ Device verification FAILED for ${user.email}: ${fleetResult.reason}`
      //   );
      //   // Redirect to device error page with the reason
      //   const errorUrl =
      //     `/device-error?reason=${encodeURIComponent(fleetResult.reason || "Unknown error")}` +
      //     `&machine=${encodeURIComponent(machineCn || "Unknown")}`;
      //   return errorUrl;
      // }

      // console.log(
      //   `[auth] ✅ Device verified for ${user.email}: ${fleetResult.device?.display_name || machineCn}`
      // );

      // ── Step 2: Provision or confirm user in database ───────────────────
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email },
      });

      if (!existingUser) {
        await prisma.user.create({
          data: {
            email: user.email,
            name: user.name || "Unknown",
            role: "user",
            allowedResourceKeys: [],
          },
        });
      }

      return true;
    },
    async jwt({ token, user }) {
      if (token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
          include: {
            organizations: {
              select: { organizationId: true },
            },
          },
        });
        if (dbUser) {
          token.userId = dbUser.id;
          token.role = dbUser.role;
          token.allowedResourceKeys = dbUser.allowedResourceKeys;
          token.organizationIds = dbUser.organizations.map(
            (o) => o.organizationId
          );
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId;
        (session.user as any).role = token.role;
        (session.user as any).allowedResourceKeys = token.allowedResourceKeys || [];
        (session.user as any).organizationIds = token.organizationIds || [];
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: '/',
  }
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
