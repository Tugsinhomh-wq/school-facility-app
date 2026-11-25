---
name: school-memo-items
description: Use when changing combined memo items or photo captions.
category: domain-rules
---

# Memo item numbers, grouping and captions

A number printed for a memo item or a photo caption comes from the rendered item list, never from a stored row position. `memo_tickets.position` orders attachments; once several tickets can share one item, position and item number diverge.

- Combined-memo photo captions use the ticket number: `เลขที่งาน <no> <place> – <title>` (`photoHeading(t, numbered)` in `src/lib/memo/photo-groups.ts`). The number is already in the item text, so do not add an item column.
- `memo_tickets.position` follows the `p_ticket_ids` order, keeping the first occurrence of a duplicate id. The check constraint needs `position >= 1`.
- Group input `group_<ticketId>` parses strictly (`/^[1-9]$/`, strings only). Any other value (`0`, `10`, `abc`, empty, a file) leaves the ticket as its own item, with no error. Group keys for ids not in the submitted list are never read.
- A group select renders only while its ticket is ticked, so an unticked ticket never posts a group value.
- A group with one ticket renders exactly like an ungrouped item.
- Missing building or room never prints `undefined` or `null`: `placeOfTicket` falls back to `บริเวณโรงเรียน` and blank parts are dropped.
- Cross-building picks show counts such as `2 งาน · 2 อาคาร`, and the memo opening lists every building.
- Phone-facing controls on the candidate list are 44px tall (`h-11`) and have an `aria-label`.
