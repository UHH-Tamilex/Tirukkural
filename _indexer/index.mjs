import NeedlemanWunsch from './needlemanwunsch.mjs';
import Fs from 'fs';
import Path from 'path';
import Process from 'process';
import Jsdom from 'jsdom';

const CONCATRIGHT = Symbol.for('concatright');
const CONCATLEFT = Symbol.for('concatleft');

const prepText = (doc) => {

    const text = doc.querySelector('text body div lg');
    const textclone = text.cloneNode(true);
    for(const choice of textclone.querySelectorAll('choice'))
        choice.lastChild.remove();
    return textclone.textContent.replaceAll(/[\n\s]+/g,' ');
};

const prepWordEntry = (entry) => {
    entry = entry.cloneNode(true);
    const form = entry.querySelector('form');
    const simpleform = entry.querySelector('form[type="simple"]');
    const particle = entry.querySelector('gramGrp[type="particle"] form, gramGrp[type="particle"] m');
    const affix = entry.querySelector('gramGrp[type="affix"]');
    const ret = {
        clean: cleanText(form).replaceAll('(u)',"'"),
        form: form.textContent,
        def: entry.querySelector(':scope > def').textContent
    };
    if(simpleform) ret.simple = cleanText(simpleform).replaceAll(/[~+]/g,'')
                                                     .replaceAll('(u)',"'");
    if(particle) ret.particle = particle.textContent;
    if(affix) ret.affix = {
        form: affix.querySelector('form, m').textContent,
        role: affix.querySelector('gram[type="role"]')?.textContent || null
    };
    return ret;
};

const prepWordsplits = (standOff) => {
    const entries = standOff.querySelectorAll(':scope > entry, :scope > superEntry');
                          //.querySelectorAll('entry');
    const wordsplits = [[],[]];
    for(const entry of entries) {
        if(entry.nodeName === 'superEntry') {
            if(entry.getAttribute('type') === 'ambiguous') {
                const options = [...entry.querySelectorAll('entry entry')].map(prepWordEntry);
                const ret = {
                    clean: options[0].clean,
                    options: options
                };
                wordsplits[0].push(ret);
                wordsplits[1].push(ret);
            }
            else {
                for(const subentry of entry.querySelectorAll('entry[select="0"] entry'))
                    wordsplits[0].push(prepWordEntry(subentry));
                for(const subentry of entry.querySelectorAll('entry[select="1"] entry'))
                    wordsplits[1].push(prepWordEntry(subentry));
            }
        }
        else {
            wordsplits[0].push(prepWordEntry(entry));
            wordsplits[1].push(prepWordEntry(entry));
        }
    }
    return wordsplits;
};

const cleanText = (node) => {
    const clone = node.cloneNode(true);
    for(const note of clone.querySelectorAll('note'))
        note.remove();
    for(const gap of clone.querySelectorAll('gap')) {
        const q = gap.getAttribute('quantity');
        const textnode = clone.ownerDocument.createTextNode('‡'.repeat(q));
        gap.replaceWith(textnode);
    }
    return clone.textContent.replaceAll(/[\n\s]/g,'');
};

const primaryWits = ['C1','C2','C3','C4','C5','C6','C7','C8','C9','NL','G1','G2','G3','RK','VP','ER'];

const correctedWits = primaryWits.map(s => `#${s}c`);

const revisedWits = primaryWits.map(s => `#${s}v`);

const addGaps = (text, gaps) => {
    const ret = [...text];
    for(const gap of gaps)
        ret.splice(ret.length-gap+1,0,'');
    return ret;
};

const alignVariants = (doc,alignment) => {
    let textarr = alignment.text;
    let wordsplitarr = alignment.strand0;
    const variants = doc.querySelector('standOff[type="apparatus"] listApp')
                        ?.querySelectorAll('app');
    if(!variants) return [textarr, wordsplitarr, []];

    const fullypositive = true;
    const ret = [];

    const witnames = new Set();
    let varsplit = Array(textarr.length).fill('');
    for(const variant of variants) {
        const corresp = variant.getAttribute('corresp');
        if(!corresp) continue;

        const [start,end] = corresp.split(',');

        const lemel = variant.querySelector('lem');
        const lem = cleanText(lemel);
        const lemwits = lemel.getAttribute('wit').split(' ').map(s => {
            if(correctedWits.includes(s))
                return s.slice(0,-1) + 'v';
            return s;
        });
        for(const wit of lemwits) witnames.add(wit);

        const newstart = realPos(textarr,start);
        const newend = realPos(textarr,end);
        let curlength = newend - newstart;
        let textslice = textarr.slice(newstart,newend);
        let splitslice = wordsplitarr.slice(newstart,newend);
        let readings = [];
        for(const rdg of variant.querySelectorAll('rdg')) {
            
            const rdgtext = cleanText(rdg);
            const witnesses = rdg.getAttribute('wit').split(' ').map(s => {
                if(correctedWits.includes(s))
                    return s.slice(0,-1) + 'v';
                return s;
            });
            for(const wit of witnesses) witnames.add(wit);

            let rdgslice, gapsadded;
            [textslice,rdgslice,gapsadded] = NeedlemanWunsch(textslice,rdgtext);

            if(textslice.length > curlength) {
                for(let n=0;n<readings.length;n++) {
                    //let newr;
                    //[textslice,newr] = NeedlemanWunsch(textslice,readings[n].reading);
                    const newr = addGaps(readings[n].reading,gapsadded);
                    readings[n] = {witnesses: readings[n].witnesses, reading: newr};
                }
                //[textslice,splitslice] = NeedlemanWunsch(textslice,splitslice);
                splitslice = addGaps(splitslice,gapsadded);
            }
            readings.push({witnesses: witnesses, reading: rdgslice});
            curlength = textslice.length;
        }

        textarr = [...textarr.slice(0,newstart),
                   ...textslice,
                   ...textarr.slice(newend)];
        wordsplitarr = [...wordsplitarr.slice(0,newstart),
                        ...splitslice,
                        ...wordsplitarr.slice(newend)];
        ret.push({start: newstart, lemma: textslice, readings: readings, lemwits: lemwits});
    }
    
    const morerows = new Map();
    const witsort = [...witnames];
    witsort.sort();
    for(const witname of witsort) {
        let witrow;
        if(!fullypositive) witrow = Array(textarr.length).fill('');
        else witrow = [...textarr];
        for(const app of ret) {
            if(!fullypositive && app.readings.length !== 0 && app.lemwits.includes(witname)) {
                witrow = [...witrow.slice(0,app.start),
                          ...app.lemma,
                          ...witrow.slice(app.start + app.lemma.length)];
                continue;
            }

            for(const rdg of app.readings) {
                if(rdg.witnesses.includes(witname)) {
                    witrow = [...witrow.slice(0,app.start),
                              ...rdg.reading,
                              ...witrow.slice(app.start + rdg.reading.length)];
                }
                else if(revisedWits.includes(witname)) {
                    const unv = witname.slice(0,-1);
                    if(rdg.witnesses.includes(unv))
                        witrow = [...witrow.slice(0,app.start),
                                  ...rdg.reading,
                                  ...witrow.slice(app.start + rdg.reading.length)];
                }

            }
        }
        morerows.set(witname, witrow);
    }
    return [textarr,wordsplitarr,morerows];
};

const wordsplitscore = (a,b) => {
    const vowels = 'aāiīuūoōeē'.split('');
    if(a === ' ' || b === ' ') return -2;
    if(a === b) return 1;
    //if(['y','v'].includes(a) && b === '~') return 1; // is this needed?
    if(vowels.includes(a) && vowels.includes(b)) return -0.5;
    return -1;
};

const decodeRLE = (s) => {
    return s.replaceAll(/(\d+)([MLRG])/g, (_, count, chr) => chr.repeat(count));
};
const restoreAlignment = (textarr, wordsplits, rles) => {
    textarr = [...textarr];
    const newtextarr = [];
    for(const s of rles[0][0]) {
        switch (s) {
            case 'M': newtextarr.push(textarr.shift()); break;
            case 'G': newtextarr.push(''); break;
            case 'L': newtextarr.push(CONCATLEFT); break;
            case 'R': newtextarr.push(CONCATRIGHT);
        }
    }
    const strand0clean = wordsplits[0].reduce((acc,w) => acc.concat(w.clean.split('')),[]);
    const strand0arr = [];
    for(const s of rles[0][1]) {
        if(s === 'M') strand0arr.push(strand0clean.shift());
        else if(s === 'G') strand0arr.push('');
    }
    return {text: newtextarr, strand0: strand0arr};
    //TODO: do strand1
};

const go = (f/*, out*/) => {
    const str = Fs.readFileSync(f,{encoding: 'utf-8'});
    const dom = new Jsdom.JSDOM('');
    const parser = new dom.window.DOMParser();
    const doc = parser.parseFromString(str,'text/xml');

    let textwithspaces = prepText(doc);
    let textarr = textwithspaces.replaceAll(/\s/g,'').split('');
    const standOff = doc.querySelector('standOff[type="wordsplit"]');
    if(!standOff) return;

    const wordsplits = prepWordsplits(standOff);
    const rles = [...doc.querySelectorAll('interp[type="alignment"]')].map(r => r.textContent.split(',').map(rr => decodeRLE(rr))); 

    const alignment = restoreAlignment(textarr, wordsplits, rles);

    let variants, wordsplitarr;
    [textarr, wordsplitarr, variants] = alignVariants(doc,alignment);

    replaceSpaces(textarr, wordsplitarr, variants, textwithspaces);

    const words = makeWordlist(textarr,wordsplitarr,variants,wordsplits[0]/*,id,out*/);
    printWordlist(doc,words,f);
    //printAlignment(textarr,wordsplitarr,variants, out);

};

const replaceSpaces = (textarr, wordsplitarr, variants, textwithspaces) => {
    let m = 0;
    for(let n=0; n<textarr.length; n++) {
        if(textarr[n] === '' || textarr[n] === CONCATLEFT || textarr[n] === CONCATRIGHT)
            continue;
        if(textwithspaces[m] === ' ') {
            textarr.splice(n,0,' ');
            wordsplitarr.splice(n,0,'');
            for(const val of variants) val.splice(n,0,'');
            m = m + 1;
            n = n + 1;
        }
        m = m + 1;
    }
};

const printAlignment = (textarr,wordsplitarr,variants,filename) => {
    let out = '';
    out = out + `text,${concatAlignment(textarr)}\n`;
    out = out + `wordsplit,${concatAlignment(wordsplitarr)}\n`;
    for(const wit of primaryWits) {
        const row = variants.get(`#${wit}`);
        if(row && !variants.has(`#${wit}v`))
            variants.set(`#${wit}v`,row);
    }

    for(const [wit,row] of variants) {
        const concated = concatAlignment(row);
        out += `${wit.replace(/^#/,'')},${concated}\n`;
    }
    
    Fs.writeFileSync(filename,out);
};

const concatAlignment = (arr) => {
    return arr.map(s => {
        if(s === CONCATLEFT) {
            return '#';
        }
        else if(s === CONCATRIGHT) {
            return '$';
        }
        else return s;
    }).join(',');
};

const makeWordlist = (textarr,wordsplitarr,variants,wordsplits) => {
    const wordlist = wordsplits.map(w => w.def ? w : w.options[0]);
    let start = 0;
    const words = [];
    let wordlettercount = 0;
    for(let n=0;n<wordsplitarr.length;n++) {
        let end;
        let curword;
        if(wordsplitarr[n] === '')
            continue;
        else if(wordlist.length === 0) // if wordsplitarr has a period at the end
            break;
        else if(wordlist[0].clean && wordsplitarr[n] === wordlist[0].clean[wordlettercount]) {
            wordlettercount = wordlettercount + 1;
            if(wordlettercount < wordlist[0].clean.length) {
                continue;
            }
            curword = wordlist.shift();
            wordlettercount = 0;
            end = n + 1;
        }
        
        const simple = curword.particle ? 
            stripParticle(curword.clean,curword.particle) :
            curword.clean.replace(/-$/,'');
        const parts = simple.split('-');
        if(parts.length > 1) {
            const colloc = makeWord(curword,textarr,wordsplitarr,variants,start,end);

            let newstart = start;
            for(let m=0;m<parts.length;m++) {
                const newend = getEnd(wordsplitarr,newstart,parts[m]);
                const newword = {colloc: colloc};
                if(m === parts.length - 1) {
                    newword.particle = curword.particle;
                    newword.affix = curword.affix;
                }
                const ret = makeWord(newword,textarr,wordsplitarr,variants,newstart,newend);
                words.push(ret);
                newstart = newend + 1;
            }
        }
        else {
            const ret = makeWord(curword,textarr,wordsplitarr,variants,start,end);
            words.push(ret);
        }

        start = n+1;
    }
    return words;
};

const getEnd = (wordsplitarr,start,word) => {
    let wordlettercount = 0;
    for(let n=start;n<wordsplitarr.length;n++) {
        if(wordsplitarr[n] === '')
            continue;
        else if(wordsplitarr[n] === word[wordlettercount]) {
            wordlettercount = wordlettercount + 1;
            if(wordlettercount < word.length) {
                continue;
            }
            return n + 1;
        }
    }   
};

const makeWord = (word,textarr,wordsplitarr,variants,start,end) => {
    const cleanword = clipWord(wordsplitarr,textarr,start,end);
    
    if(textarr[start] === CONCATLEFT) start = start - 1;
    while(wordsplitarr[start] === '') start = start + 1;
    if(textarr[end] === CONCATRIGHT) end = end - 1;
    else while(wordsplitarr[end] === '') end = end + 1;
    // right now gaps on the left are discarded; gaps on the right are included
    
    const lemma = textarr.slice(start,end).map(c => {
        if(c === CONCATLEFT || c === CONCATRIGHT || c === ' ') return '';
        return c;
    }).join('');

    const context = findContext(textarr,start,end);
    
    const ret = {
        word: cleanword, 
        lemma: lemma, 
        context: context, 
        wit: [], 
        variants: new Map(), 
    };
    if(word.def) ret.def = word.def;
    if(word.simple) ret.simple = word.simple;
    if(word.particle) ret.particle = word.particle;
    if(word.affix) ret.affix = word.affix;
    if(word.colloc) ret.colloc = word.colloc;

    for(const [wit,row] of variants) {
        const vartext = row.slice(start,end).map(c => {
            if(c === CONCATLEFT || c === CONCATRIGHT) return '';
            return c;
        }).join('');
        if(vartext !== '' && vartext !== lemma) 
            ret.variants.set(wit,vartext);
        else if(vartext !== '') ret.wit.push(wit);
        // remove vartext !== '' for fully positive apparatus
    }

    return ret;
};

const stripParticle = (word, particle) => {
    const cleaned = word.replace(/-$/,'');
    if(particle === 'maṟṟu') {
        return cleaned.replace(/-?maṟṟu$|^maṟṟ[u*']?-?/,'');
    }
    
    return cleaned.replace(new RegExp(`-?[~+]?${particle}$`),'');
};

const getSandhiForm = (word, sandhiform, particle) => {
    const cleaned = sandhiform.replace(/[.-;,]$/,'');
    if(word === cleaned) return null;
    if(particle) {
        const clipped = stripParticle(cleaned,particle);
        //const clipped = cleaned.replace(new RegExp(`-[~+]?${particle}$`),'');
        if(word === clipped) return null;
        return clipped;
    }
    return cleaned;
};

const printEntry = (w,id,append='') => {
    const entry = `<entry${append}><form type="standard">${w.simple || w.word}</form>`;
    //const sandhi = w.sandhi !== w.word ? `<form type="sandhi">${w.sandhi}</form>` : '';
    const particle = w.particle ? `<gramGrp type="particle"><m>${w.particle}</m></gramGrp>` : '';
    const sandhiform = getSandhiForm(w.simple || w.word,w.lemma,w.particle);
    const sandhi = sandhiform ? `<form type="sandhi">${sandhiform}</form>` : '';
    const def =   w.def ? `<def xml:lang="en">${w.def}</def>`: '';
    const cit = `<cit><q corresp="${id}">${w.context}</q></cit>`;
    const affix = w.affix ? `<gramGrp type="affix"><m>${w.affix.form}</m>${w.affix.role ? '<gram type="role">'+w.affix.role+'</gram>' : ''}</gramGrp>` : '';
    let variants = '';
    if(w.variants.size !== 0) {
        const collated = collateVariants(w.variants);
        const filteredlemwits = w.wit.filter(w => primaryWits.includes(w.replace(/^#/,'')));
        variants = `<app corresp="${id}">` + 
            `<lem wit="${filteredlemwits.join(' ')}">${w.lemma}</lem>` + 
            [...collated].map(([variant,witnesses]) => {
                const filteredrdgwits = witnesses.reduce((acc, cur) => {
                    if(revisedWits.includes(cur) && acc.includes(cur.replace(/v$/,'')))
                        return acc;
                    else
                        acc.push(cur);
                    return acc;
                },[]);
                return `<rdg wit="${filteredrdgwits.join(' ')}">${variant}</rdg>`;
            }).join('') +
            '</app>';
    }
    const colloc = w.colloc ? printEntry(w.colloc,id,' type="colloc"') : '';
    return entry + sandhi + affix + particle + def + cit + variants + colloc + '</entry>';
};

const printWordlist = (doc, words, filename) => {
    const id = doc.querySelector('standOff').getAttribute('corresp');
    const title = doc.querySelector('titleStmt title').innerHTML;

    const entries = words.map(w => printEntry(w,id));
    const cleanid = id.replace(/^#/,'');
    const basename = Path.basename(filename);
    const witness = `<witness xml:id="${cleanid}" source="${basename}"><abbr>${cleanid}</abbr><expan>${title}</expan></witness>`;

    if(!Fs.existsSync('wordlists')) Fs.mkdirSync('wordlists');

    Fs.writeFileSync(`wordlists/${basename}`,`<?xml version="1.0" encoding="UTF-8"?><file>${witness}<body>${entries.join('')}</body></file>`);
};
const clipWord = (wordsplitarr, textarr, start, end) => {

    let newstart = start;
    /*
    for(let n=start;n<end;n++) {
        if(wordsplitarr[n] === '~' || wordsplitarr[n] === '+') {
            newstart = n + 1;
            break;
        }
        if(wordsplitarr[n] !== '' && wordsplitarr[n] !== ' ') {
            newstart = start;
            break;
        }
    }
    */
    for(let n=start; n<end; n++) {
        /*
        if(textarr[n] === CONCATLEFT) {
            newstart = n - 1;
            break;
        }
        */
        if(wordsplitarr[n] === '~' || wordsplitarr[n] === '+') {
            newstart = n + 1;
            break;
        }
        if(wordsplitarr[n] !== '')
            break;
    }    
    /*
    for(let n=end-1;n>start;n--) {
        if(wordsplitarr[n] === '~' || wordsplitarr[n] === '+')
            return [newstart, n];
        if(wordsplitarr[n] !== '' && wordsplitarr[n] !== ' ')
            return [newstart,end];
    }
    */
    let newend = end;
    for(let n=end-1; n>start; n--) {
        /*
        if(textarr[n] === CONCATRIGHT) {
            newend = n + 1;
            break;
        }
        */
        if(wordsplitarr[n] === '~' || wordsplitarr[n] === '+') {
            newend = n;
            break;
        }
        if(wordsplitarr[n] !== '')
            break;
    }

    //return [newstart, newend];
    const word = wordsplitarr.slice(newstart,newend).join('');

    return word//.replaceAll(/[.-]/g,'')
               .replaceAll("'",'u')
               .replaceAll('(i)','u');
};

const consonants = new Set('kṅcñṭṇtnpmyrlvḻḷṟṉ'.split(''));
const vowels = new Set('aāiīuūeēoō'.split(''));
const extendEnd = (arr,n) => {
    if(arr[n-1] === ' ') return n-1;
    if(arr[n-1] === '' || consonants.has(arr[n-1])) {
        for(let m=n;m<arr.length;m++) {
            if(arr[m] === '') continue;
            if(arr[m] === ' ') return m;
            if(!vowels.has(arr[m])) return m;
        }
    }
    return n;
};
const extendStart = (arr,n) => {
    if(vowels.has(arr[n])) {
        for(let m=n-1;m>0;m--) {
            if(arr[m] === '') continue;
            if(!consonants.has(arr[m])) return m+1;
        }
    }
    return n;
};

const findContext = (textarr, start, end) => {
    let newstart = 0;
    let breaks = 0;
    const joinText = (arr,n) => {
        const ret = arr.slice(newstart,n).map(c => {
            if(c === CONCATLEFT || c === CONCATRIGHT) return '';
            return c;
        });
        const hiend = extendEnd(ret,end-newstart);
        const histart = extendStart(ret,start-newstart);
        ret.splice(hiend,0,'</hi>');
        ret.splice(histart,0,'<hi>');
        return ret.join('');
    };

    for(let n=start;n>=0;n--) {
        if(textarr[n] === ' ') {
            breaks = breaks + 1;
            if(breaks === 2) {
                newstart = n+1;
                break;
            }
        }
    }
    breaks = 0;
    for(let n=end;n<textarr.length;n++) {
        if(textarr[n] === ' ') {
            breaks = breaks + 1;
            if(breaks === 2)
                //return textarr.slice(newstart,n).join('');
                return joinText(textarr,n);
        }
    }
    //return textarr.slice(newstart).join('');
    return joinText(textarr,textarr.length-1);
};

const collateVariants = (variants) => {
    const ret = new Map();
    for(const [wit, variant] of variants) {
        if(ret.has(variant))
            ret.get(variant).push(wit);
        else
            ret.set(variant,[wit]);
    }
    return ret;
};

const realPos = (arr,pos) => {
    let m = 0;
    let posint = parseInt(pos);
    for(let n=0;n<arr.length;n++) {
        if(m === posint) return n;
        if(arr[n] === '' || arr[n] === CONCATLEFT || arr[n] === CONCATRIGHT) continue;
        else m += 1;
    }
};
//go(process.argv[2],process.argv[3]);
go(process.argv[2]);
