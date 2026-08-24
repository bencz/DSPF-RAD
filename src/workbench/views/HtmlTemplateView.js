export class HtmlTemplateView {
    constructor ({ documentRef, markup }) {
        this.document = documentRef;
        this.markup = markup;
    }

    createFragment () {
        const template = this.document.createElement('template');
        template.innerHTML = this.markup.trim();
        return template.content.cloneNode(true);
    }
}
