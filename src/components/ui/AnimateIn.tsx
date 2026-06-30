"use client";
import { useInView } from "@/hooks/useInView";

interface Props {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function AnimateIn({ children, className = "", delay = 0 }: Props) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      style={{ transitionDelay: inView ? `${delay}ms` : "0ms" }}
      className={`transition-all duration-500 ease-spring ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      } ${className}`}
    >
      {children}
    </div>
  );
}
