import { tamilSplit } from './aligner.mjs';

const wordClean = (str) => {
    // remove all but first option from alignment
    return str.replaceAll(/\/[aāiīuūeēoōkṅcñṭṇtnpmyrlvḻḷṟṉ]+\s/g,'')
              .replaceAll(/\s/g,'');
};

const consonants = new Set(['k','ṅ','c','ñ','ṭ','ṇ','t','n','p','m','y','r','l','v','ḷ','ḻ','ṟ','ṉ']);

const checkEquality = (arr1, arr2, n) => {
    const char1 = arr1[n];
    const char2 = arr2[n];

    if(typeof char1 !== 'string' || typeof char2 !== 'string')
        return 'mismatch';
    if(char1 === char2)
        return null;
    if([';','.',','].includes(char1) && char2 === '')
        return null;
    if(char2 === '')
        return 'typo';
    if(char2 === '~') {
        if(['y','v'].includes(char1)) return null;
        else return 'typo';
    }
    if(char2 === '+') {
        if(!consonants.has(char1)) return 'typo';
        
        const next = getNext(arr1,n);
        if(next && next === char1) return null;
        
        const prev = getPrev(arr1,n);
        if(prev && prev === char1) return null;

        return 'typo';

    }
    if(char2 === '*' || char2 === "'") {
        if(char1 !== '')
            return 'typo';
        else return null;
    }
    if(char2 === '-') {
        if(char1 !== '') return 'typo';
        else return null;
    }
    if(char1 === 'i' && ['u','’','*'].includes(char2))
        return 'typo';
    if(char2 === 'u' && char1 === '')
        return 'typo';

    return 'mismatch';
};

const getNext = (arr,n) => {
    for(let m=n+1;m<arr.length;m++) {
        if(typeof arr[m] !== 'string') continue;
        if(arr[m] === '' || [';',',','.'].includes(arr[m])) continue;
        return arr[m];
    }
    return false;
};

const getPrev = (arr,n) => {
    for(let m=n-1;m>=0;m--) {
        if(typeof arr[m] !== 'string') continue;
        if(arr[m] === '' || [';',',','.'].includes(arr[m])) continue;
        return arr[m];
    }
    return false;
};

const makeAlignmentTable = (alignment,lines,par) => {
    let charcounts = lines.reduce((acc,cur) => {
        const i = tamilSplit(wordClean(cur)).length;
        if(acc.length > 0)
            acc.push(acc[acc.length-1] + i);
        else acc.push(i - 1);
        return acc;
    },[]);

    let atab = document.createElement('table');
    let row1 = document.createElement('tr');
    let row2 = document.createElement('tr');
    let nn = -1;
    for(let n=0;n<alignment[0].length;n++) {
        const unequal = checkEquality(alignment[0],alignment[1],n);
        let td1;
        if(typeof alignment[0][n] === 'string') {
            td1 = document.createElement('td');
            td1.append(alignment[0][n]);
            if(alignment[0][n + 1] === Symbol.for('concatleft') ||
               alignment[0][n - 1] === Symbol.for('concatright')) {
                td1.colSpan = 2;
                td1.classList.add('mismatch');
            }
            else if(unequal) td1.classList.add(unequal);
            row1.appendChild(td1);
        }
        if(typeof alignment[1][n] === 'string') {
            const td2 = document.createElement('td');
            td2.append(alignment[1][n]);
            if(alignment[1][n + 1] === Symbol.for('concatleft') ||
               alignment[1][n - 1] === Symbol.for('concatright')) {
                td2.colSpan = 2;
                td2.classList.add('mismatch');
            }
            else if(unequal) td2.classList.add(unequal);
            else if(td1?.classList.contains('mismatch')) td2.classList.add('mismatch');
            row2.appendChild(td2);
        }

        if(typeof alignment[1][n] === 'string' && alignment[1][n] !== '') nn++;

        if(alignment[1][n+1] !== '' && charcounts.includes(nn)) {
            const add1 = row1.lastChild.colSpan === 2;

            atab.appendChild(row1);
            atab.appendChild(row2);
            par.appendChild(atab);
            atab = document.createElement('table');
            row1 = document.createElement('tr');
            row2 = document.createElement('tr');

            if(add1)
                row1.appendChild(document.createElement('td'));
        }

    atab.appendChild(row1);
    atab.appendChild(row2);
    par.appendChild(atab);
    }

};

export default makeAlignmentTable;
