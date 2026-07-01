import { NextRequest, NextResponse } from "next/server";

// ─── Feature flag ─────────────────────────────────────────────────────────────

export function isPublicOnboardingEnabled(): boolean {
  return process.env.PUBLIC_ONBOARDING_REPORT_ENABLED === "true";
}

export function disabledResponse(): NextResponse {
  return NextResponse.json({ error: "Public onboarding report is disabled." }, { status: 404 });
}

// ─── In-memory rate limiter (per IP, 60 req / minute) ────────────────────────

const _rl = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(req: NextRequest, limit = 60, windowMs = 60_000): boolean {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const now = Date.now();
  const entry = _rl.get(ip);
  if (!entry || entry.resetAt < now) {
    _rl.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

export function rateLimitedResponse(): NextResponse {
  return NextResponse.json({ error: "Too many requests." }, { status: 429 });
}

// ─── Public-safe types ────────────────────────────────────────────────────────

export type OnboardingStatus =
  | "not_started"
  | "in_progress"
  | "mostly_completed"
  | "completed"
  | "blocked";

export type LoginStatus = "logged_in" | "invited" | "not_logged_in" | "failed";
export type DeviceStatus = "verified" | "pending" | "failed" | "not_required";
export type AssignmentStatus =
  | "assigned"
  | "partially_assigned"
  | "not_assigned"
  | "not_required";
export type MemberStatus =
  | "fully_onboarded"
  | "partially_onboarded"
  | "pending"
  | "blocked";

export interface PublicOnboardingSummary {
  totalOrganizations: number;
  totalTeams: number;
  totalMembers: number;
  totalResources: number;
  totalCredentials: number;
  totalTotpEntries: number;
  fullyOnboardedMembers: number;
  partiallyOnboardedMembers: number;
  pendingMembers: number;
  blockedMembers: number;
  overallProgressPercent: number;
  lastUpdatedAt: string;
}

export interface PublicOrganizationRow {
  organizationId: string;
  organizationName: string;
  teamsCount: number;
  membersCount: number;
  resourcesCount: number;
  credentialsCount: number;
  totpCount: number;
  fullyOnboardedMembers: number;
  partiallyOnboardedMembers: number;
  pendingMembers: number;
  blockedMembers: number;
  progressPercent: number;
  status: OnboardingStatus;
  lastUpdatedAt: string;
}

export interface PublicTeamRow {
  teamId: string;
  teamName: string;
  totalMembers: number;
  membersWithResources: number;
  membersWithCredentials: number;
  membersWithTotp: number;
  fullyOnboardedMembers: number;
  pendingMembers: number;
  progressPercent: number;
  status: OnboardingStatus;
}

export interface PublicMemberRow {
  memberId: string;
  displayLabel: string;
  teamName: string | null;
  roleInOrg: string;
  deviceStatus: DeviceStatus;
  loginStatus: LoginStatus;
  resourceStatus: AssignmentStatus;
  credentialStatus: AssignmentStatus;
  totpStatus: AssignmentStatus;
  overallStatus: MemberStatus;
  publicMissingItems: string[];
  lastUpdatedAt: string;
}

export interface PublicResourceRow {
  category: string;
  count: number;
  assignedTeamsCount: number;
  assignedMembersCount: number;
  status: string;
}

export interface PublicCredentialRow {
  category: string;
  total: number;
  assigned: number;
  unassigned: number;
  membersWithCredentials: number;
  membersMissingCredentials: number;
  status: string;
}

export interface PublicTotpRow {
  category: string;
  total: number;
  assigned: number;
  unassigned: number;
  membersWithTotp: number;
  membersMissingTotp: number;
  status: string;
}

export interface PublicAssignmentMatrixRow {
  memberId: string;
  displayLabel: string;
  teamName: string | null;
  requiredResources: number;
  assignedResources: number;
  resourceStatus: AssignmentStatus;
  requiredCredentials: number;
  assignedCredentials: number;
  credentialStatus: AssignmentStatus;
  requiredTotp: number;
  assignedTotp: number;
  totpStatus: AssignmentStatus;
  overallStatus: MemberStatus;
  publicMissingItems: string[];
}

export interface PublicBlockerRow {
  organizationName: string;
  teamName: string | null;
  displayLabel: string;
  blockerType: string;
  description: string;
  priority: "high" | "medium" | "low";
  status: "open" | "in_progress" | "resolved";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function deriveOnboardingStatus(progressPercent: number): OnboardingStatus {
  if (progressPercent === 0) return "not_started";
  if (progressPercent < 40) return "in_progress";
  if (progressPercent < 80) return "in_progress";
  if (progressPercent < 100) return "mostly_completed";
  return "completed";
}

export function deriveMemberStatus(
  hasResources: boolean,
  hasCredentials: boolean,
  orgHasCredentials: boolean,
  hasTotp: boolean,
  orgHasTotp: boolean,
  hasLoggedIn: boolean
): MemberStatus {
  const credOk = hasCredentials || !orgHasCredentials;
  const totpOk = hasTotp || !orgHasTotp;

  if (hasResources && credOk && totpOk && hasLoggedIn) return "fully_onboarded";
  if (!hasLoggedIn && !hasResources && !hasCredentials && !hasTotp) return "pending";
  if (hasResources || hasCredentials || hasTotp || hasLoggedIn) return "partially_onboarded";
  return "pending";
}

export function deriveAssignmentStatus(assigned: number, required: number): AssignmentStatus {
  if (required === 0) return "not_required";
  if (assigned === 0) return "not_assigned";
  if (assigned < required) return "partially_assigned";
  return "assigned";
}

/** Anonymize members: "Member 1", "Member 2", ... (stable within the request) */
export function anonymizeLabel(index: number, roleInOrg: string): string {
  const role = roleInOrg === "owner" ? "Owner" : roleInOrg === "admin" ? "Admin" : "Member";
  return `${role} ${index + 1}`;
}
