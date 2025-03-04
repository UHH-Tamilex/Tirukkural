import {Sanscript} from './sanscript.mjs';
import createSqlWorker from './sqlWorker.mjs';

var sqlWorker = null;

const wordLookup = async (word) => {
    let clean = word.dataset.clean;
    if(!clean) {
        const clone = word.cloneNode(true);
        for(const pc of clone.querySelectorAll('.invisible, .ignored, .character.inserted, .character.glide, .character.geminated'))
            pc.remove();
        for(const u of clone.querySelectorAll('.character.elided'))
            u.replaceWith('u');
        clean = Sanscript.t(clone.textContent.replaceAll('\u00AD',''),'tamil','iast');
    }
    const id = word.closest('[id]').id;

    if(!sqlWorker) 
        sqlWorker = await createSqlWorker('https://uhh-tamilex.github.io/lexicon/wordindex.db');

    const citrow = (await sqlWorker.db.query('SELECT fromlemma, islemma FROM citations WHERE form = ? AND citation = ?',[clean,id]))[0];
    let allcits;
    let definition;
    let fromlemma;
    if(citrow?.islemma) {
        allcits = await sqlWorker.db.query('SELECT def, pos, number, gender, nouncase, person, voice, aspect, syntax, particlefunction, rootnoun, proclitic, enclitic, context, citation, line, filename FROM citations WHERE form = ? AND islemma IS ?',[clean,citrow.islemma]);
        definition = (await sqlWorker.db.query('SELECT definition FROM lemmata WHERE lemma IS ?',[citrow.islemma]))[0].definition;
    }
    else if(citrow?.fromlemma) {
        allcits = await sqlWorker.db.query('SELECT def, pos, number, gender, nouncase, person, voice, aspect, syntax, particlefunction, rootnoun, proclitic, enclitic, context, citation, line, filename FROM citations WHERE form = ? AND fromlemma IS ?',[clean,citrow.fromlemma]);
        fromlemma = (await sqlWorker.db.query('SELECT form FROM lemmata WHERE lemma IS ?',[citrow.fromlemma]))[0].form;
    }
    else {
        allcits = await sqlWorker.db.query('SELECT def, pos, number, gender, nouncase, person, voice, aspect, syntax, particlefunction, rootnoun, proclitic, enclitic, context, citation, line, filename FROM citations WHERE form = ?',[clean]);
    }

    if(!allcits || allcits.length === 0) return;

    return formatEntry(clean, allcits, definition, fromlemma);
};

const formatCitations = citations => {
    return '<table><tbody>' + citations.map(c => {
        const link = c.line ? 
            c.filename + '?highlight=' + encodeURIComponent(`[id="${c.siglum}"] .l:nth-of-type(${c.line})`)
            : c.filename;

        return `<tr>
    <td><span class="msid" lang="en"><a href="${link}">${c.siglum}</a></span></td>
    <td><q lang="ta">${c.context}</q></td>
    <td>${c.translation ? '<span class="context-translation">'+c.translation+'</span>':''}</td>
    <td>${c.syntax ? ' <span class="syntax">'+c.syntax+'</span>':''}</td>
</tr>`;}).join('\n') + '</tbody></table>';
};


const formatEntry = (form,results,canonicaldef,fromlemma) => {
    
    const entry = {
        translations: new Set(),
        grammar: new Set(),
        citations: []
    };

    for(const result of results) {
        if(result.def) entry.translations.add(result.def);
        if(result.pos) entry.grammar.add(result.pos);
        if(result.number) entry.grammar.add(result.number);
        if(result.gender) entry.grammar.add(result.gender);
        if(result.nouncase) entry.grammar.add(result.nouncase);
        if(result.person) entry.grammar.add(result.person);
        if(result.aspect) entry.grammar.add(result.aspect);
        if(result.citation) entry.citations.push({
            siglum: result.citation,
            filename: result.filename,
            line: result.line,
            context: result.context,
            translation: result.def,
            syntax: result.syntax || result.particlefunction || result.rootnoun,
        });
    }
    const definition = canonicaldef ? `<p>${canonicaldef}</p>` : '';
    const lemma = fromlemma ? `<span class="lemma-head">${fromlemma}</span> ` : '';
    let frag =
`<div lang="en">
<h3 lang="ta">${lemma}${form}</h3>
<p>${[...entry.grammar].join(', ')}</p>
${definition}
</div>`;
    if(entry.translations.size > 0) {
        frag = frag + 
`<div>
<h4 lang="en">translations in context</h4>
<p>${[...entry.translations].join(', ')}</p>`;
    }
    if(entry.citations.length > 0) {
        frag = frag + 
`<h4 lang="en">citations</h4>
<div class="dict-citations">
${formatCitations(entry.citations)}
</div>`;
    }
    return frag;
};

export default wordLookup;
