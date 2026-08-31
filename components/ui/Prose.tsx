import { cn } from "@/lib/utils/cn";

/** The reading column. Body copy goes inside; forms, tables and card grids
 *  stay outside. Styles live in the .prose-af block in globals.css. */
export function Prose({
  children,
  className,
  /** 68ch → 78ch. For copy sitting beside a wide figure. */
  wide = false,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag className={cn("prose-af", wide && "measure-wide", className)}>
      {children}
    </Tag>
  );
}