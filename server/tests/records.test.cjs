const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseImport, student, book, classify, bookIdentity, csvText } = require('../lib/records');
const { defaults, normalizeLayout } = require('../lib/fieldSchema');
const { bookSearchClause, bookSearchArgs, coreSearchFields, describeBookMatch } = require('../lib/bookSearch');
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
test('book stock is a positive whole number and edition identity prefers ISBN',()=>{
  const a=book({accession_no:'a',title:'Title',isbn:'978-1-23',cost:'12.50',pages:20,total_copies:4});
  assert.equal(a.accession_no,'A');assert.equal(a.cost,12.5);assert.equal(a.total_copies,4);assert.equal(classify('books',{...a,cost:'12.50'},a),'duplicate');
  assert.equal(classify('books',a,{...a,title:'Changed'}),'conflict');
  assert.equal(bookIdentity(a),bookIdentity({...a,isbn:'978 1 23',accession_no:'OTHER'}));
  assert.equal(book({accession_no:'b',title:'Default stock'}).total_copies,1);
  for(const values of [{pages:-1},{pages:1.2},{cost:-10},{cost:'NaN'},{cost:'1.001'},{total_copies:0},{total_copies:1.5}])assert.throws(()=>book({...a,...values}));
});
test('custom layout fields can be deleted but built-in fields cannot',()=>{
  const base=defaults('students');const custom={key:'custom_delete01',label:'Temporary',core:false,type:'text',required:false,showInForm:true,showInTable:true,width:'half',archived:false,options:[],aliases:[]};
  const withCustom=normalizeLayout('students',[...base,custom],base);
  assert.equal(normalizeLayout('students',base,withCustom).some(field=>field.key===custom.key),false);
  assert.throws(()=>normalizeLayout('students',base.filter(field=>field.key!=='name'),base),/built-in/);
});
test('book search describes matches across core and custom fields',()=>{
  const layout={fields:[...defaults('books'),{key:'custom_barcode1',label:'Barcodes',core:false,type:'text',required:false,showInForm:true,showInTable:true,width:'half',archived:false,options:[],aliases:[]}]};
  const row={title:'Searchable Book',author_name:'Author Name',custom_data:JSON.stringify({custom_barcode1:'15915s, 15916s'})};
  assert.equal(bookSearchArgs('Author').length,14);
  assert.deepEqual(describeBookMatch(row,'15916s',layout),{key:'custom_barcode1',label:'Barcodes',value:'15915s, 15916s'});
  assert.deepEqual(describeBookMatch(row,'Search',layout),{key:'title',label:'Title',value:'Searchable Book'});
});
test('book search SQL covers every core field and custom data',()=>{
  const clause=bookSearchClause('b');
  for(const field of coreSearchFields)assert.match(clause,new RegExp(`b\\.${field}`));
  assert.match(clause,/b\.custom_data/);
  assert.equal((clause.match(/\?/g)||[]).length,bookSearchArgs('orwell').length);
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
