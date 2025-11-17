# Tailwind CSS Guidelines

## Core Principles

### 1. ALWAYS Use Inline Utility Classes
Tailwind utility classes are the **primary styling method** in any project using Tailwind CSS.

**✅ CORRECT**:
```tsx
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-md">
  <span className="text-lg font-semibold text-gray-900">Title</span>
</div>
```

**⛔ FORBIDDEN**:
```tsx
// Never store Tailwind classes in constants
const cardStyles = "flex items-center justify-between p-4"
<div className={cardStyles}>  // FORBIDDEN
```

### 2. Custom CSS is FORBIDDEN (with exceptions)
Custom CSS should be avoided unless absolutely necessary.

**When Custom CSS is Permitted**:
- Styling is extremely complex and impossible with Tailwind
- Tailwind does not provide the necessary features (rare cases)
- Animations requiring `@keyframes` not available in Tailwind
- Complex pseudo-selectors not supported by Tailwind

**✅ CORRECT Exception**:
```css
/* Only when truly necessary */
@keyframes custom-bounce {
  0%, 100% { transform: translateY(-25%) rotate(10deg); }
  50% { transform: translateY(0) rotate(-10deg); }
}

.custom-complex-animation {
  animation: custom-bounce 1s ease-in-out infinite;
}
```

### 3. ONLY Exception: class-variance-authority (cva)

The **ONLY** library where storing Tailwind classes in constants is permitted is `class-variance-authority` (cva).

**✅ CORRECT - cva for Component Variants**:
```tsx
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  // Base classes
  "inline-flex items-center justify-center rounded-md font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-white hover:bg-primary/90",
        destructive: "bg-red-500 text-white hover:bg-red-600",
        outline: "border border-input bg-background hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
```

**Use Cases for cva**:
- shadcn/ui components
- Component libraries with multiple variants
- Complex variant combinations (size × color × state)
- Reusable components with consistent styling patterns

---

## cn() Utility Function

When a project includes the `cn()` utility function (typically combining `clsx` + `tailwind-merge`), it becomes the **MANDATORY** way to apply className.

### What is cn()?

```tsx
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Purpose**:
- `clsx`: Conditionally apply classes (handles strings, arrays, objects, booleans)
- `tailwind-merge`: Resolves Tailwind class conflicts (last one wins)

### Organization Domains (3 Logical Groups)

#### 1. Base/Global
Structural classes, colors, typography, layout

**Include dark: variants with their base state**:
```tsx
"bg-white dark:bg-gray-800"        // ✅ Together
"text-gray-900 dark:text-white"    // ✅ Together
```

**⛔ FORBIDDEN**:
```tsx
"bg-white",
"dark:bg-gray-800"  // ⛔ Separated
```

#### 2. Responsive
One line per breakpoint size: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`

```tsx
"md:p-6 md:rounded-xl lg:p-8 lg:shadow-xl"  // ✅ Grouped by breakpoint
```

**⛔ FORBIDDEN**:
```tsx
"md:p-6",
"md:rounded-xl",   // ⛔ Over-segmented
"lg:p-8",
"lg:shadow-xl"
```

#### 3. Variants/States
Modifiers grouped by type

**Dark modes WITH their base state**:
```tsx
"bg-white dark:bg-gray-800"
"hover:bg-blue-600 dark:hover:bg-blue-700"  // ✅ Both together
```

**Interactive states WITH dark variants**:
```tsx
"hover:shadow-lg dark:hover:shadow-xl"
"focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
```

**Pseudo-elements grouped**:
```tsx
"before:content-[''] before:absolute before:inset-0"
```

**Group states combined**:
```tsx
"group-hover:opacity-100 dark:group-hover:opacity-90"
```

#### 4. Conditional Logic
Ternaries and boolean conditions

```tsx
isActive && "bg-blue-500 dark:bg-blue-600 text-white"
isDisabled && "opacity-50 cursor-not-allowed"
variant === "primary" ? "bg-blue-500" : "bg-gray-500"
```

---

## Examples

### ✅ CORRECT Examples

#### Simple Component
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

#### Complex with Pseudo-elements
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

#### With Group Variants
```tsx
<div className="group relative">
  <div className={cn(
    "absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 blur-xl transition-all",
    "group-hover:opacity-20 dark:group-hover:opacity-30"
  )} />
  <div className={cn(
    "relative z-10 p-6 bg-white dark:bg-gray-900 rounded-lg shadow-lg",
    "transform transition-transform group-hover:scale-105"
  )}>
    Content
  </div>
</div>
```

#### Complex Conditional Logic
```tsx
<button className={cn(
  "px-4 py-2 rounded-md font-medium transition-all",
  "bg-blue-500 dark:bg-blue-600 text-white",
  "hover:bg-blue-600 dark:hover:bg-blue-700",
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
  size === "sm" && "px-3 py-1 text-sm",
  size === "lg" && "px-6 py-3 text-lg",
  variant === "outline" && "bg-transparent border-2 border-blue-500 text-blue-500 hover:bg-blue-50",
  isLoading && "opacity-50 cursor-wait",
  isDisabled && "opacity-50 cursor-not-allowed bg-gray-300"
)}>
  {isLoading ? "Loading..." : "Submit"}
</button>
```

#### Form Input with States
```tsx
<input
  className={cn(
    "w-full px-3 py-2 rounded-md border bg-white dark:bg-gray-800 text-gray-900 dark:text-white",
    "placeholder:text-gray-500 dark:placeholder:text-gray-400",
    "focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    hasError && "border-red-500 focus:ring-red-500"
  )}
/>
```

---

### ⛔ FORBIDDEN Examples

#### Single Long Unorganized String
```tsx
// ⛔ FORBIDDEN - Cannot scan or maintain
<div className={cn("flex items-center justify-between p-4 md:p-6 lg:p-8 dark:bg-gray-800 dark:text-white hover:shadow-lg focus:ring-2 bg-white rounded-lg shadow-md")}>
```

#### Over-segmentation
```tsx
// ⛔ FORBIDDEN - Too many lines, dark variants separated
<div className={cn(
  "flex items-center",
  "justify-between",
  "p-4",
  "bg-white",
  "dark:bg-gray-800",  // Don't separate dark from base
  "text-white",
  "dark:text-gray-100", // Don't separate dark from base
  "hover:shadow-lg",
  "dark:hover:shadow-xl" // Don't separate dark:hover from hover
)}>
```

#### Classes in Constants (outside cva)
```tsx
// ⛔ FORBIDDEN - Never store classes in constants
const baseClasses = "flex items-center"
const darkClasses = "dark:bg-gray-800"

<div className={cn(baseClasses, darkClasses, "p-4")}>
```

#### Not Using cn() When Available
```tsx
// ⛔ FORBIDDEN - Use cn() instead
<div className={`flex items-center ${isActive ? 'bg-blue-500' : 'bg-gray-200'}`}>

// ✅ CORRECT
<div className={cn(
  "flex items-center",
  isActive ? "bg-blue-500" : "bg-gray-200"
)}>
```

#### Inline Styles with Tailwind
```tsx
// ⛔ FORBIDDEN - Use Tailwind utilities
<div className="flex items-center" style={{ padding: '16px' }}>

// ✅ CORRECT
<div className="flex items-center p-4">
```

---

## When cn() is NOT Available

If `cn()` utility is not available in the project, use inline classes directly:

```tsx
// ✅ CORRECT (when cn() not available)
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-md">
  <span className="text-lg font-semibold text-gray-900">Title</span>
</div>

// For conditionals without cn()
<div className={`flex items-center ${isActive ? 'bg-blue-500' : 'bg-gray-200'}`}>
```

---

## Best Practices Summary

**DO**:
- ✅ Use Tailwind inline utilities as primary styling method
- ✅ Use `cn()` when available (mandatory)
- ✅ Group related classes logically (3 domains)
- ✅ Keep dark variants with their base state
- ✅ Use cva for component variants (shadcn/ui pattern)
- ✅ One line per responsive breakpoint
- ✅ Group pseudo-elements together

**DON'T**:
- ⛔ Store Tailwind classes in constants (except cva)
- ⛔ Separate dark variants from base state
- ⛔ Over-segment into too many lines
- ⛔ Use single long unorganized string
- ⛔ Mix inline styles with Tailwind
- ⛔ Ignore cn() when it's available

**WHY**:
- Maintains consistency across codebase
- Improves readability and scannability
- Prevents class conflicts (tailwind-merge)
- Follows industry best practices (shadcn/ui pattern)
- Easier to maintain and refactor
