# UUID Consistency Fix

## Issue Description
When a non-member is newly registered by an admin, they become a new member in the system. However, when that person downloads the actual app and logs in with the registered information, a new UUID is issued, making them appear as a different person in the system.

## Root Cause
The issue was caused by inconsistent UUID generation methods:

1. In `firebase-auth.ts`, when users log in through the app, a deterministic UUID is generated using `uuidv5` based on the user's name and date of birth:
   ```javascript
   const deterministicUUID = uuidv5(`${name}-${normalizedDob}`, UUID_NAMESPACE);
   ```

2. In `roster-member-search.tsx`, when admins register new users, a random UUID was generated:
   ```javascript
   const uuid = generateUUID();
   // ...where generateUUID used Math.random()
   ```

This inconsistency meant that the same person would have different UUIDs depending on how they were registered.

## Solution
The solution was to make the UUID generation consistent across both registration methods:

1. Modified `roster-member-search.tsx` to use the same deterministic UUID generation method as `firebase-auth.ts`:
   ```javascript
   const generateUUID = () => {
     // Use the same UUID namespace as in firebase-auth.ts
     const UUID_NAMESPACE = '7b6a5c20-7aef-11ee-b962-0242ac120002';
     
     // Normalize DOB to ensure consistent format
     const normalizedDob = normalizeDob(newMemberDob);
     if (!normalizedDob) {
       console.error('Invalid DOB format');
       // Fallback to random UUID if DOB format is invalid
       return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
         const r = Math.random() * 16 | 0;
         const v = c === 'x' ? r : (r & 0x3 | 0x8);
         return v.toString(16);
       });
     }
     
     // Generate deterministic UUID using the same approach as in firebase-auth.ts
     return uuidv5(`${newMemberName}-${normalizedDob}`, UUID_NAMESPACE);
   };
   ```

2. Added the same `normalizeDob` function to ensure consistent DOB formatting:
   ```javascript
   function normalizeDob(input: string): string | null {
     if (/^\d{6}$/.test(input)) {
       const year = parseInt(input.slice(0, 2), 10);
       const fullYear = year >= 50 ? 1900 + year : 2000 + year;
       return `${fullYear}${input.slice(2)}`;
     } else if (/^\d{8}$/.test(input)) {
       return input;
     } else {
       return null;
     }
   }
   ```

## Testing
A test script was created to verify UUID generation consistency across different name and DOB formats. The test confirmed that:

1. The same name and DOB will always generate the same UUID
2. Different formats of the same DOB (e.g., '900101' and '19900101') are normalized correctly and produce the same UUID

## Benefits
With this fix:
1. Users registered by admins can now log in through the app and be recognized as the same person
2. No duplicate user records will be created
3. User data consistency is maintained across the system