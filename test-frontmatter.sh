#!/bin/bash

# Frontmatter Feature Verification Script
echo "=== Unjucks Frontmatter Feature Verification ==="
echo

# Clean test outputs
echo "Cleaning previous test outputs..."
rm -rf test-outputs/*
echo

# Test 1: 'to' frontmatter option
echo "TEST 1: 'to' frontmatter option"
./dist/cli.mjs generate test validation/to-test.md --name "TestFile" --type "component" --dry
echo "Status: $?"
echo

# Test 2: skipIf with equality
echo "TEST 2: skipIf with equality (should skip)"
./dist/cli.mjs generate test validation/skipif-equal.md --name "skip" --dry
echo "Status: $?"
echo

echo "TEST 2b: skipIf with equality (should NOT skip)"
./dist/cli.mjs generate test validation/skipif-equal.md --name "generate" --dry
echo "Status: $?"
echo

# Test 3: skipIf with inequality
echo "TEST 3: skipIf with inequality (should skip)"
./dist/cli.mjs generate test validation/skipif-notequal.md --name "different" --dry
echo "Status: $?"
echo

echo "TEST 3b: skipIf with inequality (should NOT skip)"
./dist/cli.mjs generate test validation/skipif-notequal.md --name "keep" --dry
echo "Status: $?"
echo

# Test 4: skipIf with negation
echo "TEST 4: skipIf with negation (should skip when enabled=false)"
./dist/cli.mjs generate test validation/skipif-negation.md --name "test" --enabled false --dry
echo "Status: $?"
echo

echo "TEST 4b: skipIf with negation (should NOT skip when enabled=true)"
./dist/cli.mjs generate test validation/skipif-negation.md --name "test" --enabled true --dry
echo "Status: $?"
echo

# Test 5: chmod permissions
echo "TEST 5: chmod with octal string"
./dist/cli.mjs generate test validation/chmod-octal.sh --name "executable" --dry
echo "Status: $?"
echo

echo "TEST 6: chmod with number"
./dist/cli.mjs generate test validation/chmod-number.sh --name "readable" --dry
echo "Status: $?"
echo

echo "=== Tests Complete ==="