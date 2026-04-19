'use client'

import * as React from "react"
import { motion, type Variants } from "framer-motion"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface DockProps {
  className?: string
  items: {
    icon: LucideIcon
    label: string
    onClick?: () => void
    active?: boolean
  }[]
}

interface DockIconButtonProps {
  icon: LucideIcon
  label: string
  onClick?: () => void
  active?: boolean
  className?: string
}

const floatingAnimation: Variants = {
  initial: { y: 0 },
  animate: {
    y: [-2, 2, -2],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
}

const DockIconButton = React.forwardRef<HTMLButtonElement, DockIconButtonProps>(
  ({ icon: Icon, label, onClick, active, className }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.1, y: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className={cn("relative group", className)}
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          background: active ? "var(--accent-soft)" : "transparent",
          border: `1px solid ${active ? "var(--accent-soft-2)" : "transparent"}`,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background .12s ease, border-color .12s ease",
          position: "relative",
        }}
      >
        <Icon
          size={18}
          strokeWidth={1.75}
          style={{ color: active ? "var(--accent-ink)" : "var(--fg-2)" }}
        />
        <span style={{
          position: "absolute",
          bottom: "calc(100% + 8px)",
          left: "50%",
          transform: "translateX(-50%)",
          padding: "4px 10px",
          borderRadius: 6,
          fontSize: 11.5,
          fontWeight: 500,
          background: "var(--bg-3)",
          color: "var(--fg)",
          border: "1px solid var(--line)",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          opacity: 0,
          transition: "opacity .12s ease",
        }}
          className="group-hover:opacity-100"
        >
          {label}
        </span>
      </motion.button>
    )
  }
)
DockIconButton.displayName = "DockIconButton"

const Dock = React.forwardRef<HTMLDivElement, DockProps>(
  ({ items, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex items-end justify-center pb-5", className)}
        style={{ width: "100%" }}
      >
        <motion.div
          initial="initial"
          animate="animate"
          variants={floatingAnimation}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 10px",
            borderRadius: 20,
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid var(--line-2)",
            background: "color-mix(in oklch, var(--bg) 88%, transparent)",
            boxShadow: "0 8px 32px color-mix(in oklch, var(--fg) 12%, transparent), 0 2px 8px color-mix(in oklch, var(--fg) 6%, transparent)",
          }}
        >
          {items.map((item) => (
            <DockIconButton key={item.label} {...item} />
          ))}
        </motion.div>
      </div>
    )
  }
)
Dock.displayName = "Dock"

export { Dock }
