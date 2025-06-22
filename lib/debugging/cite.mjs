const Citer = {};

const Sheet = (new DOMParser()).parseFromString(`<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:tei="http://www.tei-c.org/ns/1.0">
  <xsl:output method="xml" version="1.0" encoding="UTF-8" indent="yes"/>

  <xsl:template match="*">
    <xsl:element name="{local-name()}">
      <xsl:copy-of select="@*"/>
      <xsl:apply-templates/>
    </xsl:element>
  </xsl:template>

  <xsl:template match="tei:form">
    <w><xsl:apply-templates/></w>
  </xsl:template>
</xsl:stylesheet>
`,'text/xml');

const getWords = (par, range) => {
    const start = range.startContainer.parentNode.closest('.word');
    const end = range.endContainer.parentNode.closest('.word');
    if(!start || !end) return;
    
    const ret = [];
    for(const [n, word] of [...par.querySelectorAll('.word')].entries()) {
        if(word === start || word === end) {
            ret.push(n);
            if(start === end) {
                ret.push(n);
                return ret;
            }
        }
        if(ret.length === 2) {
            ret.sort((a,b) => a > b);
            return ret;
        }
    }
    return;
};

const copyToClipboard = (xml, par) => {
    navigator.clipboard.writeText(xml).then(
        () => {
            const tip = document.createElement('div');
            tip.style.position = 'absolute';
            tip.style.top = 0;
            tip.style.right = 0;
            tip.style.background = 'rgba(0,0,0,0.5)';
            tip.style.color = 'white';
            tip.style.padding = '0.5rem';
            tip.append('Copied to clipboard.');
            par.appendChild(tip);
            tip.animate([
                {opacity: 0},
                {opacity: 1, easing: 'ease-in'}
                ],200);
            setTimeout(() => tip.remove(),1000);
        },
        () => {
            const par = popup.querySelector('.popup-output');
            const tip = document.createElement('div');
            tip.style.position = 'absolute';
            tip.style.top = 0;
            tip.style.right = 0;
            tip.style.background = 'rgba(0,0,0,0.5)';
            tip.style.color = 'red';
            tip.style.padding = '0.5rem';
            tip.append('Couldn\'t copy to clipboard.');
            par.appendChild(tip);
            setTimeout(() => tip.remove(),1000);
        }
    );
};

Citer.makeCitation = (doc, id, nums) => {
    const standOff = doc.querySelector(`standOff[type="wordsplit"][corresp="#${id}"]`);
    const par = document.implementation.createDocument('http://www.tei-c.org/ns/1.0','q');
    let i = 0;
    for(const word of standOff.querySelectorAll(':scope > entry')) {
        if(i > nums[1]) break;
        if(i >= nums[0]) {
            const clone = par.importNode(word.querySelector('form'),true);
            par.documentElement.appendChild(clone);
            if(i < nums[1])
                par.documentElement.append(' ');
        }
        i = i + 1;
    }
    const xproc = new XSLTProcessor();
    xproc.importStylesheet(Sheet);
    const newdoc = xproc.transformToDocument(par);
    newdoc.documentElement.setAttribute('xml:lang','ta');
    return newdoc;
};

Citer.docSelect = e => {
    const sel = document.getSelection();
    if(sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const par = range.commonAncestorContainer.nodeType === 1 ?
        range.commonAncestorContainer : range.commonAncestorContainer.parentNode;
    const edblock = par.closest('.text-block.edition');
    if(!edblock) return;
    const nums = getWords(edblock, range);
    const id = edblock.closest('[id]').id;
    const q = Citer.makeCitation(Citer.thisDoc, id, nums);

    const qserial = (new XMLSerializer()).serializeToString(q.documentElement);
    const url = new URL(window.location);
    const base = url.origin + url.pathname;
    const out = `<cit source="${base}?id=${id}&w=${nums.join(',')}">
    ${qserial}
    <ref target="${base}">${id}</ref>
</cit>`;
    //TODO: find line numbers

    document.getElementById('blackout').style.display = 'flex';
    const popup = document.getElementById('citation-popup');
    popup.style.display = 'flex';
    const outbox = popup.querySelector('.boxen div');
    outbox.innerHTML = Prism.highlight(out,Prism.languages.xml,'xml');
    copyToClipboard(out,outbox);
        
};

Citer.closePopup = () => {
    document.getElementById('blackout').style.display = 'none';
    const popup = document.getElementById('citation-popup');
    popup.querySelector('.boxen div').innerHTML = '';
 
};

Citer.startCite = e => {
    if(!e.target.classList.contains('pressed')) {
        e.target.classList.add('pressed');
        document.addEventListener('mouseup',Citer.docSelect);
        for(const block of document.querySelectorAll('.text-block.edition'))
            block.style.cursor = 'copy';
    }
    else {
        e.target.classList.remove('pressed');
        document.removeEventListener('mouseup',Citer.docSelect);
        for(const block of document.querySelectorAll('.text-block.edition'))
            block.style.cursor = 'inherit';
    }

};

Citer.thisDoc = null;

Citer.init = xmldoc => {
    document.getElementById('button_citebutton')?.addEventListener('click',Citer.startCite);
    document.getElementById('citation-popup')?.querySelector('.closeicon').addEventListener('click',Citer.closePopup);
    Citer.thisDoc = xmldoc;
};

export default Citer;

