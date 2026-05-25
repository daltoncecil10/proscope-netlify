export type SharedJobDirection = "in" | "out";

export type TeamMemberStatus = "active" | "pending";

export type TeamMember = {
  id: string;
  initials: string;
  name: string;
  email: string;
  role: "owner" | "member" | "pending";
  jobsShared: number | null;
  joined: string | null;
  inviteSent?: string;
  avatar: string;
  isYou?: boolean;
  status: TeamMemberStatus;
};

export type SharedJob = {
  id: string;
  direction: SharedJobDirection;
  title: string;
  address: string;
  owner: { initials: string; name: string; avatar: string };
  sharedWith: { initials: string; avatar: string }[];
  sharedAt: string;
};

export const DEMO_MEMBERS: TeamMember[] = [
  {
    id: "dc",
    initials: "DC",
    name: "Dalton Cecil",
    email: "dalton@proscope.app",
    role: "owner",
    jobsShared: null,
    joined: "Jan 4, 2025",
    avatar: "linear-gradient(135deg, #7BD96A, #5fb37a)",
    isYou: true,
    status: "active",
  },
  {
    id: "jr",
    initials: "JR",
    name: "Joan Renfrow",
    email: "joan@example.com",
    role: "member",
    jobsShared: 3,
    joined: "Feb 18, 2025",
    avatar: "linear-gradient(135deg, #7aa8d9, #4a78b2)",
    status: "active",
  },
  {
    id: "ds",
    initials: "DS",
    name: "Devran Simsek",
    email: "devran@example.com",
    role: "member",
    jobsShared: 2,
    joined: "Mar 6, 2025",
    avatar: "linear-gradient(135deg, #b29df0, #7a5fc9)",
    status: "active",
  },
  {
    id: "as",
    initials: "AS",
    name: "Ashly Satterfield",
    email: "ashly@example.com",
    role: "member",
    jobsShared: 1,
    joined: "Apr 2, 2025",
    avatar: "linear-gradient(135deg, #d99548, #b56f2a)",
    status: "active",
  },
  {
    id: "bw",
    initials: "BW",
    name: "Brad Whitfield",
    email: "brad@example.com",
    role: "member",
    jobsShared: 0,
    joined: "Apr 24, 2025",
    avatar: "linear-gradient(135deg, #5fb37a, #3e8f5a)",
    status: "active",
  },
  {
    id: "ek",
    initials: "EK",
    name: "emily.klein@example.com",
    email: "emily.klein@example.com",
    role: "pending",
    jobsShared: null,
    joined: null,
    inviteSent: "2 days ago",
    avatar: "var(--surface-3)",
    status: "pending",
  },
  {
    id: "mr",
    initials: "MR",
    name: "mike.renner@example.com",
    email: "mike.renner@example.com",
    role: "pending",
    jobsShared: null,
    joined: null,
    inviteSent: "5 days ago",
    avatar: "var(--surface-3)",
    status: "pending",
  },
];

export const DEMO_SHARED_JOBS: SharedJob[] = [
  {
    id: "maple-ridge",
    direction: "in",
    title: "Maple Ridge — Annual roof inspection",
    address: "8842 Maple Ridge Ln · Louisville, KY",
    owner: {
      initials: "JR",
      name: "Joan Renfrow",
      avatar: "linear-gradient(135deg, #7aa8d9, #4a78b2)",
    },
    sharedWith: [
      { initials: "JR", avatar: "linear-gradient(135deg, #7aa8d9, #4a78b2)" },
      { initials: "DC", avatar: "linear-gradient(135deg, #7BD96A, #5fb37a)" },
    ],
    sharedAt: "3 days ago",
  },
  {
    id: "spring-mill",
    direction: "in",
    title: "14018 Spring Mill Rd — Annual",
    address: "Indianapolis, IN · 46032",
    owner: {
      initials: "DS",
      name: "Devran Simsek",
      avatar: "linear-gradient(135deg, #b29df0, #7a5fc9)",
    },
    sharedWith: [
      { initials: "DS", avatar: "linear-gradient(135deg, #b29df0, #7a5fc9)" },
      { initials: "DC", avatar: "linear-gradient(135deg, #7BD96A, #5fb37a)" },
      { initials: "AS", avatar: "linear-gradient(135deg, #d99548, #b56f2a)" },
    ],
    sharedAt: "Yesterday",
  },
  {
    id: "marigold",
    direction: "out",
    title: "218 Marigold Ave — Slope S2",
    address: "Jeffersontown, KY · 40299",
    owner: {
      initials: "DC",
      name: "You",
      avatar: "linear-gradient(135deg, #7BD96A, #5fb37a)",
    },
    sharedWith: [{ initials: "JR", avatar: "linear-gradient(135deg, #7aa8d9, #4a78b2)" }],
    sharedAt: "Today, 9:14 AM",
  },
  {
    id: "crescent-hill",
    direction: "out",
    title: "Crescent Hill — Roof slopes",
    address: "Louisville, KY · 40206",
    owner: {
      initials: "DC",
      name: "You",
      avatar: "linear-gradient(135deg, #7BD96A, #5fb37a)",
    },
    sharedWith: [
      { initials: "JR", avatar: "linear-gradient(135deg, #7aa8d9, #4a78b2)" },
      { initials: "DS", avatar: "linear-gradient(135deg, #b29df0, #7a5fc9)" },
    ],
    sharedAt: "May 12",
  },
  {
    id: "frel-rd",
    direction: "out",
    title: "4609 Frel Rd — Damage walkthrough",
    address: "Louisville, KY · 40272",
    owner: {
      initials: "DC",
      name: "You",
      avatar: "linear-gradient(135deg, #7BD96A, #5fb37a)",
    },
    sharedWith: [{ initials: "AS", avatar: "linear-gradient(135deg, #d99548, #b56f2a)" }],
    sharedAt: "May 10",
  },
];
