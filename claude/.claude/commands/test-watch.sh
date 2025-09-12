#!/bin/bash
# Command: /test-watch
# Description: Launch Vitest in watch mode with real-time coverage and smart filtering

echo "🧪 Starting Vitest in watch mode..."

# Check if we're in a project with Vitest
if [ ! -f "package.json" ]; then
    echo "❌ Error: No package.json found"
    exit 1
fi

# Check if Vitest is available
if ! pnpm list vitest >/dev/null 2>&1; then
    echo "❌ Error: Vitest not found in project dependencies"
    echo "💡 Install with: pnpm add -D vitest"
    exit 1
fi

# Options for enhanced watch mode
WATCH_OPTIONS=""

# Enable coverage if c8 or @vitest/coverage-* is available
if pnpm list @vitest/coverage-v8 >/dev/null 2>&1 || pnpm list @vitest/coverage-c8 >/dev/null 2>&1; then
    WATCH_OPTIONS="$WATCH_OPTIONS --coverage"
    echo "📊 Coverage reporting enabled"
fi

# Set up UI if available
if pnpm list @vitest/ui >/dev/null 2>&1; then
    echo "🎨 Vitest UI available at http://localhost:51204"
    WATCH_OPTIONS="$WATCH_OPTIONS --ui"
fi

# If specific test file or pattern provided as argument
if [ $# -gt 0 ]; then
    TEST_PATTERN="$1"
    echo "🎯 Watching tests matching: $TEST_PATTERN"
else
    TEST_PATTERN=""
    echo "👀 Watching all test files"
fi

echo "📝 Watch mode commands:"
echo "  a: run all tests"
echo "  f: run only failed tests"
echo "  u: update snapshots"
echo "  p: filter by filename"
echo "  t: filter by test name pattern"
echo "  q: quit"
echo ""
echo "🚀 Starting watch mode..."
echo ""

# Start Vitest in watch mode
exec pnpm vitest --watch $WATCH_OPTIONS $TEST_PATTERN