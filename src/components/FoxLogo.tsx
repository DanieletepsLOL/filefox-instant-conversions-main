import logo from "@/assets/filefox-logo.png";

type Props = { className?: string };

export function FoxLogo({ className }: Props) {
  return (
    <img
      src={logo}
      alt="Filefox"
      className={`object-contain ${className ?? ""}`}
    />
  );
}
