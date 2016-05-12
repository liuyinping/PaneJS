import * as utils from '../common/utils';


class CellView {

    constructor(paper, cell) {

        this.cell    = cell;
        this.paper   = paper;
        this.invalid = true;  // default need to be repainted

        this.ensureElement();
    }

    ensureElement() { return this; }

    render() { return this; }

    update() { return this; }

    getCell() {

        return this.cell;
    }

    getPaper() {

        return this.paper;
    }

    getModel() {

        return this.paper && this.paper.getModel();
    }

    getPane() {

        let result;

        let pane = this.cell.metadata.pane;
        if (pane) {
            if (utils.isString(pane)) {
                result = this.paper[pane];
            } else if (utils.isNode(pane)) {
                result = pane;
            }
        }

        return result || this.paper.drawPane;
    }

    destroy() {

        utils.removeElement(this.elem);
        utils.destroy(this);
    }
}


// exports
// -------

export default CellView;
