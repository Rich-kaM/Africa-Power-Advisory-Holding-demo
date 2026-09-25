
const fs=require('fs'), path=require('path');
const root=path.resolve(__dirname,'..');
const langs=['en','fr']; const files=[];
for(const lang of langs){
  for(const f of fs.readdirSync(path.join(root,lang)).filter(x=>x.endsWith('.html'))) files.push(path.join(root,lang,f));
}
let failures=[];
for(const f of files){
  const s=fs.readFileSync(f,'utf8');
  const rel=path.relative(root,f);
  if(!/<title>[^<]+<\/title>/.test(s)) failures.push(`${rel}: missing title`);
  if(!/<meta name="description" content="[^"]+"/.test(s)) failures.push(`${rel}: missing meta description`);
  if(!/<h1\b[^>]*>/.test(s)) failures.push(`${rel}: missing h1`);
  if(/href=["']#["']|href=["']["']|javascript:void\(0\)/.test(s)) failures.push(`${rel}: dead link pattern`);
  if(/\[(?:TO BE|TO BE SUPPLIED|TO BE VERIFIED)|lorem ipsum|John Doe|example\.com|\bTODO\b/.test(s)) failures.push(`${rel}: public placeholder pattern`);
  for(const m of s.matchAll(/href="(\/(?:en|fr)\/[^"#?]+\.html)"/g)){
    const target=path.join(root,m[1].replace(/^\//,''));
    if(!fs.existsSync(target)) failures.push(`${rel}: missing target ${m[1]}`);
  }
}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`QA static checks passed for ${files.length} HTML pages.`);
