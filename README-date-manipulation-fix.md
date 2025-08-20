# Date Manipulation Exploit Fix

## Issue Description
There was a serious bug where users could manipulate their device date to get 20 more bait units each time they changed the date. This was possible because the app was using the local device date to track daily bait usage.

## Solution Implemented

### 1. Server-based Date Tracking
We've implemented a server-based date tracking system that uses Firebase's `serverTimestamp()` function instead of relying on the local device date. This prevents users from manipulating their device date to get more bait.

### 2. Key Changes Made

1. **Added Server Timestamp Import**
   - Added `serverTimestamp` to the Firebase imports

2. **Created Server Timestamp Document**
   - Added a `system/timestamp` document in Firestore that stores the server's current time
   - This document is updated when the app loads and periodically every 5 minutes

3. **Implemented Async Date Function**
   - Created `getTodayStr()` function that retrieves the date from the server
   - This function falls back to local date only if server date is unavailable

4. **Updated Bait Usage Tracking**
   - Modified all instances where bait usage is tracked to use the server date
   - Added server timestamp to all bait usage documents for verification

5. **Added Periodic Updates**
   - Implemented a mechanism to update the server timestamp periodically
   - This ensures the server date stays current and prevents manipulation

### 3. Technical Implementation Details

The solution uses a multi-layered approach:

1. **Server Timestamp Document**
   - A document at `system/timestamp` stores the current server time
   - This document is updated when the app loads and periodically

2. **Async Date Function**
   - `getTodayStr()` retrieves the date from the server timestamp
   - It handles various edge cases and provides fallbacks

3. **Cached Date Value**
   - The server date is cached to minimize Firestore reads
   - The cache is refreshed periodically

4. **Transaction-based Updates**
   - Server timestamp updates use transactions for atomic operations

5. **Consistent Date Format**
   - All dates are stored in YYYY-MM-DD format for consistency

### 4. Testing

The solution has been tested to ensure:
- Users cannot get more bait by changing their device date
- Legitimate bait usage still works correctly
- The app gracefully handles network issues or server unavailability

## Future Improvements

1. **Server-side Validation**
   - Consider implementing additional server-side validation for bait usage
   - This could include Cloud Functions to verify bait usage patterns

2. **Rate Limiting**
   - Implement rate limiting for bait usage to prevent abuse
   - This would add another layer of protection against exploitation

3. **Audit Logging**
   - Add more comprehensive logging for suspicious activity
   - This would help identify and address any new exploitation attempts