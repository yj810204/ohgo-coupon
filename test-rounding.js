// Test the rounding logic
function testRounding(value) {
  const lastDigit = value % 10;
  const rounded = lastDigit >= 5 ? value + (10 - lastDigit) : value - lastDigit;
  return rounded;
}

// Test cases
const testCases = [663, 665, 660, 670, 671, 674, 675, 679, 1001, 999];

console.log('Testing point rounding logic:');
testCases.forEach(value => {
  console.log(`${value} -> ${testRounding(value)}`);
});