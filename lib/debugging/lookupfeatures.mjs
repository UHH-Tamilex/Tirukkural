import createSqlWorker from '../js/sqlWorker.mjs';
import {dbSchema} from './abbreviations.mjs';

const _state = {
    lemmaindex: null,
    fullindex: null,
    cache: new Map()
};

const importantKeys = ['pos','number','gender','nouncase','person','aspect','voice'];

const lookupCitations = async (str) => {
    if(!_state.fullindex)
        _state.fullindex = await createSqlWorker('https://uhh-tamilex.github.io/lexicon/wordindex.db');
    
    const cached = _state.cache.get(str);
    if(cached) return cached;
    
    const res = (await _state.fullindex.db.query(`SELECT def, ${importantKeys.join(', ')} FROM [citations] WHERE form = ?`,[str]));

    if(res.length === 0) return null;

    const candidate = mostPopular2(res);

    const ret = {
        translation: candidate.translation.replaceAll(/\s+/g,'_'),
        grammar: candidate.grammar
    };
    _state.cache.set(str,ret);
    return ret;
};

const lookupCitationDefs = async (str,grammar) => {
    if(!_state.fullindex)
        _state.fullindex = await createSqlWorker('https://uhh-tamilex.github.io/lexicon/wordindex.db');
    
    const cached = _state.cache.get(str);
    if(cached) return cached;
    
    const res = (await _state.fullindex.db.query(`SELECT def FROM [citations] WHERE form = ? AND ${grammar.search}`,[str,...grammar.values]));

    if(res.length === 0) return null;
    return mostPopular3(res.map(r => r.def));
};

const lookupLemmata = async str => {
    if(!_state.lemmaindex) 
        _state.lemmaindex = await createSqlWorker('../debugging/index.db');

    const cached = _state.cache.get(str);
    if(cached) return cached;

    const res = (await _state.lemmaindex.db.query(`SELECT ${importantKeys.join(', ')}, citations FROM [dictionary] WHERE word = ?`,[str]));

    if(res.length === 0) return null;

    const obj = res.length === 1 ? 
        res[0] :
        mostPopular(res);

    const ret = {
        translation: null,
        grammar: [],
    };
    
    for(const key of importantKeys)
        if(obj.hasOwnProperty(key))
            ret.grammar.push(obj[key]);

    _state.cache.set(str,ret);

    return ret;
};

// returns {translation: String, grammar: Array}
const lookupFeatures = async (str, translation, grammar) => {
    
    if(!translation && !grammar) {
        return await lookupCitations(str);
    }
    else if(!grammar) { // translation given, grammar empty
        return await lookupLemmata(str);
    }
    else if(!translation) { // grammar given, translation empty
        const gramarr = [];
        const search = [];
        const keys = Object.keys(dbSchema);
        for(const key of keys) {
            for(const gram of grammar) {
                if(dbSchema[key].has(gram)) {
                    search.push(`${key} = ?`);
                    gramarr.push(gram);
                }
            }
        }
        const def = await lookupCitationDefs(str,{search: search.join(' AND '), values: gramarr});
        if(def) 
            return {
                translation: def,
                grammar: grammar
            };
    }
    /*
    else if(!translation) {
        if(!state.fullindex)
            _state.fullindex = await createSqlWorker('https://uhh-tamilex.github.io/lexicon/wordindex.db');
    }

    if(!ret.translation) {
        if(ret.grammar.entries.length > 0) {
            const res2 = (await _state.fullindex.db.query(`SELECT def FROM [citations] WHERE form = ?`,[str]));
        }
    }
    const res2 = (await _state.fullindex.db.query(`SELECT def, ${importantKeys.join(', ')} FROM [citations] WHERE form = ?`,[str]));
    obj.translation = res2.def.replaceAll(/\s+/g,'_');

        // lookup in fullindex
    */
};

const mostPopular = (arr) => {
    const ret = {
        el: null,
        max: 0
    };
    for(const a of arr) {
        const len = a.citations.length;
        if(len > ret.max) {
            ret.el = a;
            ret.max = len;
        }
    }
    return ret.el;
};

const mostPopular2 = (arr) => {
    if(arr.length === 1)
        return {
            translation: arr[0].def,
            grammar: importantKeys.reduce((acc,cur) => {
                if(arr[0].hasOwnProperty(cur))
                    acc.push(arr[0][cur]);
                return acc;
            },[])
        };

    const counts = new Map();
    for(const obj of arr) {
        const str = importantKeys.map(k => obj[k]).join(';');
        const curcount = counts.get(str);
        if(curcount) curcount.count = curcount.count + 1;
        else counts.set(str,{obj: obj,count: 1});
    }
    const best = [...counts.values()].toSorted((a,b) => a.count - b.count).pop().obj;
    return {
        translation: best.def,
        grammar: importantKeys.reduce((acc,cur) => {
            if(best.hasOwnProperty(cur))
                acc.push(best[cur]);
            return acc;
        },[])
    };
};

const mostPopular3 = (arr) => {
    if(arr.length === 1) return arr[0];

    const freqs = new Map();
    for(const a of arr) {
        const exist = freqs.get(a);
        if(exist) freqs.set(a,exist + 1);
        else freqs.set(a,0);
    }
    const best = [...freqs].toSorted((a,b) => a[1] - b[1]).pop()[0];
    return best;
};

export default lookupFeatures;
