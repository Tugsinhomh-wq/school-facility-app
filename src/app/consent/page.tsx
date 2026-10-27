import Image from "next/image";
import { redirect } from "next/navigation";

import { ConsentForm } from "@/components/auth/consent-form";
import { getSession } from "@/lib/data/session";
import { needsConsent, POLICY_VERSION, policyDateThai } from "@/lib/policy";

export const metadata = {
  title: "ยอมรับนโยบาย | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

const POINTS = [
  "ระบบเก็บข้อมูลที่คุณกรอก ได้แก่ เรื่องแจ้งซ่อม การจองห้องประชุม การยืนยันเขตทำความสะอาด และบันทึกข้อมูลการควบคุมภายใน",
  "โรงเรียนเก็บทะเบียนรายชื่อนักเรียนรายห้อง มีเพียงเลขประจำตัวและชื่อ-สกุลเท่านั้น",
  "ข้อมูลแต่ละส่วนเห็นได้เฉพาะผู้ที่เกี่ยวข้องตามบทบาท เช่น ครูที่ปรึกษาเห็นรายชื่อเฉพาะห้องของตน",
  "คุณขอให้ลบข้อมูลของคุณได้ โดยแจ้งผู้ดูแลระบบของโรงเรียน",
];

/** Shown once per policy version to every signed-in user; the dashboard layout sends them here. */
export default async function ConsentPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  // Same test as the dashboard layout, so the two can never send the user back and forth.
  if (session.consentVersion === undefined || !needsConsent(session.consentVersion, session.metaConsentVersion))
    redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <main className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/logo.png" alt="" width={640} height={1016} priority className="h-16 w-auto" />
          <h1 className="font-display mt-4 text-2xl font-medium leading-tight">
            นโยบายความเป็นส่วนตัวมีการปรับปรุง
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ปรับปรุงล่าสุด {policyDateThai(POLICY_VERSION)}
          </p>
        </div>
        <div className="border-t border-border pt-6">
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
            {POINTS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="mt-4 flex gap-4 text-sm">
            <a href="/privacy" className="flex min-h-11 items-center underline">
              อ่านนโยบายความเป็นส่วนตัว
            </a>
            <a href="/terms" className="flex min-h-11 items-center underline">
              อ่านเงื่อนไขการใช้งาน
            </a>
          </p>
          <ConsentForm />
        </div>
      </main>
    </div>
  );
}
