---
allowed-tools: Read
description: Tailwind CSS best practices and guidelines
---

# /tailwind

Complete Tailwind CSS guidelines for consistent styling.

---

## Core Principles

### 1. ALWAYS Use Inline Utility Classes

```tsx
// CORRECT
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-md">
  <span className="text-lg font-semibold text-gray-900">Title</span>
</div>

// FORBIDDEN - Never store classes in constants
const cardStyles = "flex items-center justify-between p-4"
<div className={cardStyles}>
```

### 2. Custom CSS is FORBIDDEN (with exceptions)

**When Custom CSS is Permitted:**
- Styling impossible with Tailwind
- Animations requiring `@keyframes` not available in Tailwind
- Complex pseudo-selectors not supported

### 3. ONLY Exception: class-variance-authority (cva)

```tsx
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-white hover:bg-primary/90",
        destructive: "bg-red-500 text-white hover:bg-red-600",
        outline: "border border-input bg-background hover:bg-accent",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

---

## cn() Utility Function

When available, `cn()` is **MANDATORY**.

```tsx
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### Organization Domains (3 Logical Groups)

#### 1. Base/Global
Include dark: variants WITH their base state:
```tsx
"bg-white dark:bg-gray-800"        // Together
"text-gray-900 dark:text-white"    // Together

// FORBIDDEN
"bg-white",
"dark:bg-gray-800"  // Separated
```

#### 2. Responsive
One line per breakpoint:
```tsx
"md:p-6 md:rounded-xl lg:p-8 lg:shadow-xl"
```

#### 3. Variants/States
```tsx
"hover:bg-blue-600 dark:hover:bg-blue-700"
"focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
"before:content-[''] before:absolute before:inset-0"
```

---

## Correct Examples

### Simple Component
```tsx
<div className={cn(
  "flex items-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md",
  "md:p-6 lg:p-8",
  "hover:shadow-lg dark:hover:shadow-xl"
)}>
  <span className="text-lg font-semibold text-gray-900 dark:text-white">
    Content
  </span>
</div>
```

### Complex with Pseudo-elements
```tsx
<button className={cn(
  "relative px-4 py-2 rounded font-medium transition-colors bg-blue-500 dark:bg-blue-600 text-white",
  "before:content-[''] before:absolute before:inset-0 before:rounded before:opacity-0 before:transition-opacity",
  "hover:bg-blue-600 dark:hover:bg-blue-700 hover:before:opacity-10",
  "disabled:opacity-50 disabled:cursor-not-allowed"
)}>
  Click me
</button>
```

### Complex Conditional Logic
```tsx
<button className={cn(
  "px-4 py-2 rounded-md font-medium transition-all",
  "bg-blue-500 dark:bg-blue-600 text-white",
  "hover:bg-blue-600 dark:hover:bg-blue-700",
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
  size === "sm" && "px-3 py-1 text-sm",
  size === "lg" && "px-6 py-3 text-lg",
  variant === "outline" && "bg-transparent border-2 border-blue-500 text-blue-500",
  isLoading && "opacity-50 cursor-wait",
  isDisabled && "opacity-50 cursor-not-allowed bg-gray-300"
)}>
  {isLoading ? "Loading..." : "Submit"}
</button>
```

---

## Forbidden Examples

### Single Long Unorganized String
```tsx
// FORBIDDEN - Cannot scan or maintain
<div className={cn("flex items-center justify-between p-4 md:p-6 lg:p-8 dark:bg-gray-800 dark:text-white hover:shadow-lg focus:ring-2 bg-white rounded-lg shadow-md")}>
```

### Over-segmentation
```tsx
// FORBIDDEN - Too many lines, dark variants separated
<div className={cn(
  "flex items-center",
  "justify-between",
  "p-4",
  "bg-white",
  "dark:bg-gray-800",  // Don't separate
  "text-white",
  "dark:text-gray-100", // Don't separate
)}>
```

### Classes in Constants (outside cva)
```tsx
// FORBIDDEN
const baseClasses = "flex items-center"
const darkClasses = "dark:bg-gray-800"

<div className={cn(baseClasses, darkClasses, "p-4")}>
```

### Not Using cn() When Available
```tsx
// FORBIDDEN
<div className={`flex items-center ${isActive ? 'bg-blue-500' : 'bg-gray-200'}`}>

// CORRECT
<div className={cn(
  "flex items-center",
  isActive ? "bg-blue-500" : "bg-gray-200"
)}>
```

### Inline Styles with Tailwind
```tsx
// FORBIDDEN
<div className="flex items-center" style={{ padding: '16px' }}>

// CORRECT
<div className="flex items-center p-4">
```

---

## Best Practices Summary

**DO:**
- Use Tailwind inline utilities as primary styling method
- Use `cn()` when available (mandatory)
- Group related classes logically (3 domains)
- Keep dark variants with their base state
- Use cva for component variants (shadcn/ui pattern)
- One line per responsive breakpoint

**DON'T:**
- Store Tailwind classes in constants (except cva)
- Separate dark variants from base state
- Over-segment into too many lines
- Use single long unorganized string
- Mix inline styles with Tailwind
- Ignore cn() when it's available
