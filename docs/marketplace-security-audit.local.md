# Web marketplace read boundary

Pre-rule review: the default development database is Firestore Standard, verified through `gcloud firestore databases describe` on 2026-09-09. These are separate web records; no mobile document shape or mobile access predicate is reused.

- `webMarketplaceUsers/{uid}`: verified owner gets their own access/preferences record, including revocation. No client writes.
- `webMarketplaceUsers/{uid}/inbox/{id}`: verified active owner reads their scoped inbox. Records contain only the confirmed practical summary, abbreviated trainee identity and message counters. No message body or full trainee identity is included.
- `webEnquiries/{id}/messages/{messageId}`: active, verified participant can read messages only after server-recorded unlock. Queries always name one conversation; no collection-group access.
- `webLeadTracking/{uid}/leads/{id}`: active trainer owner only. Notes and outcomes never enter the trainee inbox.
- All memberships, invitations, raw enquiry records, private introductions, profile workspaces, credential evidence, unlock ledgers, outbox records, reports and rate limits: Functions-only writes; private server records have no direct client reads.
- Storage uploads and signed evidence/photo URLs are issued by authenticated Functions, with content validation and size limits. Existing storage rules continue denying these namespaces.

Attack tests must cover unauthenticated access, forged membership, cross-user reads/listeners, locked message access, direct client writes, and revocation. Existing mobile rules suites must remain passing.
