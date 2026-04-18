# Config: Tailwind Theme

**Export path**: `@nextnode-solutions/standards/tailwind`

## Project setup

Import in your main CSS file:

```css
@import 'tailwindcss';
@import '@nextnode-solutions/standards/tailwind';
```

The Tailwind theme implements the NextNode design system (colors, fonts, spacing). See `/nextnode-design` for the full brand guidelines (color palette, typography roles, logo usage).

---

# Config: editorconfig & npmrc

**Export paths**:
- `@nextnode-solutions/standards/editorconfig`
- `@nextnode-solutions/standards/npmrc`

These are static files. Copy them to your project root:

```bash
cp node_modules/@nextnode-solutions/standards/src/editorconfig/base.editorconfig .editorconfig
cp node_modules/@nextnode-solutions/standards/src/npmrc/base.npmrc .npmrc
```
