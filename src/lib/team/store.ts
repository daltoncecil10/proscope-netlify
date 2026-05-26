export type TeamMemberRecord = {
  id: string;
  email: string;
  name: string;
  role: "owner" | "member" | "pending";
  status: "active" | "pending";
  joinedAt: string | null;
  inviteSentAt: string | null;
  jobsShared: number;
};

export type JobShareRecord = {
  id: string;
  jobId: string;
  jobTitle: string;
  jobAddress: string;
  ownerEmail: string;
  sharedWithEmails: string[];
  sharedAt: string;
  direction: "in" | "out";
  externalShareUrl: string | null;
};

type TeamStore = {
  members: TeamMemberRecord[];
  shares: JobShareRecord[];
};

const STORAGE_PREFIX = "proscope-team:";

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function defaultStore(ownerEmail: string): TeamStore {
  const name = ownerEmail.split("@")[0] ?? "You";
  return {
    members: [
      {
        id: "owner",
        email: ownerEmail,
        name,
        role: "owner",
        status: "active",
        joinedAt: new Date().toISOString(),
        inviteSentAt: null,
        jobsShared: 0,
      },
    ],
    shares: [],
  };
}

function readStore(userId: string, ownerEmail: string): TeamStore {
  if (typeof window === "undefined") return defaultStore(ownerEmail);
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return defaultStore(ownerEmail);
    const parsed = JSON.parse(raw) as TeamStore;
    if (!parsed.members?.length) return defaultStore(ownerEmail);
    return parsed;
  } catch {
    return defaultStore(ownerEmail);
  }
}

function writeStore(userId: string, store: TeamStore) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(userId), JSON.stringify(store));
}

export function loadTeamData(userId: string, ownerEmail: string): TeamStore {
  return readStore(userId, ownerEmail);
}

export function inviteTeamMember(
  userId: string,
  ownerEmail: string,
  email: string
): TeamMemberRecord {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) throw new Error("Enter a valid email address.");
  const store = readStore(userId, ownerEmail);
  if (store.members.some((m) => m.email.toLowerCase() === normalized)) {
    throw new Error("That email is already on your team.");
  }
  const member: TeamMemberRecord = {
    id: `invite-${Date.now()}`,
    email: normalized,
    name: normalized,
    role: "pending",
    status: "pending",
    joinedAt: null,
    inviteSentAt: new Date().toISOString(),
    jobsShared: 0,
  };
  store.members.push(member);
  writeStore(userId, store);
  return member;
}

export function resendInvite(userId: string, ownerEmail: string, memberId: string) {
  const store = readStore(userId, ownerEmail);
  const member = store.members.find((m) => m.id === memberId);
  if (!member) throw new Error("Invite not found.");
  member.inviteSentAt = new Date().toISOString();
  writeStore(userId, store);
}

export function shareJobInternally(
  userId: string,
  ownerEmail: string,
  input: {
    jobId: string;
    jobTitle: string;
    jobAddress: string;
    teammateEmails: string[];
    externalShareUrl?: string | null;
  }
): JobShareRecord {
  const emails = input.teammateEmails.map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!emails.length && !input.externalShareUrl) {
    throw new Error("Select at least one teammate or create an external link.");
  }
  const store = readStore(userId, ownerEmail);
  const share: JobShareRecord = {
    id: `share-${Date.now()}`,
    jobId: input.jobId,
    jobTitle: input.jobTitle,
    jobAddress: input.jobAddress,
    ownerEmail,
    sharedWithEmails: emails,
    sharedAt: new Date().toISOString(),
    direction: "out",
    externalShareUrl: input.externalShareUrl ?? null,
  };
  store.shares.unshift(share);
  for (const email of emails) {
    const member = store.members.find((m) => m.email.toLowerCase() === email);
    if (member && member.status === "active") {
      member.jobsShared += 1;
    }
  }
  writeStore(userId, store);
  return share;
}

export function listSharedJobsForUser(userId: string, ownerEmail: string): JobShareRecord[] {
  return readStore(userId, ownerEmail).shares;
}

export function listTeamMembers(userId: string, ownerEmail: string): TeamMemberRecord[] {
  return readStore(userId, ownerEmail).members;
}

export function activeTeamMembers(userId: string, ownerEmail: string): TeamMemberRecord[] {
  return listTeamMembers(userId, ownerEmail).filter((m) => m.status === "active");
}
