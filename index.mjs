import {createReadStream} from 'fs';
import Fs from 'fs';
import {createInterface} from 'readline';
import {parse as Parse} from 'csv-parse';
import {Sanscript} from './sanscript.mjs';

const parser = Parse({delimiter: ','});

const template = Fs.readFileSync('poem-template.xml',{encoding: 'utf-8'});

parser.on('readable',() => {
    let rec;
    while((rec = parser.read()) !== null) {
        const id = `TK${rec[1]}`;
        const filename = id + '.xml';
        const ed = Sanscript.t(rec[2].replace(/\\n/g,'</l>\n<l>'),'tamil','iast')
                            .replace(/^/g,'<l>')
                            .replace(/$/g,'</l>');
        const trans = rec[7].replace(/\\n/g,'</l>\n<l>')
                            .replace(/^/g,'<l>')
                            .replace(/$/g,'</l>');
        const type = Sanscript.t(rec[12],'tamil','iast');
        const title = `<title xml:lang="ta">Tirukkuṟaḷ</title> ${rec[1]}. <term xml:lang="ta">${type}</term>.`;
        const out = template.replace('<!-- id here -->',id)
                            .replace('<!-- edition here -->', ed)
                            .replace('<!-- translation here -->', trans)
                            .replace('<!-- title here -->', title);
        Fs.writeFileSync(filename,out);

    }
});

const rl = createInterface({
    input: createReadStream('alikural_final.csv'),
    output: process.stdout,
    terminal: false
});

rl.on('line', l => parser.write(l + '\n'));
