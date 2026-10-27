/**
 * The version (Buddhist-era date, YYYY-MM-DD) of the privacy policy and terms. Raise it whenever the text
 * changes: everyone is asked to accept again, and the privacy page shows it as "ปรับปรุงล่าสุด".
 */
export const POLICY_VERSION = "2569-10-27";

const MONTHS_LONG = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

/** "2569-10-27" -> "27 ตุลาคม 2569". Anything else comes back unchanged. */
export function policyDateThai(version: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(version);
  const month = m ? MONTHS_LONG[Number(m[2]) - 1] : undefined;
  return m && month ? `${Number(m[3])} ${month} ${m[1]}` : version;
}

/**
 * True unless the profile or the sign-up metadata (email sign-ups store the version they accepted)
 * carries the current version.
 */
export const needsConsent = (
  profileVersion: string | null | undefined,
  metaVersion: string | null | undefined,
) => profileVersion !== POLICY_VERSION && metaVersion !== POLICY_VERSION;
