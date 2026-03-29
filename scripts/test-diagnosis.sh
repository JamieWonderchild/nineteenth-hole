#!/bin/bash
# Test script for Corti Agentic Diagnosis API
#
# Prerequisites:
#   1. Start the dev server: npm run dev
#   2. Run this script: ./scripts/test-diagnosis.sh
#
# The script tests the /api/corti/diagnose endpoint with sample data

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "============================================================"
echo "CORTI AGENTIC DIAGNOSIS API TEST"
echo "============================================================"
echo ""
echo "Testing endpoint: $BASE_URL/api/corti/diagnose"
echo ""

# First, check the health endpoint
echo "1. Checking endpoint health..."
HEALTH=$(curl -s "$BASE_URL/api/corti/diagnose")
echo "   Response: $HEALTH"
echo ""

# Sample facts for a sick dog
echo "2. Sending diagnosis request..."
echo "   Patient: 7yo Labrador Retriever with vomiting"
echo ""

RESPONSE=$(curl -s -X POST "$BASE_URL/api/corti/diagnose" \
  -H "Content-Type: application/json" \
  -d '{
    "interactionId": "test-'$(date +%s)'",
    "facts": [
      {
        "id": "test-1",
        "text": "Species: canine",
        "group": "demographics",
        "groupId": "demographics",
        "isDiscarded": false,
        "source": "test",
        "createdAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "createdAtTzOffset": null,
        "updatedAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "updatedAtTzOffset": null,
        "evidence": []
      },
      {
        "id": "test-2",
        "text": "Breed: Labrador Retriever",
        "group": "demographics",
        "groupId": "demographics",
        "isDiscarded": false,
        "source": "test",
        "createdAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "createdAtTzOffset": null,
        "updatedAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "updatedAtTzOffset": null,
        "evidence": []
      },
      {
        "id": "test-3",
        "text": "Age: 7 years",
        "group": "demographics",
        "groupId": "demographics",
        "isDiscarded": false,
        "source": "test",
        "createdAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "createdAtTzOffset": null,
        "updatedAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "updatedAtTzOffset": null,
        "evidence": []
      },
      {
        "id": "test-4",
        "text": "Weight: 32 kg",
        "group": "demographics",
        "groupId": "demographics",
        "isDiscarded": false,
        "source": "test",
        "createdAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "createdAtTzOffset": null,
        "updatedAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "updatedAtTzOffset": null,
        "evidence": []
      },
      {
        "id": "test-5",
        "text": "Vomiting for 2 days",
        "group": "chief-complaint",
        "groupId": "chief-complaint",
        "isDiscarded": false,
        "source": "test",
        "createdAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "createdAtTzOffset": null,
        "updatedAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "updatedAtTzOffset": null,
        "evidence": []
      },
      {
        "id": "test-6",
        "text": "Decreased appetite",
        "group": "chief-complaint",
        "groupId": "chief-complaint",
        "isDiscarded": false,
        "source": "test",
        "createdAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "createdAtTzOffset": null,
        "updatedAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "updatedAtTzOffset": null,
        "evidence": []
      },
      {
        "id": "test-7",
        "text": "Lethargy noted by owner",
        "group": "history-of-present-illness",
        "groupId": "history-of-present-illness",
        "isDiscarded": false,
        "source": "test",
        "createdAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "createdAtTzOffset": null,
        "updatedAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "updatedAtTzOffset": null,
        "evidence": []
      },
      {
        "id": "test-8",
        "text": "Temperature: 39.8°C",
        "group": "vitals",
        "groupId": "vitals",
        "isDiscarded": false,
        "source": "test",
        "createdAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "createdAtTzOffset": null,
        "updatedAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "updatedAtTzOffset": null,
        "evidence": []
      },
      {
        "id": "test-9",
        "text": "Mild abdominal tenderness on palpation",
        "group": "physical-exam",
        "groupId": "physical-exam",
        "isDiscarded": false,
        "source": "test",
        "createdAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "createdAtTzOffset": null,
        "updatedAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "updatedAtTzOffset": null,
        "evidence": []
      },
      {
        "id": "test-10",
        "text": "Got into garbage 3 days ago per owner",
        "group": "past-medical-history",
        "groupId": "past-medical-history",
        "isDiscarded": false,
        "source": "test",
        "createdAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "createdAtTzOffset": null,
        "updatedAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "updatedAtTzOffset": null,
        "evidence": []
      }
    ],
    "patientInfo": {
      "species": "canine",
      "breed": "Labrador Retriever",
      "age": "7 years",
      "weight": 32,
      "weightUnit": "kg"
    },
    "consultationType": "sick-visit"
  }')

# Check if jq is available for pretty printing
if command -v jq &> /dev/null; then
  echo "$RESPONSE" | jq .
else
  echo "$RESPONSE"
fi

echo ""
echo "============================================================"
echo "TEST COMPLETE"
echo "============================================================"
