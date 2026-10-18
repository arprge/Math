/** Status pip shared by the register list, receipt cards and archive preview. */
export default function StatusDot({
  status,
}: {
  status: "expired" | "soon" | "active"
}) {
  const c =
    status === "expired" ? "bg-signal" : status === "soon" ? "bg-warn" : "bg-ok"
  return <span className={`inline-block w-2 h-2 shrink-0 ${c}`} aria-hidden />
}
