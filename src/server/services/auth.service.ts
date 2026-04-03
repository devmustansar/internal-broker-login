import { SignJWT, jwtVerify } from "jose";
import { AuthContext, InternalUser } from "@/types";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "broker-secret-key-12345"
);
const JWT_EXPIRY = "8h";

export const authService = {
  async signToken(user: InternalUser): Promise<string> {
    const payload: AuthContext = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return new SignJWT(payload as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(JWT_EXPIRY)
      .sign(JWT_SECRET);
  },

  async verifyToken(token: string): Promise<AuthContext | null> {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      return payload as unknown as AuthContext;
    } catch (e) {
      return null;
    }
  },
};
