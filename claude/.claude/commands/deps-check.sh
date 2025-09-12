#!/bin/bash
# Command: /deps-check
# Description: Comprehensive dependency analysis - outdated, audit, unused imports, and update suggestions

echo "🔍 Starting comprehensive dependency analysis..."

# Check if we're in a Node.js project
if [ ! -f "package.json" ]; then
    echo "❌ Error: No package.json found"
    echo "💡 This command is designed for Node.js projects"
    exit 1
fi

# Check if pnpm is available (per CLAUDE.md guidelines)
if ! command -v pnpm >/dev/null 2>&1; then
    echo "❌ Error: pnpm not found"
    echo "💡 Install pnpm: npm install -g pnpm"
    exit 1
fi

echo "📊 Step 1: Checking for outdated dependencies..."
echo "============================================"

# Check outdated packages
if pnpm outdated 2>/dev/null; then
    echo "ℹ️ Use 'pnpm update' to update to latest compatible versions"
    echo "ℹ️ Use 'pnpm update --latest' to update to latest versions (may cause breaking changes)"
else
    echo "✅ All dependencies are up to date!"
fi

echo ""
echo "🔒 Step 2: Security audit..."
echo "============================="

# Security audit
AUDIT_OUTPUT=$(pnpm audit --json 2>/dev/null || echo '{"summary":{"total":0}}')
VULN_COUNT=$(echo "$AUDIT_OUTPUT" | jq -r '.summary.total // 0' 2>/dev/null || echo "0")

if [ "$VULN_COUNT" -gt 0 ]; then
    echo "⚠️ Found $VULN_COUNT security vulnerabilities"
    echo "🔧 Running 'pnpm audit --fix' to auto-fix..."
    pnpm audit --fix
else
    echo "✅ No security vulnerabilities found!"
fi

echo ""
echo "📍 Step 3: Analyzing bundle and unused dependencies..."
echo "==============================================="

# Check for unused dependencies (if depcheck is available)
if command -v depcheck >/dev/null 2>&1; then
    echo "🔍 Running depcheck for unused dependencies..."
    DEPCHECK_OUTPUT=$(depcheck --json 2>/dev/null || echo '{}')
    UNUSED_DEPS=$(echo "$DEPCHECK_OUTPUT" | jq -r '.dependencies[]? // empty' 2>/dev/null)
    UNUSED_DEV_DEPS=$(echo "$DEPCHECK_OUTPUT" | jq -r '.devDependencies[]? // empty' 2>/dev/null)
    
    if [ -n "$UNUSED_DEPS" ]; then
        echo "⚠️ Unused dependencies found:"
        echo "$UNUSED_DEPS" | sed 's/^/  - /'
        echo "💡 Consider removing with: pnpm remove [package-name]"
    fi
    
    if [ -n "$UNUSED_DEV_DEPS" ]; then
        echo "⚠️ Unused dev dependencies found:"
        echo "$UNUSED_DEV_DEPS" | sed 's/^/  - /'
        echo "💡 Consider removing with: pnpm remove -D [package-name]"
    fi
    
    if [ -z "$UNUSED_DEPS" ] && [ -z "$UNUSED_DEV_DEPS" ]; then
        echo "✅ No unused dependencies detected!"
    fi
else
    echo "💡 Install depcheck for unused dependency analysis: pnpm add -g depcheck"
fi

echo ""
echo "📊 Step 4: Package size analysis..."
echo "==================================="

# Analyze package sizes if bundle analyzer is available
if pnpm list webpack-bundle-analyzer >/dev/null 2>&1; then
    echo "📊 Webpack bundle analyzer available"
    echo "💡 Run 'pnpm build && npx webpack-bundle-analyzer dist/main.js' for detailed analysis"
elif pnpm list @rollup/plugin-analyzer >/dev/null 2>&1; then
    echo "📊 Rollup analyzer available"
    echo "💡 Add analyzer plugin to rollup config for bundle analysis"
else
    echo "💡 Consider adding bundle analyzer:"
    echo "  - For Webpack: pnpm add -D webpack-bundle-analyzer"
    echo "  - For Vite: pnpm add -D rollup-plugin-analyzer"
fi

echo ""
echo "🔍 Step 5: Import analysis (TypeScript/JavaScript)..."
echo "==============================================="

# Look for potentially problematic imports
if command -v rg >/dev/null 2>&1; then
    echo "Checking for import anti-patterns..."
    
    # Check for require() usage (forbidden per CLAUDE.md)
    REQUIRE_COUNT=$(rg "require\(" --type js --type ts -c 2>/dev/null | awk -F: '{sum += $2} END {print sum+0}')
    if [ "$REQUIRE_COUNT" -gt 0 ]; then
        echo "⚠️ Found $REQUIRE_COUNT require() statements (should use import)"
        echo "Files with require():"
        rg "require\(" --type js --type ts -l 2>/dev/null | sed 's/^/  - /'
    fi
    
    # Check for deep relative imports
    DEEP_IMPORTS=$(rg "from ['\"]\.\.(/\.\.){2,}" --type js --type ts -c 2>/dev/null | awk -F: '{sum += $2} END {print sum+0}')
    if [ "$DEEP_IMPORTS" -gt 0 ]; then
        echo "⚠️ Found $DEEP_IMPORTS deep relative imports (consider using @ paths)"
        echo "Files with deep imports:"
        rg "from ['\"]\.\.(/\.\.){2,}" --type js --type ts -l 2>/dev/null | sed 's/^/  - /'
    fi
    
    # Check for React default imports
    REACT_IMPORTS=$(rg "import React from" --type js --type ts -c 2>/dev/null | awk -F: '{sum += $2} END {print sum+0}')
    if [ "$REACT_IMPORTS" -gt 0 ]; then
        echo "⚠️ Found $REACT_IMPORTS React default imports (prefer specific imports)"
    fi
    
    if [ "$REQUIRE_COUNT" -eq 0 ] && [ "$DEEP_IMPORTS" -eq 0 ] && [ "$REACT_IMPORTS" -eq 0 ]; then
        echo "✅ Import patterns look good!"
    fi
else
    echo "💡 Install ripgrep for detailed import analysis: brew install ripgrep"
fi

echo ""
echo "📊 Step 6: Performance recommendations..."
echo "======================================="

# Check for performance optimization opportunities
PERF_SUGGESTIONS=()

# Check if using TypeScript without proper path mapping
if [ -f "tsconfig.json" ] && ! grep -q "baseUrl\|paths" tsconfig.json 2>/dev/null; then
    PERF_SUGGESTIONS+=("Consider adding TypeScript path mapping for cleaner imports")
fi

# Check for large node_modules
NODE_MODULES_SIZE=$(du -sh node_modules 2>/dev/null | cut -f1 || echo "unknown")
if [ "$NODE_MODULES_SIZE" != "unknown" ]; then
    echo "Node modules size: $NODE_MODULES_SIZE"
    # If size is very large, suggest optimizations
    if [[ "$NODE_MODULES_SIZE" =~ [0-9]+G ]]; then
        PERF_SUGGESTIONS+=("Consider using pnpm for better disk space efficiency")
    fi
fi

# Check for missing production optimizations
if [ -f "package.json" ]; then
    if ! grep -q "NODE_ENV.*production" package.json 2>/dev/null; then
        PERF_SUGGESTIONS+=("Ensure NODE_ENV=production is set for production builds")
    fi
fi

if [ ${#PERF_SUGGESTIONS[@]} -gt 0 ]; then
    echo "🚀 Performance suggestions:"
    for suggestion in "${PERF_SUGGESTIONS[@]}"; do
        echo "  - $suggestion"
    done
else
    echo "✅ Performance setup looks good!"
fi

echo ""
echo "🎆 Dependency Analysis Complete!"
echo "===================================="
echo "📊 Summary of findings above"
echo "🔧 Recommended actions:"
echo "  1. Review and update outdated dependencies"
echo "  2. Fix any security vulnerabilities"
echo "  3. Remove unused dependencies to reduce bundle size"
echo "  4. Fix import anti-patterns for better maintainability"
echo "  5. Consider performance optimizations"
echo ""
echo "💡 Pro tip: Run this check regularly to maintain a healthy codebase!"

# Cleanup any temporary files
rm -f /tmp/deps-check-*