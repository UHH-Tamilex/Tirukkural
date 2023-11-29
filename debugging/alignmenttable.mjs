import { tamilSplit } from './aligner.mjs';

const wordClean = (str) => {
    // remove all but first option from alignment
    return str.replaceAll(/\/[aāiīuūeēoōkṅcñṭṇtnpmyrlvḻḷṟṉ]+\s/g,'')
              .replaceAll(/\s/g,'');
};

const consonants = new Set(['k','ṅ','c','ñ','ṭ','ṇ','t','n','p','m','y','r','l','v','ḷ','ḻ','ṟ','ṉ']);

const checkEquality = (arr1, arr2, n) => {
    if(typeof arr1[n] !== 'string' || typeof arr2[n] !== 'string')
        return 'mismatch';
    if(arr1[n] === arr2[n])
        return null;
    if([';','.',','].includes(arr1[n]) && arr2[n] === '')
        return null;
    if(arr2[n] === '')
        return 'typo';
    if(arr2[n] === '~') {
        if(['y','v'].includes(arr1[n])) return null;
        else return 'typo';
    }
    if(arr2[n] === '+') {
        if(!consonants.has(arr1[n])) return 'typo';
        
        const next = getNext(arr1,n);
        if(next && next === arr1[n]) return null;
        
        const prev = getPrev(arr1,n);
        if(prev && prev === arr1[n]) return null;

        return 'typo';

    }
    if(arr2[n] === '*' || arr2[n] === "'") {
        if(arr1[n] !== '')
            return 'typo';
        else return null;
    }
    if(arr2[n] === '-') {
        if(arr1[n] !== '') return 'typo';
        else return null;
    }
    if(arr1[n] === 'i' && ['u','’','*'].includes(arr2[n]))
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
                td1.colSpan = '2';
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
                td2.colSpan = '2';
                td2.classList.add('mismatch');
            }
            else if(unequal) td2.classList.add(unequal);
            else if(td1?.classList.contains('mismatch')) td2.classList.add('mismatch');
            row2.appendChild(td2);
        }

        if(typeof alignment[1][n] === 'string' && alignment[1][n] !== '') nn++;

        if(alignment[1][n+1] !== '' && charcounts.includes(nn)) {
            atab.appendChild(row1);
            atab.appendChild(row2);
            par.appendChild(atab);
            atab = document.createElement('table');
            row1 = document.createElement('tr');
            row2 = document.createElement('tr');
        }

    atab.appendChild(row1);
    atab.appendChild(row2);
    par.appendChild(atab);
    }

};

export default makeAlignmentTable;
