// `new FormData(form, submitter)` (the submitter as 2nd argument) is not supported by older browsers,
// which ignore it, so the button that was pressed would be missing from the data. Pure and relative
// imports only, so `npm test` can load it.

/** The pressed button, as far as this helper needs it. */
export type Submitter = { name?: string; value?: string; disabled?: boolean } | null;

/**
 * `data` with the pressed button's name and value in it. Where the browser already put it there
 * nothing is added, so it never appears twice.
 */
export function withSubmitter(data: FormData, submitter: Submitter): FormData {
  const name = submitter?.name;
  if (!submitter || !name || submitter.disabled) return data;
  const value = submitter.value ?? "";
  if (!data.getAll(name).includes(value)) data.append(name, value);
  return data;
}
