import en from "../../messages/en/meeting.json" with { type: "json" };
import fr from "../../messages/fr/meeting.json" with { type: "json" };

import type { Area } from "../area.js";

export const meetingMessages = {
  en,
  fr,
  arguments: {
    "meeting.date": {},
    "meeting.decision": {},
    "meeting.document": {},
    "meeting.durationHours": { hours: "argument", minutes: "argument" },
    "meeting.durationMinutes": { minutes: "argument" },
    "meeting.files": {},
    "meeting.filesGrouped": { count: "plural" },
    "meeting.grouped": {},
    "meeting.groupingNote": { count: "plural", reasons: "argument" },
    "meeting.notes": {},
    "meeting.participants": { count: "plural" },
    "meeting.pseudonymNote": {},
    "meeting.pseudonymised": {},
    "meeting.relatedNote": {},
    "meeting.representations": {},
    "meeting.signal.commit": {},
    "meeting.signal.content": {},
    "meeting.signal.declared": {},
    "meeting.signal.folder": {},
    "meeting.signal.name": {},
    "meeting.signal.similarName": {},
    "meeting.signal.title": {},
    "meeting.slides": {},
    "meeting.space": {},
    "meeting.transcript": {},
  },
} as const satisfies Area<keyof typeof en>;
