#!/bin/bash
set -e

BASE_URL="http://localhost:3000"
SERVER_PID=""

cleanup() {
    [ -n "$SERVER_PID" ] && kill $SERVER_PID 2>/dev/null && wait $SERVER_PID 2>/dev/null || true
}
trap cleanup EXIT

test() {
    echo -e "\033[0;33mtesting:\033[0m $1"
    TEST_NAME="$1"
}

pass() {
    echo -e "\033[0;32mPASS: $TEST_NAME\033[0m"
}

fail() {
    echo -e "\033[0;31mFAIL: $TEST_NAME\033[0m"
    exit 1
}

#
# setup
#

PORT=$PORT npm run start &
SERVER_PID=$!

for i in {1..30}; do
    curl -s "$BASE_URL/jobs" > /dev/null 2>&1 && break
    sleep 1 # wait for server to start
done

# 
# tests
# 

test "empty jobs list"
RESPONSE=$(curl -s "$BASE_URL/jobs")
echo -e "\033[0;33mresponse:\033[0m $RESPONSE"
[ "$RESPONSE" = "[]" ] && pass || fail

test "create and scrape job"
RESPONSE=$(curl -s -X POST "$BASE_URL/jobs" -H "Content-Type: application/json" -d '{"url":"https://example.com","fields":["title","heading"]}')
echo -e "\033[0;33mresponse:\033[0m $RESPONSE"
ID=$(echo "$RESPONSE" | grep -o '"id":[0-9]*' | grep -o '[0-9]*')
echo -e "\033[0;33mextracted ID:\033[0m $ID"
[ -n "$ID" ] && pass || fail

test "get job with data"
RESPONSE=$(curl -s "$BASE_URL/jobs/$ID")
echo -e "\033[0;33mresponse:\033[0m $RESPONSE"
echo "$RESPONSE" | grep -q "Example Domain" && pass || fail

test "list jobs"
RESPONSE=$(curl -s "$BASE_URL/jobs")
echo -e "\033[0;33mresponse:\033[0m $RESPONSE"
echo "$RESPONSE" | grep -q "$ID" && echo -e "\033[0;33mfound job ID $ID in list\033[0m" || echo -e "\033[0;33mjob ID $ID not found\033[0m"
echo "$RESPONSE" | grep -q "$ID" && pass || fail

test "delete job"
RESPONSE=$(curl -s -X DELETE "$BASE_URL/jobs/$ID")
echo -e "\033[0;33mresponse:\033[0m $RESPONSE"
echo "$RESPONSE" | grep -q '"success":true' && pass || fail

test "verify deletion"
RESPONSE=$(curl -s "$BASE_URL/jobs/$ID")
echo -e "\033[0;33mresponse:\033[0m $RESPONSE"
echo "$RESPONSE" | grep -q "not found" && pass || fail

test "error: invalid id"
RESPONSE=$(curl -s "$BASE_URL/jobs/invalid")
echo -e "\033[0;33mresponse:\033[0m $RESPONSE"
echo "$RESPONSE" | grep -q '"error"' && pass || fail

test "error: missing url and fields"
RESPONSE=$(curl -s -X POST "$BASE_URL/jobs" -H "Content-Type: application/json" -d '{}')
echo -e "\033[0;33mresponse:\033[0m $RESPONSE"
echo "$RESPONSE" | grep -q '"error"' && pass || fail

test "error: missing url"
RESPONSE=$(curl -s -X POST "$BASE_URL/jobs" -H "Content-Type: application/json" -d '{"fields":["title"]}')
echo -e "\033[0;33mresponse:\033[0m $RESPONSE"
echo "$RESPONSE" | grep -q '"error"' && pass || fail

test "error: missing fields"
RESPONSE=$(curl -s -X POST "$BASE_URL/jobs" -H "Content-Type: application/json" -d '{"url":"https://example.com"}')
echo -e "\033[0;33mresponse:\033[0m $RESPONSE"
echo "$RESPONSE" | grep -q '"error"' && pass || fail

echo
echo "all tests passed"
