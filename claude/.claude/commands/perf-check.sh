#!/bin/bash
# Command: /perf-check
# Description: Performance analysis - build time, bundle size, and optimization suggestions

echo "⚡ Starting performance analysis..."

# Check if we're in a Node.js project
if [ ! -f "package.json" ]; then
    echo "❌ Error: No package.json found"
    echo "💡 This command is designed for Node.js projects"
    exit 1
fi

# Check if pnpm is available
if ! command -v pnpm >/dev/null 2>&1; then
    echo "❌ Error: pnpm not found"
    echo "💡 Install pnpm per CLAUDE.md guidelines"
    exit 1
fi

echo "⏱️  Step 1: Build time analysis..."
echo "=================================="

# Check if build script exists
if grep -q '"build"' package.json; then
    echo "🔨 Measuring build time..."
    START_TIME=$(date +%s)
    
    if pnpm build >/tmp/build-output.log 2>&1; then
        END_TIME=$(date +%s)
        BUILD_TIME=$((END_TIME - START_TIME))
        
        echo "✅ Build completed successfully"
        echo "⏱️  Build time: ${BUILD_TIME}s"
        
        # Analyze build output for warnings
        if grep -q "warning" /tmp/build-output.log; then
            echo "⚠️  Build warnings detected:"
            grep "warning" /tmp/build-output.log | head -5
            echo "💡 Consider fixing warnings for optimal performance"
        fi
        
        # Performance thresholds
        if [ "$BUILD_TIME" -gt 60 ]; then
            echo "🐌 Build time is quite slow (>60s)"
            echo "💡 Consider optimization strategies"
        elif [ "$BUILD_TIME" -gt 30 ]; then
            echo "⚠️  Build time is moderate (>30s)"
            echo "💡 Room for improvement"
        else
            echo "🚀 Build time is good (<30s)"
        fi
    else
        echo "❌ Build failed"
        echo "🔍 Build errors:"
        tail -10 /tmp/build-output.log
        echo "💡 Fix build errors before performance analysis"
    fi
else
    echo "ℹ️  No build script found in package.json"
    echo "💡 Add a build script for build time analysis"
fi

echo ""
echo "📦 Step 2: Bundle size analysis..."
echo "=================================="

# Look for common build output directories
BUILD_DIRS=("dist" "build" "out" ".next" ".nuxt")
FOUND_BUILD_DIR=""

for dir in "${BUILD_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        FOUND_BUILD_DIR="$dir"
        break
    fi
done

if [ -n "$FOUND_BUILD_DIR" ]; then
    echo "📁 Analyzing build directory: $FOUND_BUILD_DIR"
    
    # Get total build size
    TOTAL_SIZE=$(du -sh "$FOUND_BUILD_DIR" 2>/dev/null | cut -f1)
    echo "📊 Total build size: $TOTAL_SIZE"
    
    # Analyze JavaScript bundles
    echo "🔍 JavaScript bundle analysis:"
    find "$FOUND_BUILD_DIR" -name "*.js" -type f -exec ls -lh {} \; | \
        awk '{print $5 " - " $9}' | sort -hr | head -10
    
    # Analyze CSS bundles
    if find "$FOUND_BUILD_DIR" -name "*.css" -type f | grep -q css; then
        echo "🎨 CSS bundle analysis:"
        find "$FOUND_BUILD_DIR" -name "*.css" -type f -exec ls -lh {} \; | \
            awk '{print $5 " - " $9}' | sort -hr | head -5
    fi
    
    # Look for source maps (should be disabled in production)
    SOURCE_MAPS=$(find "$FOUND_BUILD_DIR" -name "*.map" -type f | wc -l | tr -d ' ')
    if [ "$SOURCE_MAPS" -gt 0 ]; then
        echo "⚠️  Found $SOURCE_MAPS source map files"
        echo "💡 Consider disabling source maps in production for smaller bundle size"
    fi
    
    # Check for compression
    GZIP_FILES=$(find "$FOUND_BUILD_DIR" -name "*.gz" -type f | wc -l | tr -d ' ')
    BROTLI_FILES=$(find "$FOUND_BUILD_DIR" -name "*.br" -type f | wc -l | tr -d ' ')
    
    if [ "$GZIP_FILES" -gt 0 ]; then
        echo "✅ Gzip compression enabled ($GZIP_FILES files)"
    else
        echo "💡 Consider enabling Gzip compression"
    fi
    
    if [ "$BROTLI_FILES" -gt 0 ]; then
        echo "✅ Brotli compression enabled ($BROTLI_FILES files)"
    else
        echo "💡 Consider enabling Brotli compression for better compression"
    fi
else
    echo "ℹ️  No build directory found"
    echo "💡 Run build first or check build output directory"
fi

echo ""
echo "🔍 Step 3: Dependency impact analysis..."
echo "========================================"

# Analyze heavy dependencies
echo "📦 Top dependencies by size (estimated):"
if [ -d "node_modules" ]; then
    du -sh node_modules/*/ 2>/dev/null | sort -hr | head -10 | \
        while read size path; do
            package=$(basename "$path")
            echo "  $size - $package"
        done
    
    # Check for duplicate dependencies
    echo ""
    echo "🔍 Checking for potential duplicate dependencies..."
    DUPLICATES=$(find node_modules -name "node_modules" -type d | wc -l | tr -d ' ')
    if [ "$DUPLICATES" -gt 0 ]; then
        echo "⚠️  Found $DUPLICATES nested node_modules (potential duplicates)"
        echo "💡 pnpm should help reduce this, but check for version conflicts"
    else
        echo "✅ No nested node_modules detected (good!)"
    fi
else
    echo "ℹ️  No node_modules directory found"
    echo "💡 Run 'pnpm install' first"
fi

echo ""
echo "🚀 Step 4: Performance optimization suggestions..."
echo "================================================="

SUGGESTIONS=()

# Check for common performance issues
if [ -f "package.json" ]; then
    # Check for development dependencies in regular dependencies
    DEV_IN_DEPS=$(cat package.json | jq -r '.dependencies // {} | keys[]' 2>/dev/null | \
        grep -E "(webpack|babel|eslint|prettier|@types|typescript)" | wc -l | tr -d ' ')
    if [ "$DEV_IN_DEPS" -gt 0 ]; then
        SUGGESTIONS+=("Move development tools to devDependencies to reduce production bundle")
    fi
    
    # Check for missing production optimizations
    if ! grep -q "NODE_ENV" package.json 2>/dev/null; then
        SUGGESTIONS+=("Set NODE_ENV=production for production builds")
    fi
    
    # Check for tree shaking opportunities
    if grep -q "sideEffects.*false" package.json 2>/dev/null; then
        echo "✅ Tree shaking enabled (sideEffects: false)"
    else
        SUGGESTIONS+=("Enable tree shaking by setting 'sideEffects: false' in package.json")
    fi
fi

# Check for TypeScript configuration optimizations
if [ -f "tsconfig.json" ]; then
    if ! grep -q "skipLibCheck.*true" tsconfig.json 2>/dev/null; then
        SUGGESTIONS+=("Enable 'skipLibCheck: true' in tsconfig.json for faster builds")
    fi
    
    if ! grep -q "incremental.*true" tsconfig.json 2>/dev/null; then
        SUGGESTIONS+=("Enable 'incremental: true' in tsconfig.json for faster rebuilds")
    fi
fi

# Check for webpack/vite configuration files
BUNDLER_CONFIG=""
if [ -f "webpack.config.js" ] || [ -f "webpack.config.ts" ]; then
    BUNDLER_CONFIG="webpack"
elif [ -f "vite.config.js" ] || [ -f "vite.config.ts" ]; then
    BUNDLER_CONFIG="vite"
elif [ -f "rollup.config.js" ] || [ -f "rollup.config.ts" ]; then
    BUNDLER_CONFIG="rollup"
fi

if [ -n "$BUNDLER_CONFIG" ]; then
    echo "🔧 Using $BUNDLER_CONFIG bundler"
    case $BUNDLER_CONFIG in
        "webpack")
            SUGGESTIONS+=("Consider code splitting with dynamic imports")
            SUGGESTIONS+=("Enable webpack's SplitChunksPlugin for vendor chunking")
            SUGGESTIONS+=("Use webpack-bundle-analyzer for detailed bundle analysis")
            ;;
        "vite")
            SUGGESTIONS+=("Consider using Vite's built-in code splitting")
            SUGGESTIONS+=("Enable Vite's build optimizations for production")
            ;;
        "rollup")
            SUGGESTIONS+=("Use Rollup's code splitting features")
            SUGGESTIONS+=("Consider rollup-plugin-analyzer for bundle analysis")
            ;;
    esac
fi

# Runtime performance suggestions
if find . -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" | head -1 | grep -q .; then
    SUGGESTIONS+=("Use React.memo() for expensive component renders (if using React)")
    SUGGESTIONS+=("Implement virtualization for long lists")
    SUGGESTIONS+=("Use lazy loading for images and components")
    SUGGESTIONS+=("Consider service worker for caching strategies")
fi

# Display all suggestions
if [ ${#SUGGESTIONS[@]} -gt 0 ]; then
    echo "💡 Performance optimization suggestions:"
    for i in "${!SUGGESTIONS[@]}"; do
        echo "  $((i + 1)). ${SUGGESTIONS[i]}"
    done
else
    echo "✅ Performance configuration looks good!"
fi

echo ""
echo "📊 Step 5: Quick performance metrics..."
echo "======================================="

# Git repository size
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    REPO_SIZE=$(du -sh .git 2>/dev/null | cut -f1)
    echo "📁 Git repository size: $REPO_SIZE"
    
    # Check for large files in git
    LARGE_FILES=$(git ls-files | xargs -I {} ls -la {} 2>/dev/null | \
        awk '$5 > 1048576 {print $5/1048576 "MB - " $9}' | head -5)
    if [ -n "$LARGE_FILES" ]; then
        echo "⚠️  Large files in repository:"
        echo "$LARGE_FILES"
        echo "💡 Consider using Git LFS for large files"
    fi
fi

# Check for common performance files
PERF_FILES=(".nvmrc" ".node-version" "Dockerfile" "docker-compose.yml")
echo "🔍 Performance-related files:"
for file in "${PERF_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file (found)"
    else
        echo "  ➖ $file (not found)"
    fi
done

echo ""
echo "⚡ Performance Analysis Complete!"
echo "================================="
echo "📋 Summary:"
echo "  - Build time analysis completed"
echo "  - Bundle size analysis completed"
echo "  - Dependencies analyzed"
echo "  - ${#SUGGESTIONS[@]} optimization suggestions provided"
echo ""
echo "🎯 Next steps:"
echo "  1. Review and implement optimization suggestions"
echo "  2. Set up bundle analysis tools for ongoing monitoring"
echo "  3. Consider performance budgets for your project"
echo "  4. Monitor performance metrics in CI/CD pipeline"
echo ""
echo "🚀 Keep optimizing for better user experience!"

# Cleanup
rm -f /tmp/build-output.log