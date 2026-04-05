import { QRCodeSVG } from "qrcode.react";

interface QrCodeDisplayProps {
  url: string;
  label: string;
}

export function QrCodeDisplay({ url, label }: QrCodeDisplayProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="rounded-lg bg-white p-2">
        <QRCodeSVG value={url} size={120} />
      </div>
      <span className="max-w-40 truncate text-[10px] text-muted-foreground">{url}</span>
    </div>
  );
}
