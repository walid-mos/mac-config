---
name: tailwind
description: Tailwind CSS best practices and guidelines. Use when styling with Tailwind, discussing CSS organization, or reviewing class usage.
allowed-tools: Read
---

# Tailwind CSS Guidelines

Complete Tailwind CSS guidelines for consistent styling.

## Quick Rules

- **ALWAYS inline utility classes** - never store in constants
- **Custom CSS is FORBIDDEN** (except animations/complex pseudo-selectors)
- **cva is the ONLY exception** for storing classes
- **cn() is MANDATORY** when available
- **Keep dark: variants WITH base state** on same line
- **One line per responsive breakpoint**

## Core Pattern

```tsx
// CORRECT
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-md">
  <span className="text-lg font-semibold text-gray-900">Title</span>
</div>

// FORBIDDEN - Classes in constants
const cardStyles = "flex items-center justify-between p-4"
<div className={cardStyles}>
```

## cn() Organization (3 Domains)

### 1. Base/Global (dark: variants WITH base)
```tsx
"bg-white dark:bg-gray-800"        // Together
"text-gray-900 dark:text-white"    // Together

// FORBIDDEN
"bg-white",
"dark:bg-gray-800"  // Separated
```

### 2. Responsive (one line per breakpoint)
```tsx
"md:p-6 md:rounded-xl lg:p-8 lg:shadow-xl"
```

### 3. Variants/States
```tsx
"hover:bg-blue-600 dark:hover:bg-blue-700"
"focus:ring-2 focus:ring-blue-500"
```

## Correct Examples

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

```tsx
<button className={cn(
  "px-4 py-2 rounded-md font-medium transition-all",
  "bg-blue-500 dark:bg-blue-600 text-white",
  "hover:bg-blue-600 dark:hover:bg-blue-700",
  "focus:outline-none focus:ring-2 focus:ring-blue-500",
  size === "sm" && "px-3 py-1 text-sm",
  size === "lg" && "px-6 py-3 text-lg",
  isLoading && "opacity-50 cursor-wait"
)}>
  {isLoading ? "Loading..." : "Submit"}
</button>
```

## Forbidden Patterns

```tsx
// FORBIDDEN - Single long unorganized string
<div className={cn("flex items-center justify-between p-4 md:p-6 lg:p-8 dark:bg-gray-800 dark:text-white hover:shadow-lg focus:ring-2 bg-white rounded-lg shadow-md")}>

// FORBIDDEN - Over-segmentation
<div className={cn(
  "flex items-center",
  "justify-between",
  "p-4",
  "bg-white",
  "dark:bg-gray-800",  // Separated from base
)}>

// FORBIDDEN - Template literals without cn()
<div className={`flex ${isActive ? 'bg-blue-500' : 'bg-gray-200'}`}>

// FORBIDDEN - Inline styles
<div className="flex items-center" style={{ padding: '16px' }}>
```

## cva Exception

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

## Summary

| DO | DON'T |
|----|-------|
| Inline utilities | Store classes in constants |
| Use cn() always | Template literals |
| dark: with base state | Separate dark variants |
| One line per breakpoint | Over-segment into many lines |
| cva for variants | Mix inline styles |
