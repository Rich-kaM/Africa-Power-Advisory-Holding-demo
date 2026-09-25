const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let nodemailer; try { nodemailer = require('nodemailer'); } catch { nodemailer = null; }

const root = __dirname;
const port = Number(process.env.PORT || 3000);
const dataDir = path.resolve(process.env.CHAT_DATA_DIR || path.join(root, 'data'));
fs.mkdirSync(dataDir, { recursive: true });
const sessionFile = path.join(dataDir, 'chat-sessions.json');
const rateFile = new Map();
const mime = {
  '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.json':'application/json; charset=utf-8',
  '.webmanifest':'application/manifest+json','.ico':'image/x-icon'
};

function readSessions(){ try{return JSON.parse(fs.readFileSync(sessionFile,'utf8'));}catch{return {}} }
function writeSessions(v){ fs.writeFileSync(sessionFile, JSON.stringify(v,null,2), {mode:0o600}); }
function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));}
function body(req){return new Promise((resolve,reject)=>{let b='';req.on('data',c=>{b+=c;if(b.length>200000) req.destroy();});req.on('end',()=>{try{resolve(b?JSON.parse(b):{});}catch(e){reject(e);}});req.on('error',reject);});}
function id(){return crypto.randomUUID();}
function now(){return new Date().toISOString();}
function clientIp(req){return (req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim();}
function limited(req,key,limit=30,windowMs=60000){const k=key+':'+clientIp(req);const t=Date.now();const a=rateFile.get(k)||[];const fresh=a.filter(x=>t-x<windowMs);fresh.push(t);rateFile.set(k,fresh);return fresh.length>limit;}
function safeEqual(a,b){if(!a||!b)return false;const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);}
function agentAuth(req){const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');return safeEqual(token,process.env.AGENT_DASHBOARD_TOKEN);}
function agents(){try{return JSON.parse(fs.readFileSync(path.join(root,'content/agents.json'),'utf8')).agents||[];}catch{return [];}}
function onlineAgents(){const s=readSessions();const t=Date.now();return agents().filter(a=>s[`agent:${a.id}`]&&t-s[`agent:${a.id}`].lastSeen<45000);}
function cleanText(v,max=4000){return String(v??'').trim().slice(0,max);}
function transcript(session){return session.messages.map(m=>`${m.role==='visitor'?'Visitor':m.role==='agent'?'Agent':'APAH AI'}: ${m.text}`).join('\n');}

async function sendOfflineEmail(session){
  if(!nodemailer || !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.APAH_AGENT_EMAIL) return false;
  const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:Number(process.env.SMTP_PORT||587)===465,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
  const info=[
    `APAH website visitor handoff`,
    `Session: ${session.id}`,
    `Started: ${session.createdAt}`,
    `Last page: ${session.pageVisits.at(-1)?.path||'unknown'}`,
    '',
    'Visitor intake:', JSON.stringify(session.profile,null,2),
    '', 'Pages visited:', session.pageVisits.map(p=>`${p.at} — ${p.path}`).join('\n') || 'None',
    '', 'Conversation:', transcript(session)
  ].join('\n');
  await transport.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to:process.env.APAH_AGENT_EMAIL,subject:`New website visitor handoff — ${session.profile.name||'Visitor'}`,text:info});
  return true;
}

const aiInstructions=`You are the APAH website visitor concierge for Africa Power Advisory Holding. Be warm, professional, concise and helpful. Use only company information contained in the visitor-facing site; do not invent clients, projects, credentials, statistics, pricing, availability or contact details. Your main job is to understand a new visitor's business need and prepare a qualified handoff to a human agent. Progressively collect, without interrogating the visitor all at once: name, email, organization, role, country/region, service or industry of interest, project stage, desired timing, optional budget range, preferred contact method, and a clear description of the request. Ask only for information that is still missing and explain why it helps. Never ask for passwords, payment details, national ID, health information, religion, ethnicity or other unnecessary sensitive data. If the visitor asks for a human, offer handoff immediately. If they ask whether an agent is available, say the system will check. Do not claim a human is online unless the server tells you so. At the end of a useful intake, invite the visitor to request a human agent.`;

async function aiReply(session){
  if(!process.env.OPENAI_API_KEY) return `Thanks. I can collect your project details and prepare them for an APAH energy advisor. What is your name, organization, country or region, and what energy need would you like to discuss?`;
  const messages=session.messages.slice(-16).map(m=>({role:m.role==='visitor'?'user':'assistant',content:m.text}));
  const context=`\nVisitor profile collected so far:\n${JSON.stringify(session.profile)}\nRecent pages visited:\n${session.pageVisits.slice(-10).map(p=>p.path).join(', ')}`;
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5.6-luna',instructions:aiInstructions+context,input:messages,max_output_tokens:500})});
  if(!r.ok) throw new Error(`AI provider returned ${r.status}`);
  const data=await r.json();
  return cleanText(data.output_text||data.output?.flatMap(x=>x.content||[]).map(x=>x.text||'').join(' ')||'I can help collect your request for an APAH advisor. Please tell me what you would like to discuss.',1500);
}

function fileFor(urlPath){
  let clean=decodeURIComponent(urlPath.split('?')[0]);
  if(clean==='/') clean='/fr/';
  if(clean.endsWith('/')) clean+='index.html';
  return path.join(root,clean);
}
function errorPage(lang,code){return path.join(root,lang,`${code}.html`);}

const server=http.createServer(async(req,res)=>{
  try{
    if(req.url.startsWith('/api/')) return await api(req,res);
    let p=req.url.split('?')[0];
    const blocked = p.startsWith('/data/') || p === '/content/agents.json' || p.startsWith('/docs/') || p.startsWith('/scripts/') || p === '/.env' || p === '/.env.example';
    if(blocked) return sendError(res,p.startsWith('/en/')?'en':'fr',403);
    let file=fileFor(p);
    if(!file.startsWith(root + path.sep) && file !== root) return sendError(res,'fr',403);
    if(fs.existsSync(file)&&fs.statSync(file).isFile()){
      const ext=path.extname(file);res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream','Cache-Control':ext==='.html'?'no-cache':'public, max-age=86400','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});return fs.createReadStream(file).pipe(res);
    }
    return sendError(res,p.startsWith('/en/')?'en':'fr',404);
  }catch(e){console.error('server error',e.message);return sendError(res,'fr',500);}
});

async function api(req,res){
  if(limited(req,req.url,60)) return json(res,429,{error:'Too many requests. Please try again shortly.'});
  const u=new URL(req.url,'http://localhost');
  if(req.method==='POST'&&u.pathname==='/api/chat/session'){
    const b=await body(req), session={id:id(),createdAt:now(),updatedAt:now(),status:'ai',assignedAgent:null,profile:{},pageVisits:[],messages:[],consent:Boolean(b.consent)};
    if(!session.consent)return json(res,400,{error:'Chat consent is required.'});
    session.pageVisits.push({path:cleanText(b.path,500),at:now()});const s=readSessions();s[session.id]=session;writeSessions(s);return json(res,201,{sessionId:session.id,message:'Chat session created'});
  }
  if(req.method==='POST'&&u.pathname==='/api/chat/visit'){
    const b=await body(req),s=readSessions(),session=s[b.sessionId];if(!session)return json(res,404,{error:'Session not found'});session.pageVisits.push({path:cleanText(b.path,500),at:now()});session.updatedAt=now();writeSessions(s);return json(res,200,{ok:true});
  }
  if(req.method==='POST'&&u.pathname==='/api/chat/message'){
    const b=await body(req),s=readSessions(),session=s[b.sessionId];if(!session)return json(res,404,{error:'Session not found'});const text=cleanText(b.text,2500);if(!text)return json(res,400,{error:'Message required.'});session.messages.push({role:'visitor',text,at:now()});session.updatedAt=now();
    Object.entries(b.profile||{}).forEach(([k,v])=>{if(['name','email','organization','role','country','interest','stage','timeline','budget','contactMethod','request'].includes(k)&&v)session.profile[k]=cleanText(v,500);});
    if(session.status==='agent') {writeSessions(s);return json(res,200,{status:'agent',messages:session.messages.slice(-20)});}
    let reply;try{reply=await aiReply(session);}catch(e){console.error('AI error',e.message);reply='I can continue collecting your request and prepare it for an APAH advisor. Please share your name, organization and the energy topic you would like to discuss.';}
    session.messages.push({role:'ai',text:reply,at:now()});writeSessions(s);return json(res,200,{status:session.status,message:reply});
  }
  if(req.method==='POST'&&u.pathname==='/api/chat/profile'){
    const b=await body(req),s=readSessions(),session=s[b.sessionId];if(!session)return json(res,404,{error:'Session not found'});for(const [k,v] of Object.entries(b.profile||{})){if(['name','email','organization','role','country','interest','stage','timeline','budget','contactMethod','request'].includes(k)&&v)session.profile[k]=cleanText(v,500);}session.updatedAt=now();writeSessions(s);return json(res,200,{ok:true});
  }
  if(req.method==='POST'&&u.pathname==='/api/chat/handoff'){
    const b=await body(req),s=readSessions(),session=s[b.sessionId];if(!session)return json(res,404,{error:'Session not found'});for(const [k,v] of Object.entries(b.profile||{})){if(['name','email','organization','role','country','interest','stage','timeline','budget','contactMethod','request'].includes(k)&&v)session.profile[k]=cleanText(v,500);}
    const online=onlineAgents();
    if(online.length){const a=online[0];session.status='agent';session.assignedAgent=a.id;session.messages.push({role:'ai',text:`I’m connecting you with ${a.department||'an APAH advisor'} now. Please continue here while the advisor joins.`,at:now()});session.updatedAt=now();writeSessions(s);return json(res,200,{status:'agent',agent:{department:a.department}});}
    session.status='offline';session.updatedAt=now();writeSessions(s);let emailed=false;try{emailed=await sendOfflineEmail(session);}catch(e){console.error('handoff email error',e.message);}return json(res,200,{status:'offline',emailed,message:emailed?'No advisor is online right now. Your conversation has been sent to the APAH team for follow-up.':'No advisor is online right now. The conversation is saved for follow-up once the email service is configured.'});
  }
  if(req.method==='GET'&&u.pathname==='/api/chat/messages'){const s=readSessions(),session=s[u.searchParams.get('sessionId')];if(!session)return json(res,404,{error:'Session not found'});return json(res,200,{status:session.status,assignedAgent:session.assignedAgent,messages:session.messages.slice(-40)});}

  if(req.method==='POST'&&u.pathname==='/api/agent/heartbeat'){if(!agentAuth(req))return json(res,401,{error:'Unauthorized'});const b=await body(req),a=agents().find(x=>x.id===b.agentId);if(!a)return json(res,404,{error:'Agent not configured'});const s=readSessions();s[`agent:${a.id}`]={lastSeen:Date.now(),agentId:a.id};writeSessions(s);return json(res,200,{ok:true});}
  if(req.method==='GET'&&u.pathname==='/api/agent/sessions'){if(!agentAuth(req))return json(res,401,{error:'Unauthorized'});const s=readSessions();const list=Object.values(s).filter(x=>x.id&&['agent','offline'].includes(x.status)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,100).map(x=>({id:x.id,status:x.status,profile:x.profile,assignedAgent:x.assignedAgent,updatedAt:x.updatedAt,lastMessage:x.messages.at(-1)?.text||''}));return json(res,200,{sessions:list,agents:onlineAgents()});}
  if(req.method==='GET'&&u.pathname==='/api/agent/session'){if(!agentAuth(req))return json(res,401,{error:'Unauthorized'});const s=readSessions(),session=s[u.searchParams.get('sessionId')];if(!session)return json(res,404,{error:'Session not found'});return json(res,200,{session});}
  if(req.method==='POST'&&u.pathname==='/api/agent/message'){if(!agentAuth(req))return json(res,401,{error:'Unauthorized'});const b=await body(req),s=readSessions(),session=s[b.sessionId];if(!session)return json(res,404,{error:'Session not found'});const a=agents().find(x=>x.id===b.agentId);if(!a)return json(res,404,{error:'Agent not configured'});session.status='agent';session.assignedAgent=a.id;session.messages.push({role:'agent',text:cleanText(b.text,2500),at:now()});session.updatedAt=now();writeSessions(s);return json(res,200,{ok:true});}
  if(req.method==='POST'&&u.pathname==='/api/agent/claim'){if(!agentAuth(req))return json(res,401,{error:'Unauthorized'});const b=await body(req),s=readSessions(),session=s[b.sessionId];if(!session)return json(res,404,{error:'Session not found'});const a=agents().find(x=>x.id===b.agentId);if(!a)return json(res,404,{error:'Agent not configured'});session.status='agent';session.assignedAgent=a.id;session.updatedAt=now();writeSessions(s);return json(res,200,{ok:true});}
  return json(res,404,{error:'API route not found'});
}
function sendError(res,lang,code){const file=errorPage(lang,code);const body=fs.readFileSync(file);res.writeHead(code,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body);}
server.listen(port,()=>console.log(`APAH running at http://localhost:${port}`));
