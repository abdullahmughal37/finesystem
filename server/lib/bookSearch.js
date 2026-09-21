const { clean } = require('./records');
const { customValues } = require('./fieldSchema');

const coreSearchFields = [
  'accession_no', 'title', 'author_name', 'call_no', 'isbn', 'publisher',
  'publish_year', 'pages', 'binding', 'source', 'cost', 'remarks', 'total_copies',
];

function bookSearchClause(alias = 'b') {
  const textFields = coreSearchFields.filter(key => !['pages', 'cost', 'total_copies'].includes(key));
  const numberFields = coreSearchFields.filter(key => ['pages', 'cost', 'total_copies'].includes(key));
  return `(${[
    ...textFields.map(key => `${alias}.${key} LIKE ?`),
    ...numberFields.map(key => `CAST(${alias}.${key} AS CHAR) LIKE ?`),
    `JSON_UNQUOTE(JSON_EXTRACT(${alias}.custom_data, '$.*')) LIKE ?`,
  ].join(' OR ')})`;
}

function bookSearchArgs(query) {
  const pattern = `%${clean(query)}%`;
  return Array(coreSearchFields.length + 1).fill(pattern);
}

function describeBookMatch(row, query, layout) {
  const needle = clean(query).toLowerCase();
  const values = {...customValues(row), ...row};
  const fields = layout.fields.filter(field => !field.archived && (field.core ? coreSearchFields.includes(field.key) : true));
  const exact = fields.find(field => clean(values[field.key]).toLowerCase() === needle);
  const prefix = fields.find(field => clean(values[field.key]).toLowerCase().startsWith(needle));
  const partial = fields.find(field => clean(values[field.key]).toLowerCase().includes(needle));
  const field = exact || prefix || partial;
  return field ? {key:field.key,label:field.label,value:clean(values[field.key])} : null;
}

function withoutInternalBookFields(row) {
  const {catalog_identity, ...safe} = row;
  return safe;
}

module.exports = {coreSearchFields,bookSearchClause,bookSearchArgs,describeBookMatch,withoutInternalBookFields};
