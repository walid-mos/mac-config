# /perf-check

Performance analysis: build time, bundle size, optimization suggestions, and performance metrics.

## Task

I'll perform comprehensive performance analysis of your project: measure build times, analyze bundle sizes, identify optimization opportunities, and provide actionable performance recommendations.

## Process

I'll execute this performance audit:

1. **Build Time Analysis**: Measure and profile build performance
2. **Bundle Size Analysis**: Analyze output bundle sizes and composition
3. **Code Splitting Review**: Evaluate code splitting effectiveness
4. **Asset Optimization**: Check image, font, and static asset optimization
5. **Runtime Performance**: Analyze potential runtime performance issues
6. **Optimization Recommendations**: Provide specific improvement suggestions

## Implementation Details

### Build Performance Measurement
```bash
# Time build process
time pnpm build

# Detailed build analysis with bundler-specific tools
# Vite build analysis
pnpm build --analyze

# Webpack bundle analyzer (if applicable)
npx webpack-bundle-analyzer dist/static/js/*.js
```

### Bundle Analysis Tools
- **Vite**: Built-in rollup-plugin-visualizer
- **Webpack**: webpack-bundle-analyzer
- **Rollup**: rollup-plugin-analyzer
- **Parcel**: Built-in bundle analyzer

### Performance Metrics Collection
- **Build Time**: Full build duration and incremental builds
- **Bundle Size**: Total size, gzipped size, and size by chunk
- **Tree Shaking**: Effectiveness of dead code elimination
- **Code Splitting**: Chunk distribution and loading patterns

## Expected Output

```
⚡ Starting performance analysis...

🏗️  Build Environment:
  Bundler: Vite 5.4.6
  Target: ES2020
  Mode: Production
  Source Maps: Yes

⏱️  Step 1/6: Build time analysis...
┌─────────────────────┬──────────────┬─────────────┐
│ Build Type          │ Duration     │ Performance │
├─────────────────────┼──────────────┼─────────────┤
│ Cold Build          │ 12.4s        │ Good        │
│ Incremental Build   │ 2.1s         │ Excellent   │
│ HMR Update          │ 156ms        │ Excellent   │
└─────────────────────┴──────────────┴─────────────┘

📦 Step 2/6: Bundle size analysis...
┌─────────────────────┬──────────┬───────────┬──────────┐
│ Asset               │ Size     │ Gzipped   │ Impact   │
├─────────────────────┼──────────┼───────────┼──────────┤
│ index.js            │ 245.7 KB │ 78.2 KB   │ High     │
│ vendor.js           │ 1.2 MB   │ 298.4 KB  │ Critical │
│ styles.css          │ 45.8 KB  │ 12.1 KB   │ Low      │
│ assets/*            │ 167.3 KB │ 134.2 KB  │ Medium   │
└─────────────────────┴──────────┴───────────┴──────────┘

🔄 Step 3/6: Code splitting analysis...
Code splitting effectiveness: 67%
Vendor chunk size: 1.2MB (⚠️  Too large)
Dynamic imports: 8 routes (✅ Good)
Lazy loading: 12 components (✅ Good)

🖼️  Step 4/6: Asset optimization...
Images: 23 files, 2.1MB total
  ⚠️  5 unoptimized images found (876KB potential savings)
  ✅ WebP format usage: 18/23 images
  ⚠️  Missing responsive images for 8 assets

Fonts: 4 files, 234KB total
  ✅ WOFF2 format used
  ⚠️  Preload missing for critical fonts

🚀 Step 5/6: Runtime performance check...
Potential performance issues found:
  ⚠️  Large component re-renders detected
  ⚠️  Inefficient list rendering in UserList component
  ✅ Memoization used appropriately
  ⚠️  Heavy computations in render cycle

💡 Step 6/6: Optimization recommendations...
Generated performance optimization report.
```

## Detailed Performance Reports

### Build Time Optimization
```
⏱️  Build Performance Analysis
═══════════════════════════════

Current Build Time: 12.4s
Target: <10s (Good), <5s (Excellent)

Bottlenecks Identified:
1. TypeScript compilation: 4.2s (34%)
   💡 Enable incremental compilation
   💡 Use ts-loader with cache

2. CSS processing: 2.8s (23%)
   💡 Enable CSS code splitting
   💡 Use PostCSS with cache

3. Asset processing: 3.1s (25%)
   💡 Optimize image compression pipeline
   💡 Enable asset caching

Optimization Commands:
# Enable TypeScript incremental builds
echo '{"compilerOptions": {"incremental": true}}' > tsconfig.json

# Vite optimization
pnpm add -D vite-plugin-checker
```

### Bundle Size Optimization
```
📦 Bundle Analysis Report
═══════════════════════════

Total Bundle Size: 1.7MB (456KB gzipped)
Target: <1MB total, <300KB gzipped

Largest Contributors:
1. react-dom (298KB) - Essential, optimized
2. @mui/material (445KB) - 🚨 Optimization needed
3. lodash (189KB) - 🚨 Remove/replace
4. chart.js (234KB) - Consider lighter alternative

Tree Shaking Issues:
• @mui/material: Importing entire library
  ❌ import { Button, TextField } from '@mui/material'
  ✅ import Button from '@mui/material/Button'

• lodash: Importing full library
  ❌ import _ from 'lodash'
  ✅ import { debounce } from 'lodash-es'

Size Optimization Commands:
# Enable better tree shaking
pnpm add -D unplugin-auto-import

# Alternative lightweight libraries
pnpm remove chart.js && pnpm add lightweight-charts
```

### Code Splitting Recommendations
```
🔄 Code Splitting Analysis
═════════════════════════

Current Strategy: Route-based (Good)
Improvement Opportunities:

1. Large Vendor Chunk (1.2MB)
   Split recommendation:
   • React ecosystem: ~400KB
   • UI library: ~300KB
   • Utilities: ~200KB
   • Charts/visualization: ~300KB

2. Component-level Splitting
   Large components to lazy load:
   • Dashboard component (89KB)
   • Chart components (156KB)
   • Settings panel (67KB)

Implementation:
// Vendor chunk splitting
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['@mui/material', '@mui/icons-material'],
          'chart-vendor': ['chart.js', 'react-chartjs-2']
        }
      }
    }
  }
})
```

### Asset Optimization Report
```
🖼️  Asset Optimization Analysis
═══════════════════════════════

Images (2.1MB total):
┌──────────────────────┬─────────┬─────────────┬─────────────┐
│ File                 │ Size    │ Optimized   │ Savings     │
├──────────────────────┼─────────┼─────────────┼─────────────┤
│ hero-bg.jpg          │ 456KB   │ 234KB       │ 222KB (49%) │
│ profile-pics/*.jpg   │ 1.2MB   │ 567KB       │ 633KB (53%) │
│ icons/*.png          │ 234KB   │ 89KB        │ 145KB (62%) │
└──────────────────────┴─────────┴─────────────┴─────────────┘

Optimization Commands:
# Optimize images with sharp
pnpm add -D @squoosh/lib vite-plugin-imagemin

# Convert to WebP
npx sharp-cli input/*.jpg --output output/ --format webp

# Generate responsive images
npx responsive-images-generator src/assets/images/*
```

### Runtime Performance Issues
```
🚀 Runtime Performance Analysis
══════════════════════════════

Performance Bottlenecks:

1. UserList Component (src/components/UserList.tsx:45)
   Issue: Rendering 1000+ items without virtualization
   Impact: High
   Solution: Implement virtual scrolling

   ❌ Current implementation:
   {users.map(user => <UserItem key={user.id} user={user} />)}

   ✅ Optimized with virtualization:
   <FixedSizeList height={400} itemCount={users.length} itemSize={60}>
     {UserItem}
   </FixedSizeList>

2. Dashboard Component (src/pages/Dashboard.tsx:123)
   Issue: Heavy calculations in render
   Impact: Medium
   Solution: Move to useMemo

   ❌ Current implementation:
   const stats = calculateComplexStats(data)

   ✅ Optimized with memoization:
   const stats = useMemo(() => calculateComplexStats(data), [data])

3. Search Component (src/components/Search.tsx:89)
   Issue: No debouncing on input
   Impact: Medium
   Solution: Implement debounced search
```

## Performance Monitoring Setup

### Performance Budgets
```json
// vite.config.js
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Enforce size limits
        chunkSizeWarningLimit: 500, // KB
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.js') && assetInfo.names.some(name => name.includes('vendor'))) {
            // Vendor chunks should be <300KB
            if (assetInfo.source.length > 300 * 1024) {
              console.warn(`Vendor chunk too large: ${assetInfo.name}`)
            }
          }
        }
      }
    }
  }
})
```

### Continuous Performance Monitoring
```bash
# Add to package.json scripts
{
  "scripts": {
    "perf:build": "time pnpm build",
    "perf:analyze": "pnpm build && npx vite-bundle-analyzer dist",
    "perf:lighthouse": "lighthouse http://localhost:3000 --output html",
    "perf:size": "bundlesize"
  }
}

# bundlesize configuration
{
  "bundlesize": [
    {
      "path": "./dist/assets/*.js",
      "maxSize": "300kb"
    }
  ]
}
```

This command provides comprehensive performance analysis and actionable optimization recommendations.