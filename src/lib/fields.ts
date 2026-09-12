export type CatalogKind = 'students' | 'books';
export type CatalogField = {key:string;label:string;core:boolean;type:string;required:boolean;showInForm:boolean;showInTable:boolean;width:'half'|'full';archived:boolean;options:string[];aliases:string[]};
export type CatalogLayout = {kind:CatalogKind;revision:number;fields:CatalogField[]};
export function recordValues(row:Record<string,any>) {
  let custom = row.custom_data || {};
  if (typeof custom === 'string') { try {custom=JSON.parse(custom);} catch {custom={};} }
  return {...custom,...row};
}
