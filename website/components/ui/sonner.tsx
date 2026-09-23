"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react"

// The toast: a white card with the tier-3 shadow, arriving over whatever the
// reader is looking at. Dashboard-only, so lucide is permitted. There is no theme
// switch on this site, so the theme is pinned rather than read from next-themes;
// the semantic colour sits on the status icon only.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" strokeWidth={2} />,
        info: <InfoIcon className="size-4" strokeWidth={2} />,
        warning: <TriangleAlertIcon className="size-4" strokeWidth={2} />,
        error: <OctagonXIcon className="size-4" strokeWidth={2} />,
        loading: <Loader2Icon className="size-4 animate-spin" strokeWidth={2} />,
      }}
      style={
        {
          "--normal-bg": "var(--color-white)",
          "--normal-text": "var(--color-ink)",
          "--normal-border": "transparent",
          "--border-radius": "var(--radius-xl)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast font-sans text-body shadow-pop! border-0!",
          title: "font-semibold",
          description: "text-ink-2!",
          success: "[&_[data-icon]]:text-success",
          error: "[&_[data-icon]]:text-error",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
