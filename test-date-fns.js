// Test file to check date-fns v4 format function
const { format } = require('date-fns/format');
const { ko } = require('date-fns/locale/ko');

// Test format with locale
const date = new Date();
console.log('Format with locale:', format(date, 'yyyy-MM-dd', { locale: ko }));

// Test format without locale
console.log('Format without locale:', format(date, 'yyyy-MM-dd'));