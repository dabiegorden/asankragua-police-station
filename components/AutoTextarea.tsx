"use client";

import { useCallback, useEffect, useRef } from "react";

type AutoTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * A textarea that grows to fit its content so nothing the user types is ever
 * hidden or scrolled out of view. It keeps the initial `rows` height as a
 * minimum, then expands downward as more text is entered. Drop-in replacement
 * for a normal <textarea>.
 */
export default function AutoTextarea({
  value,
  onChange,
  style,
  ...props
}: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const minHeight = useRef<number>(0);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.max(el.scrollHeight, minHeight.current);
    el.style.height = `${next}px`;
  }, []);

  // Capture the rows-based height as the minimum, then size to content.
  useEffect(() => {
    if (ref.current) minHeight.current = ref.current.clientHeight;
    resize();
  }, [resize]);

  // Re-fit whenever the controlled value changes (typing, reset, prefill).
  useEffect(() => {
    resize();
  }, [value, resize]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => {
        onChange?.(e);
        resize();
      }}
      onInput={resize}
      style={{ ...style, resize: "none", overflow: "hidden" }}
      {...props}
    />
  );
}
