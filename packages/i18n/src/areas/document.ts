import en from "../../messages/en/document.json" with { type: "json" };
import fr from "../../messages/fr/document.json" with { type: "json" };

import type { Area } from "../area.js";

export const documentMessages = {
  en,
  fr,
  arguments: {
    "document.author": {},
    "document.convertedNote": {},
    "document.date": {},
    "document.dateNote": {},
    "document.download": {},
    "document.extractedText": {},
    "document.groupedNote": {},
    "document.kind.pdf": {},
    "document.kind.presentation": {},
    "document.kind.spreadsheet": {},
    "document.kind.text": {},
    "document.noNote": {},
    "document.openPdf": {},
    "document.originalNote": {},
    "document.pageCount": {},
    "document.pages": { count: "plural" },
    "document.preview": {},
    "document.previewNote": {},
    "document.relatedNote": {},
    "document.relatedNotes": {},
    "document.roleNotes": {},
    "document.roleOriginal": {},
    "document.rolePreview": {},
    "document.sameDocument": { count: "plural" },
    "document.type": {},
    "document.view": {},
    "document.views": {},
  },
} as const satisfies Area<keyof typeof en>;
