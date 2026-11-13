---
name: adding-user-role
description: Use when adding a user role or changing its permissions.
category: access-control
---

# Adding or changing a user role

A new role is not one edit. Find every place the role list is spelled out, mirror the access rule in the database, and keep each check narrow.

Checklist (grep an existing role such as `room_staff` to find each spot):
- `src/types/database.ts`: the `UserRole` union, which mirrors `supabase/schema.sql`.
- `src/lib/ticket-meta.ts`: `ROLE_LABEL` (Thai label).
- `src/app/(dashboard)/users/actions.ts` `ROLES` and `src/components/users/user-edit-form.tsx` `ROLE_ORDER`.
- `src/components/users/user-row.tsx`: `ROLE_ICON`.
- `src/lib/modules.ts`: each module's `roles` list. `src/lib/nav.ts`: the manage-group entries.
- `src/lib/control/access.test.ts`: `ROLE_MAP` is `Record<UserRole, true>`, so `tsc` fails until the new role is listed.

Rules:
- Match the database. A UI check mirrors the RLS policies named in the file comments. A role with no policy for a table sees nothing there, so hide its menu entry too. Edit SQL under the `supabase-sql-rollout` skill.
- Do not widen a shared officer check (`isFacilityOfficer`, `isStaffRole`) to admit one new role when that check also opens unrelated data, such as the census roster. Add a dedicated check module with its own list, as `src/lib/cleaning-access.ts` does.
- `data/session.ts` imports `next/headers` and cannot load under `npm test`. Keep role lists local to the module and let a test compare them against the source.
- Verify with the `school-facility-app-verify` skill.
