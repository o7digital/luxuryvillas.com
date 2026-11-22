"""Run on the existing Luxury Villas host; secret values never leave that host."""
import base64,json,os,secrets,subprocess,sys
from pathlib import Path

ROOT=Path('/opt/o7/apps/luxuryvillas-olivia')
if Path.cwd()!=ROOT:raise SystemExit('Run only from the dedicated Luxury Villas deployment directory')
os.umask(0o077)
def read_env(name):
 return dict(line.split('=',1) for line in (ROOT/name).read_text().splitlines() if '=' in line and not line.lstrip().startswith('#'))
def write_env(name,values):
 path=ROOT/name;path.write_text(''.join(f'{key}={value}\n' for key,value in values.items()));path.chmod(0o600)
def sql(text):
 subprocess.run(['docker','exec','-i','luxuryvillas-olivia36-db','psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','luxuryvillas'],input=text.encode(),check=True,stdout=subprocess.DEVNULL)
phase=sys.argv[1]
if phase=='configure':
 gateway=read_env('.env')
 if not all(gateway.get(name) for name in ['GATEWAY_KEY','OLIVIA_EMAIL','OLIVIA_PASSWORD']):raise SystemExit('Dedicated gateway credentials missing')
 if not (ROOT/'.env.core').exists():
  source=json.loads(subprocess.check_output(['docker','inspect','olivia-v2']))[0]
  env=dict(item.split('=',1) for item in source['Config']['Env'] if '=' in item)
  provider=env.get('OPENAI_API_KEY')
  if not provider:raise SystemExit('Existing shared Olivia provider credential missing')
  app_password=secrets.token_urlsafe(40);worker_password=secrets.token_urlsafe(40)
  write_env('.env.db',{'POSTGRES_DB':'luxuryvillas','POSTGRES_USER':'postgres','POSTGRES_PASSWORD':secrets.token_urlsafe(40)})
  write_env('.env.core',{
   'DATABASE_URL':f'postgresql+psycopg://luxuryvillas_app:{app_password}@postgres:5432/luxuryvillas',
   'OPENAI_API_KEY':provider,'EMBEDDING_PROVIDER':'openai','EMBEDDING_MODEL':'text-embedding-3-small','EMBEDDING_DIMENSIONS':'1536',
   'JWT_SECRET':secrets.token_urlsafe(48),'VAULT_MASTER_KEY':base64.urlsafe_b64encode(secrets.token_bytes(32)).decode(),'BOOTSTRAP_KEY':secrets.token_urlsafe(48),
   'OPENAI_MODEL_FAST':'gpt-4.1-mini','OPENAI_MODEL_BALANCED':'gpt-4.1-mini','OPENAI_MODEL_POWERFUL':'gpt-4.1-mini',
   'CHAT_TIMEOUT_SECONDS':'45','CHAT_MAX_HISTORY_MESSAGES':'20','LOCAL_LLM_ENABLED':'false',
   'CHAT_SYSTEM_INSTRUCTIONS_FILE':'/app/site-instructions.txt','RAG_TOP_K':'3','RATE_LIMIT_PER_MINUTE':'60',
  })
  write_env('.env.worker',{'DATABASE_URL':f'postgresql+psycopg://luxuryvillas_worker:{worker_password}@postgres:5432/luxuryvillas'})
  path=ROOT/'.bootstrap.json';path.write_text(json.dumps({'app_password':app_password,'worker_password':worker_password,'owner_email':'luxuryvillas-owner@o7digitalgroup.com','owner_password':secrets.token_urlsafe(40)}));path.chmod(0o600)
 gateway['OLIVIA_API_URL']='http://core:8093';write_env('.env',gateway)
 print('Dedicated secrets configured privately; existing gateway key preserved.')
elif phase=='database':
 credentials=json.loads((ROOT/'.bootstrap.json').read_text())
 for role,key,bypass in [('luxuryvillas_app','app_password',''),('luxuryvillas_worker','worker_password','BYPASSRLS')]:
  password=credentials[key]
  sql(f"DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='{role}') THEN CREATE ROLE {role} LOGIN {bypass} PASSWORD '{password}'; END IF; END $$;")
 sql('CREATE EXTENSION IF NOT EXISTS vector; GRANT USAGE,CREATE ON SCHEMA public TO luxuryvillas_app; GRANT USAGE ON SCHEMA public TO luxuryvillas_worker;')
 print('Dedicated database roles and vector extension ready.')
elif phase=='isolate':
 sql("""DO $$ DECLARE row record; BEGIN FOR row IN SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='tenant_id' LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',row.table_name);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',row.table_name);
 IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname='public' AND tablename=row.table_name AND policyname='tenant_isolation') THEN
 EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))',row.table_name);
 END IF; END LOOP; END $$;
 GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO luxuryvillas_worker;
 GRANT USAGE,SELECT,UPDATE ON ALL SEQUENCES IN SCHEMA public TO luxuryvillas_worker;
 ALTER DEFAULT PRIVILEGES FOR ROLE luxuryvillas_app IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO luxuryvillas_worker;
 ALTER DEFAULT PRIVILEGES FOR ROLE luxuryvillas_app IN SCHEMA public GRANT USAGE,SELECT,UPDATE ON SEQUENCES TO luxuryvillas_worker;
 """)
 print('Forced tenant isolation and dedicated worker permissions installed.')
elif phase=='bootstrap':
 if (ROOT/'.bootstrapped').exists():print('Dedicated tenant already bootstrapped.');sys.exit(0)
 payload=json.loads((ROOT/'.bootstrap.json').read_text());payload.update(read_env('.env'));payload['knowledge']=(ROOT/'site-instructions.txt').read_text()
 script="""
import os,sys,json,urllib.request,urllib.error
p=json.load(sys.stdin)
def request(path,body,token=None,bootstrap=False):
 headers={'Content-Type':'application/json','X-Tenant-ID':'luxuryvillas'}
 if token:headers['Authorization']='Bearer '+token
 if bootstrap:headers['X-Bootstrap-Key']=os.environ['BOOTSTRAP_KEY']
 req=urllib.request.Request('http://localhost:8093'+path,data=json.dumps(body).encode(),headers=headers)
 try:return json.load(urllib.request.urlopen(req,timeout=50))
 except urllib.error.HTTPError as error:
  if error.code==409:return {'exists':True}
  raise
owner={'email':p['owner_email'],'password':p['owner_password']}
request('/v1/auth/bootstrap',owner,bootstrap=True)
token=request('/v1/auth/login',owner)['access_token']
request('/v1/auth/users',{'email':p['OLIVIA_EMAIL'],'password':p['OLIVIA_PASSWORD'],'role':'service'},token)
service=request('/v1/auth/login',{'email':p['OLIVIA_EMAIL'],'password':p['OLIVIA_PASSWORD']})['access_token']
request('/v1/documents/ingest',{'title':'Approved Luxury Villas information','content':p['knowledge'],'source':'https://www.luxuryvillasbylacasaquecanta.com/','metadata':{'site':'luxuryvillas','approved':True}},service)
print('Dedicated service identity and approved villa knowledge ready.')
"""
 result=subprocess.run(['docker','exec','-i','luxuryvillas-olivia36','python','-c',script],input=json.dumps(payload).encode(),check=True,capture_output=True)
 print(result.stdout.decode().strip());(ROOT/'.bootstrapped').write_text('Olivia 3.6 tenant initialized\n')
elif phase=='knowledge':
 script="""
import json
from pathlib import Path
from sqlalchemy import select,delete
from app.db import tenant_session
from app.models import Document,DocumentChunk,Audit
from app.embeddings import get_provider
from app.config import CHUNK_SIZE,CHUNK_OVERLAP
content=Path('/app/site-instructions.txt').read_text()
with tenant_session('luxuryvillas') as db:
 docs=list(db.scalars(select(Document).where(Document.tenant_id=='luxuryvillas',Document.title=='Approved Luxury Villas information',Document.source=='https://www.luxuryvillasbylacasaquecanta.com/')))
 if len(docs)!=1:raise SystemExit('Expected exactly one approved Luxury Villas document; no changes made')
 doc=docs[0]
 if doc.content==content:print('Approved Luxury Villas knowledge already current.');raise SystemExit(0)
 parts=[content[pos:pos+CHUNK_SIZE] for pos in range(0,len(content),CHUNK_SIZE-CHUNK_OVERLAP) if content[pos:pos+CHUNK_SIZE].strip()]
 vectors=get_provider().embed(parts)
 if len(vectors)!=len(parts):raise SystemExit('Embedding refresh incomplete; no changes made')
 db.execute(delete(DocumentChunk).where(DocumentChunk.tenant_id=='luxuryvillas',DocumentChunk.document_id==doc.id))
 for index,(part,vector) in enumerate(zip(parts,vectors)):
  db.add(DocumentChunk(tenant_id='luxuryvillas',document_id=doc.id,chunk_index=index,content=part,source=doc.source,metadata_json=doc.metadata_json,embedding=vector))
 doc.content=content
 db.add(Audit(tenant_id='luxuryvillas',action='document.refresh',metadata_json=json.dumps({'document_id':doc.id,'chunks':len(parts)})))
 db.commit()
print('Approved Luxury Villas knowledge refreshed; conversations preserved.')
"""
 subprocess.run(['docker','exec','luxuryvillas-olivia36','python','-c',script],check=True)
else:raise SystemExit('Unknown provisioning phase')
