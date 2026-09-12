const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseImport, student, book, classify, csvText } = require('../lib/records');
const { today, addDays, daysLate, fineAmount, policyFromRows } = require('../lib/policy');
test('workbook headers, title rows, BOM, and optional email', async () => {
  const text='\uFEFF,,,,,,,,\n,,,Required Student Data,,,,,\nSr #,Name ,Father Name,Registration No.,Department,Contact No.,Semester,Status ,Remarks ,Email\n1, Ali   Khan ,Father, fa24-001 ,CS,03001234567,1,active,First,ALI@example.edu\n';
  const [row]=await parseImport(Buffer.from(text),'students');
  assert.equal(row.data.registration_no,'FA24-001');assert.equal(row.data.name,'Ali Khan');assert.equal(row.data.contact_no,'03001234567');assert.equal(row.data.email,'ali@example.edu');assert.equal(row.row,4);
});
test('duplicate is composite identity, never a name alone',()=>{
  const a=student({name:'Ali Khan',registration_no:'A',email:'a@example.edu'});
  assert.equal(classify('students',a,student({...a,name:' ali   khan ',email:'A@EXAMPLE.EDU'})),'duplicate');
  assert.equal(classify('students',undefined,student({...a,registration_no:'B',email:'b@example.edu'})),'new');
  assert.equal(classify('students',a,student({...a,email:'b@example.edu'})),'conflict');
});
test('blank email is allowed and unrelated fields do not overwrite a duplicate',()=>{
  const a=student({name:'A',registration_no:'1',status:'Suspended',department:'CS'});
  assert.equal(a.email,'');assert.equal(classify('students',a,student({name:'A',registration_no:'1'})),'duplicate');
});
test('CSV quoted commas, escaped quotes, and multiline remarks',async()=>{
  const [r]=await parseImport(Buffer.from('name,registration_no,remarks\n"Ali, Khan",A,"Line 1\nSays ""hello"""'),'students');
  assert.equal(r.data.name,'Ali, Khan');assert.equal(r.data.remarks,'Line 1 Says "hello"');
});
test('bad rows have actionable results',async()=>{
  const rows=await parseImport(Buffer.from('Name,Registration No.,Email,Status\n,A,a@example.edu,Active\nA,B,bad,Active\nC,C,,Unknown\nD,D,,Active,extra'),'students');
  assert.equal(rows.length,4);assert(rows.every(r=>r.status==='invalid'));
});
test('malformed files are rejected before mutation',async()=>{
  for(const text of ['name,registration_no\n"Unclosed,A','name,registration_no,name\nA,B,C','nothing,here\nA,B','name,registration_no\n'])await assert.rejects(parseImport(Buffer.from(text),'students'));
  await assert.rejects(parseImport(Buffer.from([0xff,0xfe,0]),'students'));
});
test('10,000 row limit',async()=>{
  const text='name,registration_no\n'+Array.from({length:10001},(_,i)=>`Name,${i}`).join('\n');
  await assert.rejects(parseImport(Buffer.from(text),'students'),/10,000/);
});
test('book copies may share titles and ISBNs; invalid numbers are rejected',()=>{
  const a=book({accession_no:'a',title:'Title',isbn:'ISBN',cost:'12.50',pages:20});
  assert.equal(a.accession_no,'A');assert.equal(a.cost,12.5);assert.equal(classify('books',{...a,cost:'12.50'},a),'duplicate');
  assert.equal(classify('books',a,{...a,title:'Changed'}),'conflict');
  for(const values of [{pages:-1},{pages:1.2},{cost:-10},{cost:'NaN'},{cost:'1.001'}])assert.throws(()=>book({...a,...values}));
});
test('student validation preserves leading zeroes and permits matching names',()=>{
  assert.equal(student({name:'Same',registration_no:'001',contact_no:'00123'}).contact_no,'00123');
  assert.throws(()=>student({name:'Same',registration_no:'001',email:'wrong'}));
});
test('business date handles Pakistan midnight and leap dates',()=>{
  assert.equal(today(new Date('2026-09-11T19:30:00Z')),'2026-09-12');
  assert.equal(addDays('2028-02-28',1),'2028-02-29');assert.equal(daysLate('2026-09-11','2026-09-11'),0);assert.equal(daysLate('2026-09-11','2026-09-12'),1);
});
test('fine policy preserves zero and decimals',()=>{
  assert.equal(policyFromRows([{setting_key:'finePerDay',setting_value:'0'}]).finePerDay,0);assert.equal(fineAmount(3,12.25),36.75);
  assert.throws(()=>policyFromRows([{setting_key:'issueDays',setting_value:'0'}]));
});
test('CSV export quotes delimiters and neutralizes formulas',()=>{
  const csv=csvText(['Name','Remarks'],[['A, B','"quote"'],['=SUM(1,2)','line\nbreak']]);
  assert(csv.includes('"A, B"'));assert(csv.includes('""quote""'));assert(csv.includes("'=SUM"));
});
