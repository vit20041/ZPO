import os
D=os.path.dirname(os.path.abspath(__file__))

head=open(os.path.join(D,'head.html')).read()
tpls=open(os.path.join(D,'tpl_dcam.html')).read()+'\n'+open(os.path.join(D,'tpl_more.html')).read()+'\n'+open(os.path.join(D,'tpl_vzt.html')).read()
core=open(os.path.join(D,'core.js')).read().split('/*EXPORT*/')[0]
core2=open(os.path.join(D,'core2.js')).read()
js=open(os.path.join(D,'helpers.js')).read()+'\n'+open(os.path.join(D,'cards.js')).read()+'\n'+open(os.path.join(D,'stroje.js')).read()+'\n'+open(os.path.join(D,'sol.js')).read()+'\n'+open(os.path.join(D,'figures.js')).read().rstrip().rstrip('}')+open(os.path.join(D,'figures2.js')).read()+'\n}\n'+'\n'+open(os.path.join(D,'mods.js')).read()+'\n'+open(os.path.join(D,'lab.js')).read()+'\n'+open(os.path.join(D,'inside.js')).read()+'\n'+open(os.path.join(D,'faz.js')).read()+'\n'+open(os.path.join(D,'pole.js')).read()+'\n'+open(os.path.join(D,'engine.js')).read()
js=js.replace("/* ---------- start ---------- */","""document.addEventListener('click', e => { const a = e.target.closest('.toc a'); if (!a) return; e.preventDefault(); const t = document.getElementById(a.getAttribute('href').slice(1)); if (t) t.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); });
/* ---------- start ---------- */""")
html=head+tpls+'\n<script>\n'+core+'\n'+core2+'\n</script>\n<script>\n{\n'+js+'\n}\n</script>\n</body>\n</html>\n'
open(os.path.join(D,'..','index.html'),'w').write(html)
print('built',len(html))
