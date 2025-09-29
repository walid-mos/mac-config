# Naming Conventions (MANDATORY)

## File Naming Standards

### Components (React/Astro/Vue/etc.) → **PascalCase**
Component name AND file name must both use PascalCase:
- ✅ **Examples**: `UserProfile.tsx`, `NavigationBar.astro`, `LoadingSpinner.vue`
- ❌ **Wrong**: `userProfile.tsx`, `navigation-bar.astro`, `loading_spinner.vue`

### Pages (Next.js/Astro/Nuxt/etc.) → **kebab-case**
Page file names should use kebab-case:
- ✅ **Examples**: `user-profile.tsx`, `about-us.astro`, `contact-form.vue`
- ❌ **Wrong**: `UserProfile.tsx`, `aboutUs.astro`, `contact_form.vue`

## Variable Naming Standards

### Variables (including const) → **camelCase**
All variables, including constants, should use camelCase:
- ✅ **Examples**: `const userName`, `let isActive`, `const userPreferences`
- ❌ **Wrong**: `const user_name`, `let IsActive`, `const UserPreferences`

### Global Constants → **UPPER_CASE**
Only truly global constants should use UPPER_CASE with underscores:
- ✅ **Examples**: `const API_BASE_URL`, `const MAX_RETRIES`, `const DEFAULT_TIMEOUT`
- ❌ **Wrong**: `const apiBaseUrl`, `const maxRetries`, `const default-timeout`

## Function Naming Standards

### Functions → **camelCase**
All functions should use camelCase and be descriptive:
- ✅ **Examples**: `fetchUserData`, `validateEmailFormat`, `calculateTotalPrice`
- ❌ **Wrong**: `fetch_user_data`, `ValidateEmailFormat`, `calc-total`

### Event Handlers → **handle + Action**
Event handlers should follow the "handle + Action" pattern:
- ✅ **Examples**: `handleClick`, `handleFormSubmit`, `handleUserLogin`
- ❌ **Wrong**: `onClick`, `submitForm`, `userLogin`

## Class and Interface Naming

### Classes → **PascalCase**
Classes should use PascalCase and be nouns:
- ✅ **Examples**: `UserService`, `DatabaseConnection`, `EmailValidator`
- ❌ **Wrong**: `userService`, `database_connection`, `email-validator`

### Interfaces → **PascalCase** (with or without 'I' prefix)
Interfaces should use PascalCase. The 'I' prefix is optional but be consistent:
- ✅ **Examples**: `User`, `IUser`, `DatabaseConfig`, `IDatabaseConfig`
- ❌ **Wrong**: `userInterface`, `user_config`, `database-interface`

### Types → **PascalCase**
Type aliases should use PascalCase:
- ✅ **Examples**: `UserRole`, `ApiResponse`, `ConfigOption`
- ❌ **Wrong**: `userRole`, `api_response`, `config-option`

## Boolean Variables

Boolean variables should be descriptive and start with is/has/can/should:
- ✅ **Examples**: `isLoading`, `hasPermission`, `canEdit`, `shouldUpdate`
- ❌ **Wrong**: `loading`, `permission`, `edit`, `update`

## Array and Collection Naming

Arrays and collections should use plural nouns:
- ✅ **Examples**: `users`, `products`, `errorMessages`
- ❌ **Wrong**: `userList`, `productArray`, `errorMessageCollection`

## Consistency Rules

1. **Be consistent within the same file/module**
2. **Use descriptive names over short abbreviations**
   - ✅ `userPreferences` over `userPrefs`
   - ✅ `calculateTotal` over `calcTot`
3. **Avoid misleading names**
   - ❌ Don't use `data` or `info` for specific types
   - ✅ Use specific names like `userData`, `configInfo`
4. **Use searchable names for important functions and variables**
   - ✅ `PAYMENT_GATEWAY_TIMEOUT` over `TIMEOUT`
   - ✅ `validateUserEmail` over `validate`

## Language-Specific Conventions

### TypeScript/JavaScript
- Use camelCase for variables and functions
- Use PascalCase for classes, interfaces, and types
- Use UPPER_CASE for module-level constants

### CSS/SCSS
- Use kebab-case for class names: `.user-profile`, `.navigation-menu`
- Use camelCase for CSS custom properties: `--primaryColor`, `--fontSize`

### Database
- Use snake_case for table names: `user_profiles`, `order_items`
- Use snake_case for column names: `first_name`, `created_at`

## Validation Checklist

Before committing code, verify:
- [ ] Component files use PascalCase
- [ ] Page files use kebab-case
- [ ] Variables use camelCase
- [ ] Global constants use UPPER_CASE
- [ ] Boolean variables are descriptive (is/has/can/should)
- [ ] Names are searchable and descriptive
- [ ] Consistent convention is used throughout the file/module