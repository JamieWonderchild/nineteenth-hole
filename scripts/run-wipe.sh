#!/bin/bash
set -e

echo "🚨 WARNING: This will DELETE ALL DATA from production!"
echo ""
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

export CONVEX_DEPLOYMENT="prod:charming-blackbird-181"

# Deploy the wipe function
echo "📤 Deploying wipe function..."
npx convex deploy --yes

# Run the wipe
echo "🗑️  Running wipe mutation..."
npx convex run wipe:wipeAllTables --prod

echo ""
echo "✅ Database wiped successfully!"
echo ""
echo "Next steps:"
echo "1. Go to Clerk dashboard: https://dashboard.clerk.com"
echo "2. Delete the 'Happy Paws Clinic' organization"
echo "3. Log out and log back into the app"
echo "4. Complete fresh onboarding"
