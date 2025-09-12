// Test script to verify UUID generation consistency
const { v5: uuidv5 } = require('uuid');

// UUID namespace from firebase-auth.ts
const UUID_NAMESPACE = '7b6a5c20-7aef-11ee-b962-0242ac120002';

// Test cases with different name and DOB formats
const testCases = [
  { name: '홍길동', dob: '19900101' },
  { name: '김철수', dob: '900101' },
  { name: '이영희', dob: '20000101' },
  { name: '박지성', dob: '000101' }
];

// Function to normalize DOB (same as in firebase-auth.ts and roster-member-search.tsx)
function normalizeDob(input) {
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

// Test UUID generation
console.log('Testing UUID generation consistency:');
console.log('====================================');

testCases.forEach(({ name, dob }) => {
  const normalizedDob = normalizeDob(dob);
  
  console.log(`\nTest case: name="${name}", dob="${dob}"`);
  console.log(`Normalized DOB: ${normalizedDob}`);
  
  // Generate UUID using the same approach as in firebase-auth.ts
  const uuid = uuidv5(`${name}-${normalizedDob}`, UUID_NAMESPACE);
  
  console.log(`Generated UUID: ${uuid}`);
});

console.log('\n====================================');
console.log('Test completed. Verify that UUIDs are deterministic and consistent.');