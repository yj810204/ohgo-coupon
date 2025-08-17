// 이름 중간을 '*'로 마스킹하는 함수 테스트

// 수정된 maskName 함수
const maskName = (name) => {
  if (!name) return name;
  
  if (name.length === 2) {
    // 이름이 2글자인 경우, 두 번째 글자를 '*'로 대체
    return name.charAt(0) + '*';
  } else if (name.length > 2) {
    // 이름이 3글자 이상인 경우, 첫 글자와 마지막 글자를 제외한 나머지를 '*'로 대체
    const firstChar = name.charAt(0);
    const lastChar = name.charAt(name.length - 1);
    const middleMask = '*'.repeat(name.length - 2);
    
    return firstChar + middleMask + lastChar;
  }
  
  // 이름이 1글자인 경우 그대로 반환
  return name;
};

// 테스트 케이스
const testCases = [
  { input: null, expected: null, description: "null 입력" },
  { input: "", expected: "", description: "빈 문자열" },
  { input: "김", expected: "김", description: "1글자 이름" },
  { input: "김철", expected: "김*", description: "2글자 이름" },
  { input: "김철수", expected: "김*수", description: "3글자 이름" },
  { input: "김철수박", expected: "김**박", description: "4글자 이름" },
  { input: "김철수박이", expected: "김***이", description: "5글자 이름" },
];

// 테스트 실행
console.log("maskName 함수 테스트 결과:");
console.log("=======================");

testCases.forEach((testCase, index) => {
  const result = maskName(testCase.input);
  const passed = result === testCase.expected;
  
  console.log(`테스트 ${index + 1}: ${testCase.description}`);
  console.log(`  입력: ${testCase.input === null ? 'null' : `"${testCase.input}"`}`);
  console.log(`  예상 결과: ${testCase.expected === null ? 'null' : `"${testCase.expected}"`}`);
  console.log(`  실제 결과: ${result === null ? 'null' : `"${result}"`}`);
  console.log(`  결과: ${passed ? '✅ 통과' : '❌ 실패'}`);
  console.log("---------------------");
});