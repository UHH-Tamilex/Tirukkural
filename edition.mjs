import { Transliterate } from './lib/js/transliterate.mjs';
import { GitHubFunctions } from './lib/js/githubfunctions.mjs';
import { ApparatusViewer } from './lib/js/apparatus.mjs';
import { AlignmentViewer } from './lib/js/alignment.mjs';
import Splitter from './lib/debugging/splits.mjs';
import { addVariants } from './lib/debugging/variants.mjs';
import { Sanscript } from './lib/js/sanscript.mjs';
import './lib/js/tooltip.mjs';
//import { tamilize, iastToTamil } from './transliterate.mjs';

var Debugging = true;

const cachedContent = new Map();

const lookup = (e) => {
//if(e.target.nodeName === 'RT' || e.target.classList?.contains('word')) {
    const apointer = e.target.closest('.alignment-pointer');
    if(apointer) {
        e.preventDefault();
        AlignmentViewer.viewer(apointer.href);
        return;
    }

    const word = e.target.closest('.word');
    if(word) {
        //const clean = e.target.dataset.norm.trim();
        //const clean = word.querySelector('.anno-inline span').textContent;
        let clean = word.dataset.clean;
        if(!clean) {
            const clone = word.cloneNode(true);
            for(const pc of clone.querySelectorAll('.invisible, .ignored'))
                pc.remove();
            clean = Sanscript.t(clone.textContent.replaceAll('\u00AD',''),'tamil','iast');
        }
        //window.open(`https://dsal.uchicago.edu/cgi-bin/app/tamil-lex_query.py?qs=${clean}&amp;searchhws=yes&amp;matchtype=exact`,'lexicon',/*'height=500,width=500'`*/);
        window.open(`wordindex.xml#${clean}`);
    }
};

const cleanup = (doc) => {
    const breakup = doc.querySelectorAll('.word br');
    for(const b of breakup) {
        const next = b.nextSibling;
        const par = b.closest('.word');
        if(next) {
            const nextword = par.nextElementSibling;
            if(!nextword.dataset.norm) nextword.dataset.norm = visibleText(nextword);
            nextword.prepend(next);
        }
        par.after(b);
    }
};

const visibleText = (node) => {
    const clone = node.cloneNode(true);
    const walker = document.createTreeWalker(clone,NodeFilter.SHOW_ELEMENT);
    while(walker.nextNode()) {
        const cur = walker.currentNode;
        if(cur.classList.contains('anno-inline') || cur.style.display === 'none') cur.remove();
    }
    return clone.textContent;
};

const apparatusswitch = (e) => {
    const blocks = document.querySelectorAll('.wide');
    const target = document.getElementById('apparatusbutton');
    if(target.dataset.anno === 'apparatus of variants') {
        for(const block of blocks) {
            const trans = block.querySelector('.text-block.translation');
            if(trans) trans.style.display = 'none';
            const app = block.querySelector('.apparatus-block');
            if(app) app.style.display = 'block';
        }
        document.getElementById('translationsvg').style.display = 'revert';
        document.getElementById('apparatussvg').style.display = 'none';
        target.dataset.anno = 'translation';
    }
    else {
        for(const block of blocks) {
            const trans = block.querySelector('.text-block.translation');
            if(trans) trans.style.display = 'block';
            const app = block.querySelector('.apparatus-block');
            if(app) app.style.display = 'none';
        }
        document.getElementById('translationsvg').style.display = 'none';
        document.getElementById('apparatussvg').style.display = 'revert';
        target.dataset.anno = 'apparatus of variants';
    }
};

const wordsplit = (e) => {
    const target = document.getElementById('wordsplitbutton');
    const script = document.getElementById('transbutton').lang === 'en' ? 'taml' : 'iast';
    const standoffs = document.querySelectorAll('.standOff[data-type="wordsplit"]');
    if(target.dataset.anno === 'word-split text') {
        for(const standoff of standoffs) {
            const target = document.getElementById(standoff.dataset.corresp.replace(/^#/,''))?.querySelector('.edition');
        
            if(document.getElementById('transbutton').lang === 'en') {
                Transliterate.revert(target);
            }
            applymarkup(standoff);
            Transliterate.refreshCache(target);
            if(document.getElementById('transbutton').lang === 'en') {
                Transliterate.activate(target);
            }
        }
        document.getElementById('metricalsvg').style.display = 'revert';
        document.getElementById('wordsplitsvg').style.display = 'none';
        target.dataset.anno = 'metrical text';
    }
    else {
        for(const standoff of standoffs) {
            const target = document.getElementById(standoff.dataset.corresp.replace(/^#/,''))?.querySelector('.edition');
            if(document.getElementById('transbutton').lang === 'en')
                Transliterate.revert(target);
            removemarkup(standoff);
            Transliterate.refreshCache(target);
            if(document.getElementById('transbutton').lang === 'en') {
                Transliterate.activate(target);
            }
        }
        document.getElementById('metricalsvg').style.display = 'none';
        document.getElementById('wordsplitsvg').style.display = 'revert';
        target.dataset.anno = 'word-split text';
    }
};
/*
const countpos = (str, pos) => {
    if(pos === 0) return 0;
    let realn = 0;
    for(let n=1;n<=str.length;n++) {
       if(str[n] !== '\u00AD')
           realn = realn + 1;
        if(realn === pos) return n;
    }
};
*/
const nextSibling = (node) => {
    let start = node;
    while(start) {
        let sib = start.nextSibling;
        if(sib) return sib;
        else start = start.parentElement; 
    }
    return false;
};

const nextTextNode = (start,strand) => {
    let next = nextSibling(start);
    while(next) {
        if(next.nodeType === 3) return next;
        else {
            if(next.parentNode.classList.contains('choice') &&
               [...next.parentNode.children].indexOf(next) !== strand) {
                next = nextSibling(next,strand);
            }
            else next = next.firstChild || nextSibling(next);
        }
    }
    return null;
};

const realNextSibling = (walker) => {
    let cur = walker.currentNode;
    while(cur) {
        const sib = walker.nextSibling();
        if(sib) return sib;
        cur = walker.parentNode();
    }
    return null;
};

const lineCounter = (el) => {
    const walker = document.createTreeWalker(el,NodeFilter.SHOW_ALL);
    let count = 0;
    let cur = walker.currentNode;
    while(cur) {
        if(cur.nodeType === 1 &&
           cur.classList.contains('choiceseg') && 
           cur !== cur.parentNode.children[0]) {
                cur = realNextSibling(walker);
                continue;
        }
        if(cur.nodeType === 3)
            count = count + cur.textContent.trim().replaceAll(/[\s\u00AD]/g,'').length;
        cur = walker.nextNode();
    }
    return count;
};

const wordLength = (lemma) => {
    const clone = lemma.cloneNode(true);
    for(const ignored of clone.querySelectorAll('.ignored'))
        ignored.remove();
    return clone.textContent.trim().replaceAll(/[\s\u00AD]/g,'').length;
};

const matchCounts = (alignment,linecounts) => {
    linecounts = [...linecounts];
    const realcounts = [];
    let matchcount = 0;
    for(let n=0;n<alignment[0].length;n++) {
        if(matchcount === linecounts[0]) {
            linecounts.shift();
            const line2 = alignment[1].slice(0,n);
            const matches = [...line2].reduce((acc, cur) => cur === 'M' ?  acc + 1 : acc,0);
            realcounts.push(matches);
        }
        if(alignment[0][n] === 'M') matchcount = matchcount + 1;
    }
    return realcounts;
};

const makeWord = (entry) => {
    const lemma = entry.querySelector('.f[data-name="lemma"]');
    const span = document.createElement('span');
    const clone = lemma.cloneNode(true);
    while(clone.firstChild) {
        if(clone.firstChild.nodeType === 1)
            clone.firstChild.lang = 'ta-Latn-t-ta-Taml'; // there's probably a better way
        span.append(clone.firstChild);
    }
    span.className = 'word split';
    const translation = entry.querySelector('.f[data-name="translation"]');
    const affix = entry.querySelector('.f[data-name="affix"]');
    const particles = entry.querySelectorAll('.f[data-name="particle"]');
    const roles = entry.querySelectorAll(':scope > .f[data-name="role"], :scope > .f[data-name=""] > .f[data-name="role"]');
    const cleanlemma = entry.querySelector('.f[data-name="simple"]');
    if(cleanlemma) span.dataset.clean = cleanlemma.textContent;
    if(translation || affix) {
        span.dataset.anno = '';
        const annoel = document.createElement('span');
        annoel.className = 'anno-inline ignored';
        annoel.lang = 'en';
        if(translation) annoel.append(translation.textContent);
        let annohtml = translation ? translation.textContent : '';
        if(roles.length > 0)
            annohtml = annohtml + ` (${[...roles].map(r => r.textContent).join(' ')})`;
        if(affix) {
            const affixrole = affix.querySelector('[data-name="role"]')?.textContent || 'suffix';
            const form = affix.querySelector('[data-name="lemma"]');
            annohtml = annohtml + ` (${affixrole} <span lang="ta">${form.textContent}</span>)`;
        }
        for(const particle of particles) {
            const form = particle.querySelector('[data-name="lemma"]');
            annohtml = annohtml + ` (particle <span lang="ta">${form.textContent}</span>)`;
        }
        annoel.innerHTML = annohtml;
        span.prepend(annoel);
    }
    const notes = entry.querySelectorAll('.note');
    for(const note of notes) {
        const noteel = document.createElement('span');
        noteel.className = 'footnote ignored';
        noteel.dataset.anno = '';
        noteel.append('†');
        const annoel = document.createElement('span');
        annoel.lang = note.lang;
        annoel.className = 'anno-inline';
        annoel.innerHTML = note.innerHTML;
        noteel.appendChild(annoel);
        span.appendChild(noteel);
    }
    return span;
};

const applymarkup = (standoff) => {
    const target = document.getElementById(standoff.dataset.corresp.replace(/^#/,''))?.querySelector('.edition');
    if(!target) return;
    
    const cache = new Map();

    const lines = [...target.querySelectorAll('.l')];
    const linecounts = lines.reduce((acc,cur) => {
        const count = lineCounter(cur);
        const add = acc.length > 0 ? acc.at(-1) : 0;
        acc.push(count + add);
        return acc;
    },[]);
    
    const alignmentel = standoff.querySelector('.alignment[data-select="0"]');
    const alignment = alignmentel.textContent.trim().split(',').map(s =>
        s.replaceAll(/(\d+)([MLRG])/g, (_, count, chr) => chr.repeat(count))
        );
    target.dataset.alignment = alignment.join(',');

    const realcounts = matchCounts(alignment,linecounts);

    const entries = [...standoff.querySelectorAll(':scope > .fs')];
    let wordcount = 0;
    let linenum = 0;
    cache.set(lines[linenum],lines[linenum].cloneNode(true));
    lines[linenum].innerHTML = '';
    for(const entry of entries) {
        if(wordcount >= realcounts[linenum]) {
            linenum = linenum + 1;
            cache.set(lines[linenum],lines[linenum].cloneNode(true));
            lines[linenum].innerHTML = '';
        }

        if(entry.classList.contains('superentry')) {
            const choice = document.createElement('span');
            choice.className = 'choice';
            if(entry.classList.contains('ambiguous'))
                choice.classList.add('inline');

            for(const seg of entry.querySelectorAll(':scope > .fs')) {
                const segel = document.createElement('span');
                segel.className = 'choiceseg';
                const subentries = seg.querySelectorAll('.fs');
                if(subentries.length > 0) {
                    for(const subentry of subentries) {
                        const word = makeWord(subentry);
                        segel.appendChild(word);
                        //if(seg.dataset.select === '0')
                        if(seg === seg.parentElement.firstElementChild)
                            wordcount = wordcount + wordLength(word);
                    }
                }
                else {
                    const word = makeWord(seg);
                    segel.appendChild(word);
                    //if(seg.dataset.select === '0')
                    if(seg === seg.parentElement.firstElementChild)
                        wordcount = wordcount + wordLength(word);
                }
                choice.appendChild(segel);
            }
            lines[linenum].appendChild(choice);
        }

        else {
            const word = makeWord(entry);
            lines[linenum].appendChild(word);
            wordcount = wordcount + wordLength(word);
        }
    }

    cachedContent.set(target,cache);
};

const removemarkup = (standoff) => {
    const target = document.getElementById(standoff.dataset.corresp.replace(/^#/,''))?.querySelector('.edition');
    if(!target) return;

    const cached = cachedContent.get(target);
    for(const [el,oldContent] of cached) {
        while(el.firstChild) 
            el.firstChild.remove();
        while(oldContent.firstChild)
            el.appendChild(oldContent.firstChild);
    }
    delete target.dataset.alignment;
    target.normalize();
};

const go = () => {
    if(document.getElementById('editionscript').dataset.debugging === 'false')
        Debugging = false;

    const lineview = document.querySelector('.line-view-icon');
    lineview.style.display = 'none';
/*
    const scripttag = document.getElementById('editionscript');
    if(scripttag.dataset.debugging) {
        Debugging = true;
        ApparatusViewer.debug();
    }
*/
    const recordcontainer = document.getElementById('recordcontainer');
    Transliterate.init(recordcontainer);

    for(const t of recordcontainer.querySelectorAll('.teitext > div > div:first-child')) {
        //tamilize(t);
        for(const b of t.querySelectorAll('ruby br')) {
            b.parentElement.after(b.nextSibling);
            b.parentElement.after(b);
        }
    }
    recordcontainer.querySelector('.teitext').addEventListener('click',lookup);
    
    if(document.querySelector('.standOff[data-type="wordsplit"]')) {
        const wordsplitbutton = document.getElementById('wordsplitbutton');
        wordsplitbutton.style.display = 'block';
        wordsplitbutton.addEventListener('click',wordsplit);
    }
 
    else if(Debugging) {
        const wordsplitbutton = document.getElementById('wordsplitbutton');
        wordsplitbutton.style.display = 'block';
        wordsplitbutton.style.border = '1px dashed grey';
        wordsplitbutton.dataset.anno = 'add word splits';
        wordsplitbutton.querySelector('svg').style.stroke = 'grey';
        /*
        const uploader = document.createElement('input');
        uploader.type = 'file';
        uploader.addEventListener('change',addwordsplit);
        wordsplitbutton.addEventListener('click',() => {uploader.click();});
        */
        Splitter.setTransliterator(Transliterate);
        wordsplitbutton.addEventListener('click',Splitter.addWordSplits);
    }

    if(document.querySelector('.translation')) {
        const apparatusbutton = document.getElementById('apparatusbutton');
        if(document.querySelector('div.apparatus-block span.app')) {
            apparatusbutton.style.display = 'block';
            apparatusbutton.addEventListener('click',apparatusswitch);
        }
        else if(Debugging) {
            apparatusbutton.style.display = 'block';
            apparatusbutton.style.border = '1px dashed grey';
            apparatusbutton.dataset.anno = 'add variants';
            apparatusbutton.querySelector('svg').style.stroke = 'grey';
            apparatusbutton.addEventListener('click',addVariants);
        }
    }
    else {
        for(const app of document.querySelectorAll('.apparatus-block'))
            app.style.display = 'block';
    }
    //wordsplit({target: analyzebutton});
    //cleanup(document);
    

    if(document.querySelector('.app')) {
        ApparatusViewer.init();
        ApparatusViewer.setTransliterator(Transliterate);
    }

    GitHubFunctions.latestCommits();
};

window.addEventListener('load',go);

