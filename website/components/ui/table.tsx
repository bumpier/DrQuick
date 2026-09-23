"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

// A wide, data-heavy table is a virtue on the desk and a smear on a phone. With
// `stack`, below the chosen line each row becomes a block and every cell prints
// its column label first, read from data-label; the header row goes to screen
// readers only, so the semantics are unchanged. The table itself becomes a
// column flexbox rather than a plain block so the caption keeps caption-bottom's
// position (order-last) instead of shrink-wrapping into an anonymous table box.
const STACK = {
  cols: [
    "max-cols:flex max-cols:flex-col max-cols:[&_caption]:order-last max-cols:[&_caption]:block max-cols:[&_thead]:sr-only max-cols:[&_tbody]:block max-cols:[&_tr]:block max-cols:[&_tr]:py-2",
    "max-cols:[&_th[scope=row]]:block max-cols:[&_th[scope=row]]:px-3 max-cols:[&_th[scope=row]]:pt-3 max-cols:[&_th[scope=row]]:pb-1 max-cols:[&_th[scope=row]]:text-left",
    "max-cols:[&_td]:grid max-cols:[&_td]:grid-cols-[minmax(0,12ch)_1fr] max-cols:[&_td]:gap-3 max-cols:[&_td]:py-1.5 max-cols:[&_td]:whitespace-normal",
    "max-cols:[&_td]:before:content-[attr(data-label)] max-cols:[&_td]:before:font-display max-cols:[&_td]:before:text-[11px] max-cols:[&_td]:before:font-semibold max-cols:[&_td]:before:tracking-[.05em] max-cols:[&_td]:before:uppercase max-cols:[&_td]:before:text-ink-2",
  ],
  phone: [
    "max-phone:flex max-phone:flex-col max-phone:[&_caption]:order-last max-phone:[&_caption]:block max-phone:[&_thead]:sr-only max-phone:[&_tbody]:block max-phone:[&_tr]:block max-phone:[&_tr]:py-2",
    "max-phone:[&_th[scope=row]]:block max-phone:[&_th[scope=row]]:px-3 max-phone:[&_th[scope=row]]:pt-3 max-phone:[&_th[scope=row]]:pb-1 max-phone:[&_th[scope=row]]:text-left",
    "max-phone:[&_td]:grid max-phone:[&_td]:grid-cols-[minmax(0,12ch)_1fr] max-phone:[&_td]:gap-3 max-phone:[&_td]:py-1.5 max-phone:[&_td]:whitespace-normal",
    "max-phone:[&_td]:before:content-[attr(data-label)] max-phone:[&_td]:before:font-display max-phone:[&_td]:before:text-[11px] max-phone:[&_td]:before:font-semibold max-phone:[&_td]:before:tracking-[.05em] max-phone:[&_td]:before:uppercase max-phone:[&_td]:before:text-ink-2",
  ],
} as const

// The container is the .table-scroll wrapper: a wide table scrolls inside its own
// box, never the page. Rows are 12px cells on hairlines with a surface-mid hover;
// headers are DESIGN.md's label-caps in Geist.
function Table({
  className,
  stack,
  ...props
}: React.ComponentProps<"table"> & { stack?: "cols" | "phone" }) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      {/* Stacking changes display on tr/td, which drops table semantics in Chrome and
          Safari; the explicit roles keep every <th scope> naming its cells. */}
      <table
        data-slot="table"
        data-stack={stack}
        role={stack ? "table" : undefined}
        className={cn(
          "w-full caption-bottom text-body",
          stack && STACK[stack],
          className
        )}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      role="rowgroup"
      className={cn("[&_tr]:border-b [&_tr]:border-rule", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      role="rowgroup"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      role="rowgroup"
      className={cn(
        "border-t border-rule font-semibold [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      role="row"
      className={cn(
        "border-b border-rule transition-colors duration-160 ease-(--ease) hover:bg-surface-mid has-aria-expanded:bg-surface-mid data-[state=selected]:bg-surface-mid",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, scope, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      scope={scope}
      role={scope === "row" ? "rowheader" : "columnheader"}
      className={cn(
        "h-11 px-3 text-left align-middle font-display text-[11px] font-semibold tracking-[.05em] whitespace-nowrap text-ink-2 uppercase [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

// `label` is what the stacked layout prints before the cell; it is decoration
// (the <th scope> already names the cell), so it arrives through ::before.
function TableCell({
  className,
  label,
  ...props
}: React.ComponentProps<"td"> & { label?: string }) {
  return (
    <td
      data-slot="table-cell"
      data-label={label}
      role="cell"
      className={cn(
        "p-3 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-fine text-ink-2", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
