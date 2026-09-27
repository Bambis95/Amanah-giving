import { Badge } from "@/components/ui/badge";
import { Ban, CheckCircle, Clock, XCircle } from "lucide-react";
import { paymentStatusLabels } from "./format";

// Status always carries an icon and a label, never color alone
const statusStyles: Record<string, { icon: React.ElementType; className: string }> = {
  paid: { icon: CheckCircle, className: "bg-success/10 text-success border-success/30" },
  pending: { icon: Clock, className: "bg-warning/10 text-warning border-warning/30" },
  failed: { icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/30" },
  cancelled: { icon: Ban, className: "bg-muted text-muted-foreground border-border" },
};

export default function PaymentStatusBadge({ status }: { status: string }) {
  const style = statusStyles[status] ?? { icon: Clock, className: "bg-muted text-muted-foreground border-border" };
  return (
    <Badge variant="outline" className={`gap-1 font-medium whitespace-nowrap ${style.className}`}>
      <style.icon className="w-3 h-3" />
      {paymentStatusLabels[status] ?? status}
    </Badge>
  );
}
