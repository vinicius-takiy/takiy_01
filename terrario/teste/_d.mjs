import { Simulacao } from '../src/sim.js';
import { ANO } from '../src/agentes.js';
import { T } from '../src/mundo.js';
const sim = new Simulacao(Number(process.argv[2]||7));
let berco=null, melhor=-1;
for (let y=6;y<sim.mundo.n-6;y+=3) for (let x=6;x<sim.mundo.n-6;x+=3){let n=0;
 for(let dy=-8;dy<=8;dy+=2)for(let dx=-8;dx<=8;dx+=2){if(!sim.mundo.dentro(x+dx,y+dy))continue;
  const t=sim.mundo.terreno[sim.mundo.idx(x+dx,y+dy)]; if(t===T.FERTIL)n+=3;else if(t===T.GRAMA)n+=2;else if(t===T.FLORESTA)n+=2;}
 if(sim.mundo.andavel(x,y)&&n>melhor){melhor=n;berco={x,y};}}
for(let k=0;k<10;k++) sim.soltar('humano', berco.x+(sim.sorte()-.5)*5, berco.y+(sim.sorte()-.5)*5);
for(let k=0;k<26;k++) sim.soltar('rebanho', berco.x+(sim.sorte()-.5)*26, berco.y+(sim.sorte()-.5)*26);
for(let k=0;k<22;k++) sim.soltar('capivara', berco.x+(sim.sorte()-.5)*40, berco.y+(sim.sorte()-.5)*40);
for(let k=0;k<30;k++) sim.soltar('lebre', berco.x+(sim.sorte()-.5)*34, berco.y+(sim.sorte()-.5)*34);
for(let k=0;k<3;k++) sim.soltar('predador', berco.x+(sim.sorte()-.5)*40, berco.y+(sim.sorte()-.5)*40);
const dt=1/12; let ult=-1;
for(let p=0;p<Math.ceil(60*ANO/dt);p++){
  sim.tique(dt);
  if(sim.ano!==ult && sim.ano%5===0){ult=sim.ano;
    const r=sim.resumo(); const t=sim.tribos[0];
    const obras={}; for(const h of sim.humanos) if(h.viva){const k=h.obra||(h.alvo&&h.alvo.obra)||'nada';obras[k]=(obras[k]||0)+1;}
    console.log(`ano ${String(r.ano).padStart(3)} pess ${String(r.humanos).padStart(3)} cel ${t?t.celeiro.toFixed(0):'-'} /hab ${t?t.porHabitante.toFixed(1):'-'} roças ${t?t.plantios:'-'} ocas ${t?t.ocas.length:'-'} mad ${t?t.madeira.toFixed(0):'-'} | fome ${r.mortesPorFome} fera ${r.mortesPorPredador} fogo ${r.mortosNoFogo} raio ${r.mortosPorRaio} | ` + Object.entries(obras).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v])=>`${k}:${v}`).join(' '));
  }
  if(!sim.humanos.length){console.log('EXTINTO', sim.ano);break;}
}
