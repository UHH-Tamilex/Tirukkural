import Fs from 'fs';
import Jsdom from 'jsdom';
import {tamilSplit} from '../lib/debugging/aligner.mjs';

const template = Fs.readFileSync('wordlist-template.xml',{encoding: 'UTF-8'});

const go = () => {
    Fs.readdir('wordlists',(err, files) => {
        if(err) return console.log(err);
        const flist = [];
        files.forEach(f => {
            if(/\.xml$/.test(f))
                flist.push('wordlists/'+f);
        });
        flist.sort((a,b) =>
            parseInt(a.replaceAll(/\D/g,'')) - parseInt(b.replaceAll(/\D/g,''))
        );

        readfiles(flist);
    });
};

const getInitial = (str) => {
    const ugh = new Set(['i','u']);
    if(str[0] === 'a' && ugh.has(str[1]))
        return str.slice(0,2);
    return str[0];
};

const readfiles = (arr) => {
     
    const words = new Map();
    const wits = [];

    for(const fname of arr)
        addWords(words,wits,fname);
    
    const wordgroups = new Map(
        [...order].reverse().map(s => [s,[]])
    );
    for(const [word, entry] of words) {
        const arr = wordgroups.get(getInitial(word));
        arr.push([word,entry]);
    }

    let out = template
        .replace('<!--witnesses-->',wits.join(''))
        .replace(/<\/TEI>/,'') + '<text xml:lang="ta"><body>';

    for(const [heading, entries] of [...wordgroups]) {
        if(entries.length === 0) continue;
        entries.sort(tamilSort2);
        const formatted = formatWords(entries);
        out = out + `<div><head>${heading}</head>${formatted}</div>`;
    }
    out = out + '</body>\n</text>\n</TEI>';

    Fs.writeFileSync('../wordindex.xml',out);
};

const order = [
    'a','ā','i','ī','u','ū','ṛ','ṝ','e','ē','ai','o','ō','au',
    'k','g','ṅ','c','j','ñ','ṭ','ṇ','t','n','p','m',
    'y','r','l','v',
    'ḻ','ḷ','ṟ','ṉ','ś','ṣ','h'
    ].reverse();
const ordermap = new Map();
for(const [i,v] of order.entries()) {
    ordermap.set(v,i);
}

const tamilSort2 = (a,b) => tamilSort(a[0],b[0]);

const tamilSort = (a,b) => {
    const aa = tamilSplit(a);
    const bb = tamilSplit(b);
    const minlen = Math.min(aa.length,bb.length);
    let n = 0;
    while(n < minlen) {
        const achar = aa[n];
        const bchar = bb[n];
        if(achar === bchar) {
            n++;
        } else {
            
            const aindex = ordermap.get(achar) || -1;
            const bindex = ordermap.get(bchar) || -1;
            return aindex < bindex ? 1 : -1;
            
            //return order.indexOf(achar) < order.indexOf(bchar);
        }
    }
    return aa.length > bb.length ? 1 : -1;
};

const formatWords = (words,append='') => {
    let ret = '';
    for(const [word, entry] of words) {
           ret += `<entry${append}>\n`;
           ret += `<form type="standard">${word}</form>\n`;
           const sandhis = [...entry.sandhis];
           sandhis.sort(tamilSort2);
           for(const sandhi of sandhis)
               ret += `<form type="sandhi">${sandhi}</form>`;
           const particles = [...entry.particles];
           particles.sort(tamilSort2);
           for(const particle of particles)
               ret += `<gram type="particle">${particle}</gram>`;
           for(const def of entry.defs)
               ret += `<def xml:lang="en">${def}</def>`;
           for(const cit of entry.cits)
               ret += cit.outerHTML;
           for(const app of entry.apps)
               ret += gapsEtc(app.outerHTML);
           if(entry.collocs.size) 
               ret += formatWords(entry.collocs,' type="colloc"');
           ret += '</entry>\n';
    }
    return ret;
};
const gapsEtc = (str) => {
    return str.replace(/‡+/g, match => 
        `<gap reason="lost" unit="character" quantity="${match.length}"/>`);
};

const addWords = (words, wits, fname) => {
    const str = Fs.readFileSync(fname,{encoding: 'utf-8'});
    const dom = new Jsdom.JSDOM('');
    const parser = new dom.window.DOMParser();
    const doc = parser.parseFromString(str,'text/xml');
    const entries = doc.querySelectorAll('body > entry');
    if(!entries) return;
    if(wits) wits.push(doc.querySelector('witness').outerHTML);

    for(const entry of entries)
        addEntry(words,entry);
};

const addEntry = (words,entry) => {
    const kids = {};
    for(const child of entry.children) {
        if(child.tagName === 'entry' && child.getAttribute('type') === 'colloc')
            kids.colloc = child;
        else if(child.tagName === 'form') {
            if(child.getAttribute('type') === 'standard')
                kids.word = child.textContent;
            else if(child.getAttribute('type') === 'sandhi')
                kids.sandhi = child;
        }
        else if(child.tagName === 'gramGrp' && child.getAttribute('type') === 'particle') {
            kids.particle = child.querySelector('form, m');
        }
        else if(child.tagName === 'def')
            kids.def = child;
        else if(child.tagName === 'app')
            kids.app = child;
        else if(child.tagName === 'cit')
            kids.cit = child;
    }
    let curentry = words.get(kids.word);
    if(!curentry) {
        curentry = {
            sandhis: new Set(),
            particles: new Set(),
            defs: new Set(),
            apps: [],
            cits: [],
            collocs: new Map()
        };
        words.set(kids.word, curentry);
    }

    if(kids.sandhi) curentry.sandhis.add(kids.sandhi.textContent);
    if(kids.particle) curentry.particles.add(kids.particle.textContent);
    if(kids.def) curentry.defs.add(kids.def.textContent);
    if(kids.app) curentry.apps.push(kids.app.cloneNode(true));
    if(kids.cit) curentry.cits.push(kids.cit.cloneNode(true));
    if(kids.colloc) addEntry(curentry.collocs,kids.colloc);
};

go();
