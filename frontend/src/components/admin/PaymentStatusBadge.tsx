import { Badge } from "@/components/ui/badge";
import { Ban, CheckCircle, Clock, XCircle } from "lucide-react";
import { paymentStatusLabels } from "./format";

// Status always carries an icon and a label, never color alone
const statusStyles: Record<string, { icon: React.ElementType; className: string }> = {
  paid: { icon: CheckCircle, className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  pending: { icon: Clock, className: "bg-amber-50 text-amber-700 border-amber-200" },
  failed: { icon: XCircle, className: "bg-red-50 text-red-700 border-red-200" },
  cancelled: { icon: Ban, className: "bg-gray-100 text-gray-600 border-gray-200" },
};

export default function PaymentStatusBadge({ status }: { status: string }) {
  const style = statusStyles[status] ?? { icon: Clock, className: "bg-gray-100 text-gray-600 border-gray-200" };
  return (
    <Badge variant="outline" className={`gap-1 font-medium whitespace-nowrap ${style.className}`}>
      <style.icon className="w-3 h-3" />
      {paymentStatusLabels[status] ?? status}
    </Badge>
  );
}
