# Backlog page: the lint error and the fix

Lint output before the fix (eslint, react-hooks/purity):

```
31:137  error  Error: Cannot call impure function during render
`Date.now` is an impure function. Calling an impure function can produce unstable results that update unpredictably when the component happens to re-render.
> 31 | {tickets === null ? <LoadError what="งานซ่อมค้าง" retryHref="/backlog" /> : <BacklogView result={groupBacklog(tickets, unreadIds, Date.now())} />}
```

Fix that passed `npx tsc --noEmit`, `npx eslint src` and `npm test`:

```ts
const [tickets, unreadIds] = await Promise.all([getBacklog(session.supabase), getUnreadTicketIds(session.supabase)]);
const result = tickets && groupBacklog(tickets, unreadIds, new Date().getTime());
```

The JSX then picks the branch on `result` (a truthy result renders the view, a null result renders the load error).

`groupBacklog` already takes `now` as a parameter, so its unit tests stay deterministic.
