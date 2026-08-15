import Image from "next/image";
import Link from "next/link";

interface MockupSliceProps {
  src: string;
  width: number;
  height: number;
  alt?: string;
  priority?: boolean;
  children?: React.ReactNode;
}

/** 시안 PNG 슬라이스 + 클릭 영역 오버레이 */
export function MockupSlice({ src, width, height, alt = "", priority, children }: MockupSliceProps) {
  return (
    <div className="relative w-full">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="block h-auto w-full"
        sizes="430px"
        priority={priority}
      />
      {children}
    </div>
  );
}

interface HotspotProps {
  href: string;
  className?: string;
  ariaLabel: string;
}

export function Hotspot({ href, className, ariaLabel }: HotspotProps) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={`absolute block ${className ?? ""}`}
    />
  );
}
