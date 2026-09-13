# Publishing transcripts

This page is for the person who decides to publish a site that includes meeting transcripts. It describes practices, not the law of any country; the organisation's data protection officer settles the rest.

A transcript is a record of what identifiable people said. Pseudonymisation makes that record harder to attribute; it does not make publishing it a technical question. The build hides names; it cannot tell you whether the meeting may be published at all.

## What the tool does

- **Pseudonymisation at build.** When `privacy.pseudonymize.enabled` is `true`, every transcript is pseudonymised before anything reads it: the rendered page, the search index, the model and the file offered for download only ever see the pseudonymised form. Speakers and names of the dictionary become their pseudonym or their role; speakers the dictionary does not know are numbered. The minutes and the slides of the same meeting are replaced the same way. The [configuration guide](configuration.md#pseudonymisation) describes the mechanism.
- **The dictionary is never published, and a build without it publishes no transcript.** `pseudonyms.yaml` is read at build time only. It is never copied into the output, and the publication tests walk the output for the real names it declares. When the file is missing or malformed while pseudonymisation is enabled, the build fails with [`W-PRIVACY-DICTIONARY`](../checks/W-PRIVACY-DICTIONARY.md) and withholds every transcript: not publishing is the lesser harm.
- **Detected mentions are reported for review.** A name-shaped mention that no dictionary entry covers is left as written and reported as [`I-PII-DETECTED`](../checks/I-PII-DETECTED.md). The heuristic is deliberately simple: it catches "Firstname Lastname" and misses a first name alone, a nickname, an initial, an address, a phone number, or a detail that identifies someone without naming them.
- **Publication is off by default.** Transcripts enter the published site and its search index only when `privacy.publish_transcripts` is `true`. `concordance validate-config` warns when it is set without pseudonymisation enabled, and refuses pseudonymisation enabled without a dictionary.

## What the tool cannot decide

Whether to publish at all, to whom, and for how long are governance decisions. The build has no opinion on any of them, and a green build says nothing about them:

- **Whether to publish.** A meeting may have been recorded on the understanding that the recording stays within the room. A pseudonymised transcript of it is still that recording, published.
- **To whom.** A site behind the organisation's authentication and a site on the public internet are two different publications. The tool produces the same files for both.
- **For how long.** A static site has no expiry. Nothing in the build removes a transcript after a period; someone has to.
- **What identifies a person.** The dictionary knows the names you gave it. It does not know that "the only person from the branch office in that meeting" is one person, or that a role kept with `keep_roles` designates a single individual.

## Obligations to settle before publishing

Settle each of these with the people responsible for the organisation's data protection, and write down the answer where the site's maintainers can find it.

1. **Inform the participants and obtain the appropriate basis.** The people who spoke know that the meeting was recorded, that a transcript of it will be published, where, to whom, and in what form. Where their agreement is the basis for publishing, it is asked for before the first build that includes them and recorded.
2. **A lawful basis for the processing.** Publishing a transcript is a processing of personal data, pseudonymised or not; name the basis the organisation relies on and keep it with the decision.
3. **A retention period and a deletion routine.** Decide how long transcripts stay published and how they are removed: from the source repository, from the built site, and from any copy of the site (mirrors, caches, archives of the hosting service). A build that no longer reads a transcript does not delete what an earlier build published.
4. **A contact for objections.** A participant who wants a transcript, a passage or a mention withdrawn needs an address to write to and someone who acts on it within a known delay. Put the contact where readers of the site can find it.
5. **An access scope for the site.** Decide who can open the site (the organisation, a team, the public) and make the hosting enforce it. Search engines index what they can reach; a public site with transcripts is a searchable archive of who said what.
6. **A review of the detected mentions.** Before every publication, read the `I-PII-DETECTED` findings and either add the name to the dictionary or edit the transcript at its source. Then read a sample of the published transcripts as a stranger would: pseudonyms hide names, not context.

## A checklist

Copy this table into the decision record and fill the right-hand column.

| Question | Answer |
|---|---|
| Who decided that these transcripts are published, and when? | |
| Were the participants informed of the publication, its audience and its form? | |
| Where their agreement is the basis, is it recorded and before the first build? | |
| Which lawful basis covers the processing? | |
| How long do transcripts stay published, and who removes them? | |
| How is a transcript removed from the built site and from its copies? | |
| Whom does a participant contact to object, and within what delay is it handled? | |
| Who can open the site, and what enforces it? | |
| Is `privacy.pseudonymize.enabled` `true` with a dictionary, and is the dictionary kept out of any public repository? | |
| Were the `I-PII-DETECTED` findings of the last build reviewed? | |
| Was a sample of the published transcripts read for context that identifies someone? | |

## Configuration

Two keys under `privacy` govern transcripts; both are `false` by default.

```yaml
privacy:
  pseudonymize:
    enabled: true
    dictionary: ./pseudonyms.yaml
    keep_roles: false
  publish_transcripts: true
```

- `pseudonymize.enabled` turns pseudonymisation on; `pseudonymize.dictionary` is then required and points at `pseudonyms.yaml`, one entry per person with a pseudonym and, optionally, a role. Keep that file out of any public repository: it is the mapping from pseudonyms back to people.
- `publish_transcripts` makes transcripts part of the published site and of its search index. Without it, transcripts are read but never published, pseudonymised or not.

`concordance validate-config` warns when `publish_transcripts` is `true` without `pseudonymize.enabled`, and reports an error when `pseudonymize.enabled` is `true` without a dictionary. Neither replaces the decisions above: a configuration that passes validation is a configuration the build can run, not a publication the organisation has authorised.
